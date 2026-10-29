'use client';

import { useSyncExternalStore } from 'react';
import { appeler } from '../../api';

// RUBY en direct : micro et son de l'appel sur PC, micro seul au téléphone ; l'audio ne quitte le navigateur que vers AssemblyAI, jamais gardé

// Le flux attend du PCM 16 bits mono à 16 kHz ; les tours finis partent au serveur toutes les trois secondes, par tranches de 500
const FREQUENCE_FLUX = 16000;
const ENVOI_TOURS_MS = 3000;
const TRANCHE_TOURS = 500;

export type Mode = 'pc' | 'telephone';
type NomPiste = 'micro' | 'appel';
export type Tour = { piste: NomPiste; ordre: number; texte: string; locuteur: string; debut: number; fin: number };
type Piste = {
  nom: NomPiste; ws: WebSocket; voix: boolean; ouverte: number; fermee: number; decalage: number;
  tours: Map<number, Tour>; partiel: string; terminee: boolean; facturees?: number;
};
type Acces = { jeton: string; flux: string; modele: string };
export type AppelOuvert = { id: number; titre: string; mode: Mode; offre: string };
type MessageFlux = {
  type: string; end_of_turn?: boolean; transcript?: string; turn_order: number; speaker_label?: string;
  words?: { start: number; end: number }[]; revisions?: { turn_order: number; speaker_label: string }[]; session_duration_seconds?: number;
};
export type Avis = { texte: string; erreur?: boolean } | null;

export type EtatDirect = {
  appel: AppelOuvert | null;
  // Début de l'appel, en millisecondes de l'horloge du navigateur
  debut: number;
  tours: Tour[];
  partiels: { piste: NomPiste; texte: string }[];
  cloture: boolean;
  // L'appel dont l'analyse se rédige après « Terminer »
  analyse: number | null;
  avis: Avis;
};

// L'appel en cours vit hors de la page : il survit à un changement de page, la transcription ne doit rien perdre
const enCours = {
  appel: null as AppelOuvert | null, pistes: [] as Piste[], contexte: null as AudioContext | null, flux: [] as MediaStream[],
  minuteur: 0, debut: 0, aEnvoyer: new Set<string>(), envoi: false, fin: false,
};
let etat: EtatDirect = { appel: null, debut: 0, tours: [], partiels: [], cloture: false, analyse: null, avis: null };
const abonnes = new Set<() => void>();

function changer(part: Partial<EtatDirect> = {}) {
  etat = {
    ...etat, ...part, appel: enCours.appel,
    tours: enCours.pistes.flatMap((p) => [...p.tours.values()]).sort((a, b) => a.debut - b.debut),
    partiels: enCours.pistes.filter((p) => p.partiel).map((p) => ({ piste: p.nom, texte: p.partiel })),
  };
  abonnes.forEach((f) => f());
}

const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};

export const useDirect = () => useSyncExternalStore(abonner, () => etat, () => etat);
export const oublierAvis = () => changer({ avis: null });

// Le nom d'une voix en direct : « Moi » pour le micro d'un appel sur PC, sinon sa piste et sa lettre
export function nomEnDirect(piste: NomPiste, locuteur: string, mode: Mode | undefined) {
  if (mode === 'pc' && piste === 'micro') return 'Moi';
  return `${piste === 'appel' ? 'Interlocuteur' : 'Voix'} ${locuteur || '?'}`;
}

// Quitter le site pendant un appel couperait la transcription : le navigateur le demande d'abord
function retenir(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = '';
}

function arreterFlux() {
  for (const flux of enCours.flux) for (const piste of flux.getTracks()) piste.stop();
  enCours.flux = [];
  void enCours.contexte?.close();
  enCours.contexte = null;
}

