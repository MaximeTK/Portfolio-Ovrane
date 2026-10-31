'use client';

import { useState } from 'react';
import { appeler } from '../api';
import { cleBrouillon } from '../stockage';
import { useSondage } from './sondage';

// Données de l'Activité, lues sur /vues/activite d'Illusion
export type Sorte = 'envoi' | 'reponse' | 'entretien' | 'relance' | 'offres' | 'afaire';

// Le fil va du plus récent au plus ancien ; un séparateur de jour suit le dernier élément de son jour
export type ElementFil = { id: string; sorte: Sorte; heure: string; phrase: string } | { id: string; jour: string };

export type DonneesActivite = {
  bilan: Record<Sorte, number>;
  fil: ElementFil[];
  // Phrase de l'action en cours (ligne « Maintenant »), null s'il n'y en a pas
  enCours: string | null;
  // Ouvre la vue complète ; sans elle, le lien « Tout voir » n'est pas montré
  toutVoir?: () => void;
  // Le refus d'Illusion, dit dans la fenêtre
  erreur?: string;
  // Lue au moins une fois sur Illusion : ce qui change ensuite s'écrit en glyphes
  lu?: boolean;
};

// Une grosse action telle que la route la rend, sa date en UTC
export type Evenement = { id: string; sorte: Sorte; quand: string; nombre: number; entreprise: string; offre_cle: string; motif: string };
export type ReponseActivite = { bilan: Record<Sorte, number>; fil: Evenement[]; en_cours: { entreprise: string; phase: string } | null };

const VIDE: DonneesActivite = { bilan: { envoi: 0, reponse: 0, entretien: 0, relance: 0, offres: 0, afaire: 0 }, fil: [], enCours: null };

// Les motifs d'un dossier resté à la main, nommés comme dans l'ancien dashboard
const MOTIFS: Record<string, string> = {
  offre_fermee: 'offre retirée', hors_profil: 'hors profil', captcha: 'vérification humaine', compte: 'compte / connexion',
  depot: 'pièce refusée', page_sourde: 'page muette', boucle: 'tourne en rond', plafond_tours: 'plafond de tours', brique: 'brique muette',
};
// Ce que fait la candidature menée, selon sa phase dans Code Candidature
const PHASES: Record<string, string> = { offre: "l'annonce se lit", acces: "l'accès au formulaire s'ouvre", formulaire: 'le formulaire se remplit' };

export function phrase(e: Evenement): string {
  const qui = e.entreprise || "l'employeur";
  switch (e.sorte) {
    case 'envoi': return `Candidature envoyée chez ${qui}.`;
    case 'reponse': return `${e.entreprise || "L'employeur"} a répondu.`;
    case 'entretien': return `Entretien proposé chez ${qui}.`;
    case 'relance': return `Relance envoyée à ${qui}.`;
    case 'offres': return e.nombre > 1 ? `${e.nombre} nouvelles offres.` : '1 nouvelle offre.';
    case 'afaire': return `${e.entreprise || 'Candidature'} : ${MOTIFS[e.motif] ? `${MOTIFS[e.motif]}, ` : ''}à finir à la main.`;
  }
}

export const phraseEnCours = (c: ReponseActivite['en_cours']) =>
  c ? `${c.entreprise || 'Une candidature'}, ${PHASES[c.phase] ?? 'la candidature avance'}` : null;

export const heure = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Minuit à l'heure du poste, `jours` jours plus tôt
export function debutDuJour(jours = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - jours);
  return d;
}

export function nomDuJour(d: Date) {
  const jour = new Date(d);
  jour.setHours(0, 0, 0, 0);
  const ecart = Math.round((debutDuJour().getTime() - jour.getTime()) / 86_400_000);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

// Le fil de la fenêtre : chaque action à son heure locale, un séparateur après le dernier élément de chaque jour
export function avecJours(evenements: Evenement[]): ElementFil[] {
  const fil: ElementFil[] = [];
  evenements.forEach((e, i) => {
    const quand = new Date(e.quand);
    fil.push({ id: e.id, sorte: e.sorte, heure: heure(quand), phrase: phrase(e) });
    const suivant = evenements[i + 1];
    if (!suivant || nomDuJour(new Date(suivant.quand)) !== nomDuJour(quand)) fil.push({ id: `jour-${e.id}`, jour: nomDuJour(quand) });
  });
  return fil;
}

// Le fil depuis `jours` jours, le bilan depuis minuit
export const adresseActivite = (jours: number, limite: number) =>
  `/vues/activite?depuis=${encodeURIComponent(debutDuJour(jours).toISOString())}&jour=${encodeURIComponent(debutDuJour().toISOString())}&limite=${limite}`;

// Dernière lecture, gardée d'une page à l'autre pour le même compte : l'Activité de la page suivante ne repart pas de rien
let gardee: { cle: string; donnees: DonneesActivite } | null = null;

// Hier et aujourd'hui, relus toutes les 5 s comme le bandeau de l'ancien dashboard
export function useActivite(actif = true): DonneesActivite {
  const [donnees, setDonnees] = useState(() => (gardee?.cle === cleBrouillon('activite') ? gardee.donnees : VIDE));
  const garder = (d: DonneesActivite) => {
    gardee = { cle: cleBrouillon('activite'), donnees: d };
    return d;
  };
  useSondage(async () => {
    try {
      const lu = await appeler<ReponseActivite>(adresseActivite(1, 60));
      setDonnees(garder({ bilan: lu.bilan, fil: avecJours(lu.fil), enCours: phraseEnCours(lu.en_cours), lu: true }));
    } catch (e) {
      setDonnees((d) => garder({ ...d, erreur: (e as Error).message }));
    }
  }, 5000, actif);
  return donnees;
}
