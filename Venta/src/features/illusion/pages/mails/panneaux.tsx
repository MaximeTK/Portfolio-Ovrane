'use client';

import { useEffect, useRef, useState } from 'react';
import { appeler, telecharger, televerser } from '../../api';
import { useSondage } from '../../activite/sondage';
import { MarqueAdmin, type Onglet } from '../../dock/Panneau';
import { dateUtc } from '../../partage/FicheOffre';

export type Avis = { texte: string; erreur?: boolean } | null;
export type PieceJointe = { nom: string; type: string; taille: number; telechargeable: boolean };
// Un mail tel que /mails et /mails/fil le rendent
export type MailLu = {
  message_id: string; sens: string; recu_le: string; expediteur: string; destinataire: string; sujet: string; corps: string;
  fil: string; lu: boolean; pieces_jointes: PieceJointe[]; tags: string[]; a_html: boolean; entreprise_siren: string | null;
  offre_cle: string | null; rattachement: string; reponse: string; reponse_erreur: string; a_repondre?: boolean;
};

// Les libellés des tags, et la couleur de chacun : celle du libellé de la boîte (palette de Proton), comme l'ancien dashboard
export const NATURES: Record<string, string> = {
  candidature_recue: 'Candidature reçue', refus: 'Refus', proposition: "Proposition d'embauche", rendez_vous: 'Rendez-vous',
  prise_information: "Prise d'information", inscription: 'Inscription', relance: 'Relance', accuse_reception: 'Accusé',
  absence_bureau: 'Absence du bureau', rebond: 'Rebond (adresse morte)', inutile: 'Inutile', hors_sujet: 'Hors sujet',
  question_recruteur: 'Question du recruteur', indetermine: 'Indéterminé',
};
const COULEURS_NATURE: Record<string, string> = {
  refus: '#BA1E55', rebond: '#C44800', proposition: '#258723', rendez_vous: '#3CBB3A', candidature_recue: '#415DF0',
  inscription: '#179FD9', prise_information: '#A839A4', question_recruteur: '#DB60D6', relance: '#F78400',
  absence_bureau: '#B4A40E', hors_sujet: '#936D58', inutile: '#54473F',
};
export const RATTACHEMENTS: Record<string, string> = {
  ats: 'identifiant ATS lu dans le mail — le plus sûr', domaine: "domaine de l'expéditeur reconnu",
  nom: "nom de l'entreprise dans l'expéditeur ou l'objet", envoi: "écrit d'ici : il porte le rattachement du fil",
  manuel: 'rangé à la main : ni la relève ni « Rattacher » n\'y reviennent', inconnu: 'aucun rapprochement : ni ATS, ni domaine, ni nom connus',
};
// Les natures qu'on pose à la main, en plus de celles que la brique trouve
const NATURES_POSABLES = ['candidature_recue', 'refus', 'proposition', 'rendez_vous', 'prise_information', 'inscription', 'relance', 'inutile'];
// L'ordre de ETIQUETTES_PAR_MOTS (app/services/mails.py)
const MOTS_ETIQUETTES = ['candidature_recue', 'refus', 'proposition', 'rendez_vous', 'prise_information', 'inscription',
  'relance', 'absence_bureau', 'rebond', 'inutile', 'hors_sujet', 'question_recruteur'];