export async function demarrer(demande: { mode: Mode; offre_cle: string; titre: string }) {
  try {
    // Au téléphone, la voix lointaine du haut-parleur n'est pas un bruit à gommer
    enCours.flux = [await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: demande.mode === 'pc', autoGainControl: true } })];
    if (demande.mode === 'pc') {
      const partage = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      enCours.flux.push(partage);
      if (!partage.getAudioTracks().length) {
        throw new Error("Aucun son partagé : choisissez l'onglet ou l'écran de l'appel et cochez « Partager l'audio ».");
      }
    }
    const acces = await appeler<Acces>('/appels/jeton', { methode: 'POST' });
    enCours.contexte = new AudioContext();
    // Créé après les fenêtres d'autorisation, il peut naître suspendu : sans reprise, aucun son ne partirait
    await enCours.contexte.resume();
    await enCours.contexte.audioWorklet.addModule('/illusion/echantillonneur.js');
    enCours.appel = await appeler<AppelOuvert>('/appels', { methode: 'POST', corps: demande });
    enCours.debut = performance.now();
    // Sur PC, le micro n'est que vous ; l'appel peut porter plusieurs voix, et au téléphone le micro les entend toutes
    enCours.pistes = [ouvrirPiste('micro', enCours.flux[0], demande.mode === 'telephone', acces)];
    if (demande.mode === 'pc') enCours.pistes.push(ouvrirPiste('appel', enCours.flux[1], true, acces));
  } catch (erreur) {
    arreterFlux();
    enCours.appel = null;
    enCours.pistes = [];
    throw (erreur as Error).name === 'NotAllowedError' ? new Error('Accès au micro ou au partage refusé.') : erreur;
  }
  enCours.minuteur = window.setInterval(() => void envoyerTours(), ENVOI_TOURS_MS);
  window.addEventListener('beforeunload', retenir);
  changer({ debut: Date.now(), cloture: false, avis: null });
  return enCours.appel;
}

function ouvrirPiste(nom: NomPiste, flux: MediaStream, voix: boolean, acces: Acces): Piste {
  const parametres = new URLSearchParams({ sample_rate: String(FREQUENCE_FLUX), speech_model: acces.modele, format_turns: 'true', token: acces.jeton });
  if (voix) parametres.set('speaker_labels', 'true');
  const ws = new WebSocket(`${acces.flux}?${parametres}`);
  const piste: Piste = { nom, ws, voix, ouverte: 0, fermee: 0, decalage: 0, tours: new Map(), partiel: '', terminee: false };
  const contexte = enCours.contexte!;
  const source = contexte.createMediaStreamSource(new MediaStream(flux.getAudioTracks()));
  const noeud = new AudioWorkletNode(contexte, 'echantillonneur');
  source.connect(noeud);
  // Relié à la sortie pour être tiré par le graphe ; il n'y écrit rien, l'appel n'est pas rejoué dans les haut-parleurs
  noeud.connect(contexte.destination);
  noeud.port.onmessage = (e) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
  };
  ws.onopen = () => {
    piste.ouverte = performance.now();
    piste.decalage = piste.ouverte - enCours.debut;
  };
  ws.onmessage = (e) => recevoir(piste, JSON.parse(e.data));
  ws.onclose = (e) => {
    piste.fermee = performance.now();
    piste.terminee = true;
    if (enCours.appel && !enCours.fin && e.code !== 1000) {
      changer({ avis: { texte: `Transcription ${nom === 'micro' ? 'du micro' : "de l'appel"} coupée : ${e.reason || e.code}`, erreur: true } });
    }
  };
  return piste;
}

function recevoir(piste: Piste, message: MessageFlux) {
  if (message.type === 'Turn') {
    if (!message.end_of_turn) {
      piste.partiel = message.transcript ?? '';
    } else {
      const mots = message.words ?? [];
      const lettre = message.speaker_label && message.speaker_label !== 'PENDING' ? message.speaker_label : '';
      piste.tours.set(message.turn_order, {
        piste: piste.nom, ordre: message.turn_order, texte: message.transcript ?? '', locuteur: lettre,
        debut: Math.round(piste.decalage + (mots[0]?.start ?? 0)), fin: Math.round(piste.decalage + (mots.at(-1)?.end ?? 0)),
      });
      piste.partiel = '';
      enCours.aEnvoyer.add(`${piste.nom}:${message.turn_order}`);
    }
  } else if (message.type === 'SpeakerRevision') {
    // La séparation des voix se corrige en cours d'appel : seuls les tours dont la lettre change reviennent
    for (const revision of message.revisions ?? []) {
      const tour = piste.tours.get(revision.turn_order);
      if (!tour) continue;
      tour.locuteur = revision.speaker_label;
      enCours.aEnvoyer.add(`${piste.nom}:${revision.turn_order}`);
    }
  } else if (message.type === 'Termination') {
    // La durée que le fournisseur facture, plus juste que celle mesurée ici
    piste.facturees = message.session_duration_seconds;
    piste.terminee = true;
  }
  changer();
}

async function envoyerTours() {
  // Un envoi à la fois : deux envois croisés réécrivaient la transcription l'un par-dessus l'autre
  if (!enCours.appel || enCours.envoi || !enCours.aEnvoyer.size) return;
  enCours.envoi = true;
  try {
    while (enCours.aEnvoyer.size) {
      const cles = [...enCours.aEnvoyer].slice(0, TRANCHE_TOURS);
      for (const cle of cles) enCours.aEnvoyer.delete(cle);
      const segments = cles.map((cle) => {
        const [nom, ordre] = cle.split(':');
        return enCours.pistes.find((p) => p.nom === nom)?.tours.get(Number(ordre));
      }).filter(Boolean);
      try {
        await appeler(`/appels/${enCours.appel.id}/segments`, { methode: 'POST', corps: { segments } });
      } catch {
        // Un envoi raté repart au suivant : la transcription reste dans la page en attendant
        for (const cle of cles) enCours.aEnvoyer.add(cle);
        break;
      }
    }
  } finally {
    enCours.envoi = false;
  }
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Termine l'appel : clôture des flux, derniers tours envoyés, puis l'appel clos et analysé ; rend son numéro
export async function terminer(): Promise<number | null> {
  const appel = enCours.appel;
  if (!appel || etat.cloture) return null;
  enCours.fin = true;
  changer({ cloture: true });
  for (const piste of enCours.pistes) if (piste.ws.readyState === WebSocket.OPEN) piste.ws.send(JSON.stringify({ type: 'Terminate' }));
  // Les derniers tours et la dernière révision des voix arrivent après la demande de clôture
  const limite = performance.now() + 5000;
  while (enCours.pistes.some((p) => !p.terminee) && performance.now() < limite) await attendre(200);
  for (const piste of enCours.pistes) if (piste.ws.readyState <= WebSocket.OPEN) piste.ws.close(1000);
  clearInterval(enCours.minuteur);
  arreterFlux();
  // L'envoi en cours d'abord, puis le reste : clore avant lui perdrait ses derniers tours
  while (enCours.envoi) await attendre(100);
  await envoyerTours();
  let avis: Avis = null;
  if (enCours.aEnvoyer.size) {
    avis = { texte: `${enCours.aEnvoyer.size} tour(s) de parole n'ont pas pu être enregistrés.`, erreur: true };
    enCours.aEnvoyer.clear();
  }
  const maintenant = performance.now();
  const secondes = (pistes: Piste[]) => pistes.filter((p) => p.ouverte).reduce((t, p) => t + (p.facturees ?? ((p.fermee || maintenant) - p.ouverte) / 1000), 0);
  const corps = { secondes: secondes(enCours.pistes), secondes_voix: secondes(enCours.pistes.filter((p) => p.voix)), analyser: true };
  Object.assign(enCours, { appel: null, pistes: [], fin: false });
  window.removeEventListener('beforeunload', retenir);
  changer({ cloture: false, analyse: appel.id, ...(avis ? { avis } : {}) });
  try {
    const fini = await appeler<{ analyse_redigee: boolean }>(`/appels/${appel.id}/fin`, { methode: 'POST', corps });
    avis ??= fini.analyse_redigee ? { texte: 'Appel analysé.' } : { texte: "Appel enregistré ; l'analyse n'a pas pu se faire.", erreur: true };
  } catch (erreur) {
    avis = { texte: (erreur as Error).message, erreur: true };
  }
  changer({ analyse: null, avis });
  return appel.id;
}