// Le relais refuse un corps de plus de 21 Mo : 15 Mo de fichiers, une fois en base64
const PLAFOND_PIECES = 15 * 1024 * 1024;

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const adresseSeule = (brut: string) => ((/<([^>]+)>/.exec(brut ?? '')?.[1] ?? brut ?? '').trim());
export const nomAffiche = (brut: string) => (brut ?? '').trim().split('<')[0].trim().replace(/^"|"$/g, '') || adresseSeule(brut);
export const formaterDate = (iso: string) => (iso ? dateUtc(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const jourMois = (iso: string) => (iso ? dateUtc(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—');
const poids = (octets: number) => (!octets ? '' : octets < 1024 ? `${octets} o` : octets < 1048576 ? `${Math.round(octets / 1024)} Ko` : `${(octets / 1048576).toFixed(1)} Mo`);
const duree = (s: number) => (!s ? "à l'instant" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
export const ICONES = {
  chevron: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>,
  loupe: <svg {...TRAIT}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg>,
  tag: <svg {...TRAIT}><path d="M3 3h8l10 10-8 8L3 11z" /><path d="M7.5 7.5h.01" /></svg>,
  supprimer: <svg {...TRAIT}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  reglages: <svg {...TRAIT}><polygon points="22.3,10.2 22.3,13.8 19.4,13.8 18.5,15.9 20.6,18.0 18.0,20.6 15.9,18.5 13.8,19.4 13.8,22.3 10.2,22.3 10.2,19.4 8.1,18.5 6.0,20.6 3.4,18.0 5.5,15.9 4.6,13.8 1.7,13.8 1.7,10.2 4.6,10.2 5.5,8.1 3.4,6.0 6.0,3.4 8.1,5.5 10.2,4.6 10.2,1.7 13.8,1.7 13.8,4.6 15.9,5.5 18.0,3.4 20.6,6.0 18.5,8.1 19.4,10.2" /><circle cx="12" cy="12" r="3" /></svg>,
  plus: <svg {...TRAIT} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>,
  rattacher: <svg {...TRAIT}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>,
  vider: <svg {...TRAIT}><path d="M3 13h5l1.5 3h5l1.5-3h5" /><path d="M5 5h14l2 8v6H3v-6z" /></svg>,
  executer: <svg {...TRAIT}><path d="m4 17 6-5-6-5M12 19h8" /></svg>,
  trombone: <svg {...TRAIT}><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" /></svg>,
  fiche: <svg {...TRAIT}><rect x="3" y="7" width="18" height="13" /><path d="M9 7V4h6v3M3 13h18" /></svg>,
  offre: <svg {...TRAIT}><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>,
  reecrire: <svg {...TRAIT}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>,
  fleche: <svg {...TRAIT} strokeWidth={2.6}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  valider: <svg {...TRAIT} strokeWidth={2.6}><path d="M5 12l5 5L20 7" /></svg>,
};

// Un tag : la pastille carrée de sa couleur, puis son nom
export function Nature({ tag }: { tag: string }) {
  return <span className="nat" style={{ '--n': COULEURS_NATURE[tag] ?? 'rgb(255 255 255 / .5)' } as React.CSSProperties}>{NATURES[tag] ?? tag}</span>;
}

type PieceEnvoi = { nom: string; contenu: string; taille: number };
type Depart = { destinataire: string; sujet: string; corps: string; repond_a: string };

// Le formulaire d'envoi, partagé par Répondre et Nouveau message : ses champs vont dans le corps, Joindre et Envoyer dans le pied
function useEnvoi({ id, cle, depart, titre, aide, setAvis, apres }: {
  id: string; cle: string; depart: Depart; titre?: string; aide?: string; setAvis: (a: Avis) => void; apres: () => void;
}) {
  const [destinataire, setDestinataire] = useState(depart.destinataire);
  const [sujet, setSujet] = useState(depart.sujet);
  const [corps, setCorps] = useState(depart.corps);
  const [liste, setListe] = useState<PieceEnvoi[]>([]);
  const [occupe, setOccupe] = useState(false);
  const pieces = useRef<PieceEnvoi[]>([]);
  const attente = useRef(0);
  const lecture = useRef<Promise<void>>(Promise.resolve());
  const fichiers = useRef<HTMLInputElement>(null);
  const { destinataire: d0, sujet: s0, corps: c0 } = depart;
  // Un autre fil, un brouillon réécrit ou un envoi fait : le formulaire repart de ce qu'il propose
  useEffect(() => {
    setDestinataire(d0);
    setSujet(s0);
    setCorps(c0);
    pieces.current = [];
    setListe([]);
  }, [cle, d0, s0, c0]);
  const poser = (p: PieceEnvoi[]) => {
    pieces.current = p;
    setListe(p);
  };
  // Les fichiers se lisent dans le navigateur ; au-delà de 15 Mo au total, le relais refuserait l'envoi : on le dit tout de suite
  const joindre = (choisis: File[]) => {
    let total = pieces.current.reduce((s, p) => s + p.taille, 0) + attente.current;
    const retenus: File[] = [], refuses: string[] = [];
    for (const f of choisis) {
      if (total + f.size > PLAFOND_PIECES) refuses.push(f.name);
      else {
        total += f.size;
        retenus.push(f);
      }
    }
    if (refuses.length) setAvis({ texte: `${refuses.join(', ')} : pas joint${refuses.length > 1 ? 's' : ''}, les pièces dépasseraient 15 Mo au total, au-delà de ce que le relais accepte.`, erreur: true });
    attente.current += retenus.reduce((s, f) => s + f.size, 0);
    lecture.current = lecture.current.then(async () => {
      for (const f of retenus) {
        try {
          poser([...pieces.current, { ...(await televerser(f)), taille: f.size }]);
        } catch (e) {
          setAvis({ texte: message(e), erreur: true });
        } finally {
          attente.current -= f.size;
        }
      }
    });
  };
  // L'envoi attend la lecture des fichiers : un clic juste après le choix ne part pas sans ses pièces
  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (occupe) return;
    setOccupe(true);
    try {
      await lecture.current;
      if (!corps.trim()) {
        setAvis({ texte: 'Le message est vide.', erreur: true });
        return;
      }
      const r = await appeler<{ mail: { destinataire: string } }>('/mails/envoyer', {
        methode: 'POST', corps: { destinataire: destinataire.trim(), sujet: sujet.trim(), corps, repond_a: depart.repond_a, pieces: pieces.current.map(({ nom, contenu }) => ({ nom, contenu })) },
      });
      setAvis({ texte: `Envoyé à ${r.mail.destinataire}.` });
      apres();
    } catch (err) {
      setAvis({ texte: message(err), erreur: true });
    } finally {
      setOccupe(false);
    }
  };
  const champs = (
    <form id={id} className={titre ? 'section-f repondre' : undefined} onSubmit={(e) => void envoyer(e)}>
      {titre && <h3>{titre}</h3>}
      {aide && <p className="aide-champ">{aide}</p>}
      <div className="grille-2 dest-objet">
        <div className="champ"><label htmlFor={`${id}-dest`}>Destinataire</label>
          <input id={`${id}-dest`} className="saisie" type="email" required placeholder="rh@exemple.fr" value={destinataire} onChange={(e) => setDestinataire(e.target.value)} /></div>
        <div className="champ"><label htmlFor={`${id}-objet`}>Objet</label>
          <input id={`${id}-objet`} className="saisie" value={sujet} onChange={(e) => setSujet(e.target.value)} /></div>
      </div>
      <div className="champ"><label htmlFor={`${id}-message`}>Message</label>
        <textarea id={`${id}-message`} className="saisie" rows={9} value={corps} onChange={(e) => setCorps(e.target.value)} /></div>
      {liste.length > 0 && (
        <p className="pieces">
          {liste.map((p, rang) => (
            <span key={`${rang}-${p.nom}`} className="piece" title={p.nom}>{ICONES.trombone}{p.nom}<small>{poids(p.taille)}</small>
              <button type="button" className="retirer" aria-label={`Retirer ${p.nom}`} onClick={() => poser(pieces.current.filter((_, i) => i !== rang))}>×</button></span>
          ))}
        </p>
      )}
      <input ref={fichiers} type="file" multiple hidden onChange={(e) => {
        joindre([...(e.target.files ?? [])]);
        e.target.value = '';
      }} />
    </form>
  );
  const pied = (
    <>
      <button type="button" className="action gauche" onClick={() => fichiers.current?.click()}><span className="ico">{ICONES.trombone}</span>Joindre un fichier</button>
      <button type="submit" form={id} className="action plein" disabled={occupe}>{occupe ? 'Envoi…' : 'Envoyer'}<span className="ico">{ICONES.fleche}</span></button>
    </>
  );
  return { champs, pied };
}

// Le corps mis en page d'un mail : lu en texte puis posé en srcdoc d'un cadre qui n'exécute rien, jamais injecté dans la page
function CorpsHtml({ id, sujet }: { id: string; sujet: string }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    let vivant = true;
    appeler<string>(`/mails/html?mail=${encodeURIComponent(id)}`)
      .then((t) => vivant && setHtml(String(t)))
      .catch((e) => vivant && setHtml(`<p style="font:13px system-ui">${message(e).replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</p>`));
    return () => {
      vivant = false;
    };
  }, [id]);
  return <iframe className="corps-html" title={sujet || 'Mail'} sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={html} />;
}

function Message({ m, replie }: { m: MailLu; replie: boolean }) {
  const corps = m.a_html ? <CorpsHtml id={m.message_id} sujet={m.sujet} /> : <p className="msg-corps">{m.corps}</p>;
  // Une pièce dont le fichier n'est pas gardé, celle d'un mail parti à la main, se lit sans se télécharger
  const pieces = m.pieces_jointes.length > 0 && (
    <p className="pieces">
      {m.pieces_jointes.map((p, rang) => {
        const dedans = <>{ICONES.trombone}{p.nom}{p.taille > 0 && <small>{poids(p.taille)}</small>}</>;
        return p.telechargeable === false
          ? <span key={rang} className="piece" title="Jointe depuis le client de messagerie : le fichier n'est pas conservé ici.">{dedans}</span>
          : <button key={rang} type="button" className="piece" title={`Télécharger ${p.nom}`}
              onClick={() => void telecharger(`/mails/piece?mail=${encodeURIComponent(m.message_id)}&index=${rang}`)}>{dedans}</button>;
      })}
    </p>
  );
  const nom = <b>{nomAffiche(m.expediteur) || '—'}</b>, quand = <time>{formaterDate(m.recu_le)}</time>;
  const vers = `→ ${adresseSeule(m.destinataire) || '—'}`;
  return (
    <li className={`msg${m.sens === 'sortant' ? ' envoye' : ''}`}>
      {replie ? (
        <details>
          <summary className="msg-tete">{nom}<span className="d">{m.sujet || '(sans objet)'}</span>{quand}</summary>
          <p className="msg-objet">{vers}</p>{corps}{pieces}
        </details>
      ) : (
        <>
          <p className="msg-tete">{nom}<span className="d">{vers}</span>{quand}</p>
          <p className="msg-objet">{m.sujet || '(sans objet)'}</p>{corps}{pieces}
        </>
      )}
    </li>
  );
}

type Rattachable = { cle: string; titre: string; entreprise: string; statut: string; date: string };

// Fil · <entreprise> : l'échange entier, l'offre où il est rangé, et la réponse au dernier mail reçu
export function useOngletFil({ filId, setAvis, relire, voirFiche, voirOffre, fermer }: {
  filId: string | null; setAvis: (a: Avis) => void; relire: () => void; voirFiche: (siren: string) => void; voirOffre: (cle: string) => void; fermer: () => void;
}): Onglet {
  const [lu, setLu] = useState<{ id: string; fil: MailLu[]; offres: Rattachable[] } | null>(null);
  const [erreur, setErreur] = useState('');
  const [tour, setTour] = useState(0);
  const [occupe, setOccupe] = useState(false);
  const relireListe = useRef(relire);
  useEffect(() => {
    relireListe.current = relire;
  });
  useEffect(() => {
    if (!filId) return;
    let vivant = true;
    setErreur('');
    // La liste des offres manque : le fil se lit quand même, il ne se range simplement pas d'ici
    Promise.all([appeler<{ fil: MailLu[] }>(`/mails/fil/${encodeURIComponent(filId)}`), appeler<Rattachable[]>('/mails/offres').catch(() => [])])
      .then(([f, offres]) => {
        if (!vivant) return;
        setLu({ id: filId, fil: f.fil, offres });
        setErreur('');
        // Ouvrir le fil le marque lu : la liste le dit aussitôt
        relireListe.current();
      })
      .catch((e) => vivant && setErreur(message(e)));
    return () => {
      vivant = false;
    };
  }, [filId, tour]);
  const fil = lu && lu.id === filId ? lu.fil : [];
  const racine = fil[0], dernier = fil[fil.length - 1];
  // On répond au dernier mail REÇU ; un brouillon qui attend sur un mail plus ancien passe devant
  const dernierRecu = [...fil].reverse().find((m) => m.sens === 'entrant');
  const aRelire = [...fil].reverse().find((m) => m.sens === 'entrant' && m.reponse) ?? dernierRecu;
  const offres = lu?.offres ?? [];
  const entreprise = offres.find((o) => o.cle === racine?.offre_cle)?.entreprise || (dernierRecu ? nomAffiche(dernierRecu.expediteur) : '') || racine?.sujet;
  const envoi = useEnvoi({
    id: 'fil-envoi', cle: `${filId}|${aRelire?.message_id ?? ''}`, setAvis, titre: 'Répondre',
    depart: {
      destinataire: aRelire ? adresseSeule(aRelire.expediteur) : '', corps: aRelire?.reponse ?? '', repond_a: aRelire?.message_id ?? '',
      sujet: aRelire ? (aRelire.sujet?.startsWith('Re: ') ? aRelire.sujet : `Re: ${aRelire.sujet ?? ''}`) : '',
    },
    aide: aRelire?.reponse ? "Ce brouillon a été rédigé d'avance. Relisez-le : c'est ce texte-là qui partira."
      : aRelire?.reponse_erreur ? `Aucun brouillon : ${aRelire.reponse_erreur}` : '',
    apres: () => {
      fermer();
      relire();
    },
  });
  const rediger = async () => {
    if (!dernierRecu) return;
    setOccupe(true);
    try {
      const r = await appeler<{ redige: boolean; erreur: string }>(`/mails/brouillon/${encodeURIComponent(dernierRecu.message_id)}`, { methode: 'POST' });
      setAvis(!r.redige ? { texte: "Rien à rédiger : ni demande d'informations, ni refus d'une adresse qui lit ses réponses.", erreur: true }
        : r.erreur ? { texte: `Brouillon non rédigé : ${r.erreur}`, erreur: true } : { texte: "Brouillon rédigé : relisez-le, rien n'est parti." });
      setTour((t) => t + 1);
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    } finally {
      setOccupe(false);
    }
  };
  const ranger = async (cle: string) => {
    try {
      const r = await appeler<{ mails: number }>('/mails/fil/offre', { methode: 'POST', corps: { message_id: filId, offre_cle: cle } });
      setAvis({ texte: cle ? `${r.mails} mail(s) du fil rattaché(s) à l'offre choisie.` : `${r.mails} mail(s) du fil détaché(s) : il n'est plus sur aucune offre.` });
      setTour((t) => t + 1);
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    }
  };
  const connue = offres.some((o) => o.cle === racine?.offre_cle);
  const corps = erreur ? (
    <>
      <p className="texte-f erreur-f" role="alert">{erreur}</p>
      <button type="button" className="action" onClick={() => setTour((t) => t + 1)}><span className="ico">{ICONES.reecrire}</span>Relire le fil</button>
    </>
  ) : !racine ? <p className="texte-f">Lecture du fil…</p> : (
    <>
      <p className="meta-f">
        {pluriel(fil.length, 'message')} · <span title={RATTACHEMENTS[racine.rattachement] ?? ''}>{racine.rattachement}</span>
        {dernier.tags.length > 0 && <> · {dernier.tags.map((t) => <Nature key={t} tag={t} />)}</>}
      </p>
      <div className="actions actions-f">
        {racine.entreprise_siren && <button type="button" className="action" aria-haspopup="dialog" onClick={() => voirFiche(racine.entreprise_siren!)}><span className="ico">{ICONES.fiche}</span>Voir la fiche</button>}
        {racine.offre_cle && <button type="button" className="action" aria-haspopup="dialog" onClick={() => voirOffre(racine.offre_cle!)}><span className="ico">{ICONES.offre}</span>Voir l&apos;offre</button>}
        {dernierRecu?.a_repondre && (
          <button type="button" className="action" disabled={occupe} title="Le modèle écrit la réponse au dernier mail reçu ; elle attend ici, rien ne part." onClick={() => void rediger()}>
            <span className="ico">{ICONES.reecrire}</span>{occupe ? 'Rédaction…' : dernierRecu.reponse ? 'Réécrire le brouillon' : 'Rédiger le brouillon'}
          </button>
        )}
      </div>
      <div className="champ">
        <label htmlFor="fil-offre" title="Tout le fil suit : ses mails passent sur l'offre choisie, ou sur aucune.">Offre du fil</label>
        <select id="fil-offre" className="saisie" value={racine.offre_cle ?? ''} onChange={(e) => void ranger(e.target.value)}>
          <option value="">— aucune (fil détaché) —</option>
          {racine.offre_cle && !connue && <option value={racine.offre_cle}>offre actuelle</option>}
          {offres.map((o) => <option key={o.cle} value={o.cle}>{`${o.entreprise || '—'} — ${o.titre || '(sans intitulé)'} · ${jourMois(o.date)}`}</option>)}
        </select>
      </div>
      <ol className="messages-fil">
        {fil.map((m, rang) => <Message key={m.message_id} m={m} replie={rang < fil.length - 1} />)}
      </ol>
      {aRelire ? envoi.champs : <p className="texte-f repondre">Ce fil ne contient aucun message reçu : il n&apos;y a personne à qui répondre.</p>}
    </>
  );
  return {
    cle: 'fil', titre: `Fil · ${entreprise || '…'}`, label: `Fil · ${racine?.sujet || '(sans objet)'}`,
    corps, pied: aRelire ? envoi.pied : undefined,
  };
}

// Étiqueter N mails : des tags posés, retirés ou remplacés sur la sélection
export function useOngletEtiqueter({ selection, setAvis, relire, fermer }: { selection: Set<string>; setAvis: (a: Avis) => void; relire: () => void; fermer: () => void }): Onglet {
  const [coches, setCoches] = useState<Set<string>>(() => new Set());
  const [libres, setLibres] = useState('');
  const [mode, setMode] = useState('ajouter');
  const [occupe, setOccupe] = useState(false);
  const appliquer = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = [...coches, ...libres.split(',').map((t) => t.trim())].filter(Boolean);
    if (!tags.length && mode !== 'remplacer') {
      setAvis({ texte: 'Aucun tag indiqué.', erreur: true });
      return;
    }
    setOccupe(true);
    try {
      const r = await appeler<{ touches: number }>('/mails/etiquettes', { methode: 'POST', corps: { identifiants: [...selection], tags, mode } });
      setAvis({ texte: `${r.touches} mail(s) réétiqueté(s).` });
      setCoches(new Set());
      setLibres('');
      fermer();
      relire();
    } catch (err) {
      setAvis({ texte: message(err), erreur: true });
    } finally {
      setOccupe(false);
    }
  };
  const n = selection.size;
  return {
    cle: 'etiqueter', titre: 'Étiqueter', label: `Étiqueter ${pluriel(n, 'mail')}`,
    corps: (
      <form id="etiqueter-f" onSubmit={(e) => void appliquer(e)}>
        <p className="aide-champ">Les tags servent au classement : un mail peut en porter plusieurs.</p>
        <div className="tags-f" role="group" aria-label="Tags">
          {NATURES_POSABLES.map((t) => (
            <label key={t} className="choix tag-f">
              <input type="checkbox" className="cache" checked={coches.has(t)} onChange={(e) => {
                const s = new Set(coches);
                if (e.target.checked) s.add(t);
                else s.delete(t);
                setCoches(s);
              }} />
              <Nature tag={t} />
            </label>
          ))}
        </div>
        <div className="champ"><label htmlFor="tags-libres">Autres tags</label>
          <input id="tags-libres" className="saisie" placeholder="urgent, à relancer…" value={libres} onChange={(e) => setLibres(e.target.value)} /></div>
        <div className="champ"><span className="lib-champ">Mode</span>
          <div className="modes-f" role="radiogroup" aria-label="Mode">
            {[['ajouter', 'Ajouter'], ['retirer', 'Retirer'], ['remplacer', 'Remplacer tout']].map(([v, nom]) => (
              <label key={v} className="choix mode-f"><input type="radio" name="mode-tags" className="cache" checked={mode === v} onChange={() => setMode(v)} />{nom}</label>
            ))}
          </div>
        </div>
      </form>
    ),
    pied: (
      <>
        <button type="button" className="action" onClick={fermer}>Annuler</button>
        <button type="submit" form="etiqueter-f" className="action plein" disabled={occupe || !n}>Appliquer<span className="ico">{ICONES.fleche}</span></button>
      </>
    ),
  };
}

// Nouveau message : un mail neuf, hors de tout fil, depuis l'adresse des candidatures
export function useOngletEcrire({ adresse, setAvis, apres }: { adresse: string; setAvis: (a: Avis) => void; apres: () => void }): Onglet {
  const [envois, setEnvois] = useState(0);
  const envoi = useEnvoi({
    id: 'nouveau-envoi', cle: `nouveau-${envois}`, setAvis, depart: { destinataire: '', sujet: '', corps: '', repond_a: '' },
    apres: () => {
      setEnvois((n) => n + 1);
      apres();
    },
  });
  return {
    cle: 'ecrire', titre: 'Écrire', label: 'Nouveau message',
    corps: (
      <>
        <p className="meta-f">{adresse ? `Depuis ${adresse}` : 'Aucune adresse réglée : voyez les Réglages.'}</p>
        {envoi.champs}
      </>
    ),
    pied: envoi.pied,
  };
}

// Réglages · Mails : la brique Mail du compte ; le Modèle n'est qu'à l'admin
type Champ = { cle: string; libelle: string; sorte?: 'nombre' | 'inter' | 'secret' | 'modele'; aide?: string; infobulle?: string; admin?: boolean };
const BOITE: (Champ | [Champ, Champ])[] = [
  { cle: 'mail_adresse', libelle: 'Identifiant du Bridge', aide: "L'adresse principale du compte : c'est elle qui ouvre la boîte, où le Bridge range TOUTES vos adresses." },
  { cle: 'mail_candidat', libelle: 'Adresse des candidatures', infobulle: "Celle des CV. Seuls les mails arrivés à elle — ou partis d'elle — sont suivis, et les réponses partent d'elle. Vide : toute la boîte." },
  { cle: 'mail_secret', libelle: 'Mot de passe IMAP', sorte: 'secret', aide: 'Celui GÉNÉRÉ PAR LE BRIDGE, jamais celui du compte.' },
  [{ cle: 'mail_imap_hote', libelle: 'Hôte IMAP' }, { cle: 'mail_imap_port', libelle: 'Port IMAP', sorte: 'nombre' }],
  [{ cle: 'mail_dossier', libelle: 'Dossier relevé' }, { cle: 'mail_timeout_secondes', libelle: 'Timeout (s)', sorte: 'nombre' }],
  { cle: 'mail_dossier_envoyes', libelle: 'Dossier des envoyés', infobulle: "Relevé lui aussi : un mail écrit depuis votre client de messagerie ouvre un fil dont la suite arrive ici. Vide : demandé au serveur (« Sent », « Envoyés »…)." },
  { cle: 'mail_fenetre_jours', libelle: 'Première relève (jours)', sorte: 'nombre', infobulle: 'De combien de jours on remonte au PREMIER passage sur un dossier. Ensuite la relève reprend au curseur, quel que soit le temps écoulé.' },
  [{ cle: 'mail_smtp_hote', libelle: 'Hôte SMTP', infobulle: 'Par où les mails partent — le Bridge, lui aussi local.' }, { cle: 'mail_smtp_port', libelle: 'Port SMTP', sorte: 'nombre' }],
];
const REPONSES: Champ[] = [
  { cle: 'mail_reponses', libelle: 'Rédiger les réponses', sorte: 'inter', infobulle: "Demandes d'informations et refus d'une adresse qui lit ses réponses : le brouillon attend d'être relu dans le fil, il ne part pas tout seul. Désactivé : étiquetage seul, sans tokens." },
  { cle: 'mail_modele', libelle: 'Modèle', sorte: 'modele', admin: true, aide: 'Un des modèles définis en haut des Paramètres.' },
  { cle: 'mail_signature', libelle: 'Signature', infobulle: 'Reprise à la fin des brouillons rédigés. Vide : aucune.' },
  { cle: 'mail_relance_jours', libelle: 'Relancer après (jours)', sorte: 'nombre', infobulle: "Une candidature restée sans nouvelles N jours reçoit un brouillon de relance, deux au plus, jamais vers un no-reply. 0 : aucune relance." },
];
const BOITE_REELLE: Champ[] = [
  { cle: 'mail_synchro_boite', libelle: 'Synchroniser avec la boîte', sorte: 'inter', infobulle: "Les tags du dashboard se posent aussi dans la vraie boîte, et ce que vous y changez revient ici, tant que l'écoute tourne. Prend effet au prochain démarrage de l'écoute." },
  { cle: 'mail_supprimer_inutiles', libelle: 'Jeter les mails inutiles', sorte: 'inter', infobulle: "Une fois par jour, les mails tagués « Inutile » partent à la corbeille de la vraie boîte, puis quittent le dashboard." },
  { cle: 'mail_preparation', libelle: 'Préparer les entretiens', sorte: 'inter', infobulle: "Un mail qui propose un rendez-vous fait rédiger la préparation de l'entretien, à lire dans la fiche de l'offre." },
];
type Parametres = Record<string, unknown> & { modeles?: { nom: string; modele?: string }[]; mail_mots_etiquettes?: Record<string, string[]> };
const texteMots = (mots?: Record<string, string[]>) => Object.fromEntries(MOTS_ETIQUETTES.map((t) => [t, (mots?.[t] ?? []).join(', ')]));

export function useOngletReglages({ admin, actif, fermer, setAvis, relire }: { admin: boolean; actif: boolean; fermer: () => void; setAvis: (a: Avis) => void; relire: () => void }): Onglet {
  const [lus, setLus] = useState<Parametres | null>(null);
  const [valeurs, setValeurs] = useState<Record<string, unknown>>({});
  const [mots, setMots] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const reprendre = (p: Parametres) => {
    setLus(p);
    setValeurs(p);
    setMots(texteMots(p.mail_mots_etiquettes));
    setSecret(null);
  };
  // Relus à chaque ouverture : un autre onglet a pu les changer
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    appeler<Parametres>('/parametres').then((p) => {
      if (!vivant) return;
      reprendre(p);
      setErreur('');
    }).catch((e) => vivant && setErreur(message(e)));
    return () => {
      vivant = false;
    };
  }, [actif]);
  const champs = [...BOITE.flat(), ...REPONSES, ...BOITE_REELLE].filter((c) => c.sorte !== 'secret' && (admin || !c.admin));
  const changes: Record<string, unknown> = {};
  if (lus) {
    for (const c of champs) if (valeurs[c.cle] !== lus[c.cle]) changes[c.cle] = c.sorte === 'nombre' ? Number(valeurs[c.cle]) : valeurs[c.cle];
    const avant = texteMots(lus.mail_mots_etiquettes);
    if (MOTS_ETIQUETTES.some((t) => mots[t] !== avant[t])) {
      changes.mail_mots_etiquettes = Object.fromEntries(MOTS_ETIQUETTES.map((t) => [t, (mots[t] ?? '').split(',').map((m) => m.trim()).filter(Boolean)]));
    }
    // Un secret ne part que tapé ou effacé : vide, le champ garde celui déjà enregistré
    if (secret !== null) changes.mail_secret = secret;
  }
  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Object.keys(changes).length) return;
    setOccupe(true);
    try {
      const r = await appeler<Parametres & { rejeu_mails?: number }>('/parametres', { methode: 'PUT', corps: changes });
      reprendre(r);
      setAvis({ texte: `Réglages enregistrés${r.rejeu_mails ? ` — ${r.rejeu_mails} mail(s) réétiqueté(s) par mots-clés` : ''}.` });
      relire();
    } catch (err) {
      setAvis({ texte: message(err), erreur: true });
    } finally {
      setOccupe(false);
    }
  };
  const champ = (c: Champ) => {
    const id = `rm-${c.cle}`;
    const marque = c.admin && <MarqueAdmin />;
    if (c.sorte === 'inter') {
      return (
        <label key={c.cle} className="inter" title={c.infobulle}>{c.libelle}
          <input type="checkbox" checked={!!valeurs[c.cle]} onChange={(e) => setValeurs({ ...valeurs, [c.cle]: e.target.checked })} /></label>
      );
    }
    let saisie: React.ReactNode;
    if (c.sorte === 'secret') {
      const enregistre = !!lus?.[c.cle];
      saisie = (
        <span className="secret-f">
          <input id={id} className="saisie" type="password" autoComplete="new-password" value={secret ?? ''}
            placeholder={secret === '' && enregistre ? "effacé à l'enregistrement" : enregistre ? 'enregistrée' : 'non renseignée'}
            title={enregistre ? 'Enregistré : tapez une valeur pour le remplacer.' : undefined} onChange={(e) => setSecret(e.target.value || null)} />
          {enregistre && secret === null && <button type="button" className="action" title="Retire ce secret à l'enregistrement." onClick={() => setSecret('')}>Effacer</button>}
        </span>
      );
    } else if (c.sorte === 'modele') {
      saisie = (
        <select id={id} className="saisie" value={String(valeurs[c.cle] ?? '')} onChange={(e) => setValeurs({ ...valeurs, [c.cle]: e.target.value })}>
          <option value="">Aucun</option>
          {(lus?.modeles ?? []).map((m) => <option key={m.nom} value={m.nom}>{m.modele ? `${m.nom} · ${m.modele}` : m.nom}</option>)}
        </select>
      );
    } else {
      saisie = (
        <input id={id} className="saisie" type={c.sorte === 'nombre' ? 'number' : 'text'} min={c.sorte === 'nombre' ? 0 : undefined}
          value={String(valeurs[c.cle] ?? '')} onChange={(e) => setValeurs({ ...valeurs, [c.cle]: e.target.value })} />
      );
    }
    return (
      <div key={c.cle} className="champ"><label htmlFor={id} title={c.infobulle}>{c.libelle}{marque}</label>{saisie}{c.aide && <p className="aide-champ">{c.aide}</p>}</div>
    );
  };
  const visibles = (liste: Champ[]) => liste.filter((c) => admin || !c.admin).map(champ);
  return {
    cle: 'reglages', titre: 'Réglages', label: 'Réglages · Mails',
    corps: erreur ? <p className="texte-f erreur-f" role="alert">{erreur}</p> : !lus ? <p className="texte-f">Lecture des réglages…</p> : (
      <form id="reglages-mails" onSubmit={(e) => void enregistrer(e)}>
        <div className="section-f"><h3>Boîte</h3>
          {BOITE.map((c) => (Array.isArray(c) ? <div key={c[0].cle} className="grille-2">{c.map(champ)}</div> : champ(c)))}
        </div>
        <div className="section-f"><h3>Réponses</h3>{visibles(REPONSES)}</div>
        <div className="section-f"><h3>Boîte réelle</h3>{visibles(BOITE_REELLE)}</div>
        <div className="section-f mots-f"><h3>Tri par mots-clés</h3>
          <p className="aide-champ">Un mot lu dans l&apos;objet ou le corps d&apos;un mail reçu lui pose ce tag d&apos;office, sans appeler le modèle.</p>
          <div className="grille-2">
            {MOTS_ETIQUETTES.map((t) => (
              <div key={t} className="champ" style={{ '--n': COULEURS_NATURE[t] } as React.CSSProperties}>
                <label htmlFor={`mk-${t}`}>{NATURES[t]}</label>
                <input id={`mk-${t}`} className="saisie" placeholder="mots séparés par des virgules" value={mots[t] ?? ''} onChange={(e) => setMots({ ...mots, [t]: e.target.value })} />
              </div>
            ))}
          </div>
        </div>
      </form>
    ),
    pied: (
      <>
        <button type="button" className="action" onClick={() => {
          if (lus) reprendre(lus);
          fermer();
        }}>Annuler</button>
        <button type="submit" form="reglages-mails" className="action plein" disabled={occupe || !Object.keys(changes).length}>Enregistrer<span className="ico">{ICONES.valider}</span></button>
      </>
    ),
  };
}

// Brique Mail · exécuter (admin) : un lancement à la main, en mode test par l'atelier, sinon par le pipeline
type Argument = { cle: string; libelle: string; type: string; aide: string; valeur: unknown; details: { valeur: string; libelle: string; texte: string }[] };
type Course = { en_cours: boolean; journal: string; ok: boolean | null; erreur: string; depuis_s: number; duree_s: number };

export function useOngletExecuter({ actif, fermer, setAvis }: { actif: boolean; fermer: () => void; setAvis: (a: Avis) => void }): Onglet {
  const [args, setArgs] = useState<Argument[] | null>(null);
  const [valeurs, setValeurs] = useState<Record<string, unknown>>({});
  const [test, setTest] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    if (!actif || args) return;
    appeler<{ nom: string; arguments: Argument[]; etat: Course }[]>('/atelier').then((briques) => {
      const mail = briques.find((b) => b.nom === 'mail');
      if (!mail) throw new Error('Brique Mail absente du serveur.');
      setArgs(mail.arguments);
      setValeurs(Object.fromEntries(mail.arguments.map((a) => [a.cle, a.valeur])));
      setCourse(mail.etat);
    }).catch((e) => setErreur(message(e)));
  }, [actif, args]);
  // Le lancement se suit toutes les 1,5 s tant qu'il tourne, comme l'atelier de l'ancien dashboard
  useSondage(async () => {
    try {
      setCourse(await appeler<Course>('/atelier/mail'));
    } catch {
      /* le prochain tour réessaie */
    }
  }, 1500, actif && !!course?.en_cours);
  const lancer = async () => {
    try {
      if (course?.en_cours) {
        const r = await appeler<{ arretee: boolean }>('/atelier/mail/arreter', { methode: 'POST' });
        setAvis(r.arretee ? { texte: "Brique tuée — ce qu'elle avait dit reste affiché." } : { texte: 'Aucun lancement en cours.', erreur: true });
      } else if (!test) {
        // Hors mode test, le pipeline lance la brique : sa sortie va au journal et le résultat est écrit en base
        const r = await appeler<{ lancee: boolean }>('/briques/mail/lancer', { methode: 'POST' });
        setAvis(r.lancee ? { texte: 'Brique mail lancée par le pipeline — le résultat est écrit en base, suivez le journal.' } : { texte: 'Brique mail déjà en cours.', erreur: true });
        return;
      } else {
        const r = await appeler<{ lancee: boolean; etat: Course }>('/atelier/mail', { methode: 'POST', corps: { valeurs } });
        setAvis(r.lancee ? { texte: 'Test lancé — rien ne sera écrit en base.' } : { texte: 'Brique mail déjà lancée depuis ici : attendez-la, ou arrêtez-la.', erreur: true });
      }
      setCourse(await appeler<Course>('/atelier/mail'));
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    }
  };
  const commande = args?.find((a) => a.type === 'commande');
  const booleens = args?.filter((a) => a.type === 'booleen') ?? [];
  const badge = !course || (!course.en_cours && course.ok == null) ? null
    : course.en_cours ? <span className="lancement en-cours">en cours · {duree(course.depuis_s)}</span>
      : course.ok ? <span className="lancement">terminée en {duree(course.duree_s)}</span>
        : <span className="lancement echec">en échec — {course.erreur || 'voir le journal du serveur'}</span>;
  return {
    cle: 'executer', titre: 'Exécuter', admin: true, label: 'Brique Mail · exécuter',
    corps: erreur ? <p className="texte-f erreur-f" role="alert">{erreur}</p> : !args ? <p className="texte-f">Lecture de la brique…</p> : (
      <>
        {commande && (
          <div className="section-f">
            <div className="champ"><span className="lib-champ">{commande.libelle}<MarqueAdmin /></span>
              <div className="commandes-f" role="radiogroup" aria-label={commande.libelle}>
                {commande.details.map((d) => (
                  <label key={d.valeur} className="choix commande-f">
                    <input type="radio" name="commande-mail" className="cache" checked={valeurs[commande.cle] === d.valeur} onChange={() => setValeurs({ ...valeurs, [commande.cle]: d.valeur })} />
                    <code>{d.libelle}</code><span>{d.texte}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="section-f">
          {booleens.map((a) => (
            <div key={a.cle}>
              <label className="inter"><span>{a.libelle}<MarqueAdmin /></span>
                <input type="checkbox" checked={!!valeurs[a.cle]} onChange={(e) => setValeurs({ ...valeurs, [a.cle]: e.target.checked })} /></label>
              {a.aide && <p className="aide-champ">{a.aide}</p>}
            </div>
          ))}
          <label className="inter"><span>Mode test<MarqueAdmin /></span><input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} /></label>
          <p className="aide-champ">Coché : la brique tourne, sa sortie s&apos;affiche ici, et RIEN n&apos;est écrit en base. Décoché : le lancement passe par le pipeline et le résultat est conservé.</p>
        </div>
        {badge && (
          <div className="section-f sortie-brique">
            <p className="meta-f">{badge}</p>
            {course?.journal && <pre className="sortie-f">{course.journal}</pre>}
          </div>
        )}
      </>
    ),
    pied: (
      <>
        <button type="button" className="action" onClick={fermer}>Annuler</button>
        <button type="button" className="action plein" disabled={!args} onClick={() => void lancer()}>{course?.en_cours ? 'Arrêter' : 'Exécuter'}<span className="ico">{ICONES.fleche}</span></button>
      </>
    ),
  };
}
