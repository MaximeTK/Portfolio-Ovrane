'use client';

import { useEffect, useRef, useState } from 'react';
import type { Onglet } from '../../dock/Panneau';

// Un compte d'une plateforme tel que /parametres le rend : le mot de passe dit seulement s'il est enregistré
export type Identifiant = { site: string; identifiant: string; secret: boolean; actif: boolean };
export type Ligne = { uid: number; site: string; identifiant: string; actif: boolean; enregistre: boolean; saisie: string; effacer: boolean };
export type Essai = { site: string; en_cours: boolean; ok: boolean | null; detail: string; identifiant: string; depuis_s: number; duree_s: number; teste_le: string };

//: Le compte « tout site » : celui qui vaut partout, épinglé en tête
export const SITE_GLOBAL = '*';
const AIDE_GLOBAL = "Le compte « tout site » : son identifiant sert là où aucun compte propre n'est posé. Il ne se retire pas.";
const AIDE_ORDRE = "Glisser pour changer l'ordre : une candidature essaie les plateformes dans cet ordre, puis le CV";
const AIDE_ACTIF = "Éteint, le compte reste enregistré, mot de passe compris, mais n'est plus jamais essayé";
const AIDE_TESTER = "Ouvre un navigateur, se connecte avec ce compte et dit si la session s'est ouverte. Rien n'est envoyé.";

let uid = 0;
export const lignesDe = (comptes: Identifiant[]): Ligne[] =>
  (comptes.some((c) => c.site === SITE_GLOBAL) ? comptes : [{ site: SITE_GLOBAL, identifiant: '', secret: false, actif: true }, ...comptes])
    .map((c) => ({ uid: ++uid, site: c.site, identifiant: c.identifiant ?? '', actif: c.actif !== false, enregistre: !!c.secret, saisie: '', effacer: false }));
export const ligneNeuve = (site: string, identifiant: string, saisie: string, actif: boolean): Ligne =>
  ({ uid: ++uid, site, identifiant, actif, enregistre: false, saisie, effacer: false });

// Un mot de passe non retapé ne part pas : le serveur garde celui du coffre ; effacé, il part vide
export const versEnvoi = (lignes: Ligne[]) => lignes.filter((l) => l.site.trim()).map((l) => ({
  site: l.site.trim(), identifiant: l.identifiant.trim(), actif: l.actif,
  ...(l.saisie ? { secret: l.saisie } : l.effacer ? { secret: '' } : {}),
}));

// Le voyant d'un compte : cyan la session s'ouvre, rouge elle est refusée, muet on n'a pas encore demandé
export function voyant(essai?: Essai): [string, string] {
  if (!essai || (essai.ok === null && !essai.en_cours)) return ['', 'jamais testé'];
  if (essai.en_cours) return ['encours', `test en cours… ${essai.depuis_s ?? 0} s`];
  return essai.ok ? ['ok', essai.detail || 'session ouverte'] : ['ko', essai.detail || 'la connexion a échoué'];
}

export const FILTRES: { cle: string; libelle: string; garde: (l: Ligne, e?: Essai) => boolean }[] = [
  { cle: 'tous', libelle: 'tous', garde: () => true },
  { cle: 'actifs', libelle: 'actifs', garde: (l) => l.actif },
  { cle: 'eteints', libelle: 'éteints', garde: (l) => !l.actif },
  { cle: 'ouverts', libelle: 'session ouverte', garde: (_, e) => voyant(e)[0] === 'ok' },
  { cle: 'echecs', libelle: 'en échec', garde: (_, e) => voyant(e)[0] === 'ko' },
  { cle: 'jamais', libelle: 'jamais testés', garde: (_, e) => voyant(e)[0] === '' },
];

type ProprietesTable = {
  lignes: Ligne[];
  setLignes: (f: (l: Ligne[]) => Ligne[]) => void;
  essais: Record<string, Essai>;
  filtre: string;
  selection: Set<number>;
  setSelection: (s: Set<number>) => void;
  teste: string | null;
  tester: (site: string) => void;
};

// Les comptes des plateformes : l'ordre des lignes, changé par ⠿, est celui des essais ; la ligne « * » reste épinglée en tête
export function TableComptes({ lignes, setLignes, essais, filtre, selection, setSelection, teste, tester }: ProprietesTable) {
  const vol = useRef<number | null>(null);
  const garde = FILTRES.find((f) => f.cle === filtre)?.garde ?? (() => true);
  const vues = lignes.filter((l) => garde(l, essais[l.site]));
  const cochables = vues.filter((l) => l.site !== SITE_GLOBAL);
  const toutes = cochables.length > 0 && cochables.every((l) => selection.has(l.uid));
  const poser = (id: number, champ: Partial<Ligne>) => setLignes((ls) => ls.map((l) => (l.uid === id ? { ...l, ...champ } : l)));
  const survoler = (e: React.DragEvent<HTMLTableRowElement>, cible: Ligne) => {
    const quoi = vol.current;
    if (quoi === null || cible.site === SITE_GLOBAL) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const dessus = e.clientY < r.top + r.height / 2;
    setLignes((ls) => {
      if (quoi === cible.uid) return ls;
      const enVol = ls.find((l) => l.uid === quoi)!;
      const sans = ls.filter((l) => l.uid !== quoi);
      const i = sans.findIndex((l) => l.uid === cible.uid) + (dessus ? 0 : 1);
      const neuve = [...sans.slice(0, i), enVol, ...sans.slice(i)];
      return neuve.every((l, n) => l === ls[n]) ? ls : neuve;
    });
  };
  return (
    <div className="grille-tab">
      <table className="tab-comptes">
        <thead>
          <tr>
            <th><input type="checkbox" className="case" aria-label="Tout sélectionner" checked={toutes}
              onChange={() => setSelection(new Set(toutes ? [] : cochables.map((l) => l.uid)))} /></th>
            <th aria-label="Ordre des essais" />
            <th>Actif</th>
            <th aria-label="Dernier test" />
            <th>Site</th>
            <th>Identifiant / e-mail</th>
            <th>Mot de passe</th>
            <th aria-label="Tester" />
          </tr>
        </thead>
        <tbody>
          {vues.map((l) => {
            const global = l.site === SITE_GLOBAL;
            const [teinte, motif] = voyant(essais[l.site]);
            return (
              <tr key={l.uid} className={`${selection.has(l.uid) ? 'coche' : ''}${teste === l.site ? ' ouverte' : ''}`} onDragOver={(e) => survoler(e, l)}>
                <td>{!global && <input type="checkbox" className="case" aria-label={`Sélectionner ${l.site || 'la ligne neuve'}`} checked={selection.has(l.uid)}
                  onChange={() => {
                    const s = new Set(selection);
                    if (s.has(l.uid)) s.delete(l.uid);
                    else s.add(l.uid);
                    setSelection(s);
                  }} />}</td>
                <td>{global ? <span className="epingle" title={AIDE_GLOBAL}>★</span> : (
                  <span className="poignee" title={AIDE_ORDRE} aria-hidden="true" draggable
                    onDragStart={(e) => {
                      vol.current = l.uid;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', '');
                    }}
                    onDragEnd={() => {
                      vol.current = null;
                    }}>⠿</span>
                )}</td>
                <td><label className="inter seul" title={AIDE_ACTIF}><input type="checkbox" aria-label={`Compte ${l.site} actif`} checked={l.actif} onChange={(e) => poser(l.uid, { actif: e.target.checked })} /></label></td>
                <td><span className={`voyant ${teinte}`} title={motif} role="img" aria-label={motif} /></td>
                <td><input className="saisie cel" value={l.site} readOnly={global} title={global ? 'Tout site' : undefined} aria-label="Site" placeholder="linkedin.com"
                  onChange={(e) => poser(l.uid, { site: e.target.value })} /></td>
                <td><input className="saisie cel" value={l.identifiant} placeholder="identifiant ou e-mail" aria-label={`Identifiant / e-mail · ${l.site}`}
                  onChange={(e) => poser(l.uid, { identifiant: e.target.value })} /></td>
                <td>
                  <span className="secret">
                    <input className="saisie cel" type="password" autoComplete="new-password" value={l.saisie} aria-label={`Mot de passe · ${l.site}`}
                      placeholder={l.effacer ? "effacé à l'enregistrement" : l.enregistre ? 'enregistrée' : 'non renseignée'}
                      title={l.enregistre ? 'Enregistrée au coffre : tapez une valeur pour la remplacer.' : undefined}
                      onChange={(e) => poser(l.uid, { saisie: e.target.value })} />
                    {l.enregistre && !l.effacer && !l.saisie && (
                      <button type="button" className="effacer" title="Retire ce mot de passe du coffre à l'enregistrement." onClick={() => poser(l.uid, { effacer: true })}>Effacer</button>
                    )}
                  </span>
                </td>
                <td><button type="button" className={`action${teste === l.site ? ' allume' : ''}`} title={AIDE_TESTER} disabled={!l.site.trim()} onClick={() => tester(l.site.trim())}>Tester</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const quand = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

// Tester <site> : le verdict du dernier test, suivi pendant qu'il tourne
export function ongletTester({ site, essai, ligne, occupe, tester, fermer }: {
  site: string; essai?: Essai; ligne?: Ligne; occupe: boolean; tester: (s: string) => void; fermer: () => void;
}): Onglet {
  const [teinte] = voyant(essai);
  const etat = !essai || (essai.ok === null && !essai.en_cours) ? 'Jamais testé'
    : essai.en_cours ? `Test en cours… ${essai.depuis_s} s` : essai.ok ? 'Session ouverte' : 'La connexion a échoué';
  return {
    cle: 'tester', titre: `Tester · ${site}`, label: `Tester ${site}`,
    corps: (
      <div className="tester">
        <div className={`etat-test ${teinte}`} role="status"><span className={`voyant ${teinte}`} aria-hidden="true" />{etat}</div>
        <ul className="liste-f">
          <li>Site<span className="d">{site}</span></li>
          <li>Identifiant / e-mail<span className="d">{essai?.identifiant || ligne?.identifiant || '—'}</span></li>
          <li>Mot de passe<span className="d">{ligne?.enregistre ? 'enregistrée' : 'non renseignée'}</span></li>
          <li>Durée du test<span className="d">{essai && !essai.en_cours && essai.ok !== null ? `${essai.duree_s} s` : '—'}</span></li>
          <li>Testé le<span className="d">{essai?.teste_le ? quand(essai.teste_le) : '—'}</span></li>
        </ul>
        {essai?.detail && <p className="message-test">{essai.detail}</p>}
        <p className="aide-champ aide-test">Un navigateur s&apos;ouvre, se connecte avec ce compte et dit si la session s&apos;est ouverte. Le test se fait avec le compte enregistré.</p>
      </div>
    ),
    pied: (
      <>
        <button type="button" className="action" onClick={fermer}>Fermer</button>
        <button type="button" className="action plein" disabled={occupe} onClick={() => tester(site)}>Tester à nouveau<span className="ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
        </span></button>
      </>
    ),
  };
}

// Ajouter un site : la ligne rejoint la liste, à enregistrer avec le reste du groupe
export function useOngletAjout({ actif, lignes, ajouter, fermer, dire }: {
  actif: boolean; lignes: Ligne[]; ajouter: (l: Ligne) => void; fermer: () => void; dire: (t: string, e?: boolean) => void;
}): Onglet {
  const vierge = { site: '', identifiant: '', secret: '', actif: true };
  const [f, setF] = useState(vierge);
  useEffect(() => {
    if (!actif) setF(vierge);
    // Le formulaire se vide à la fermeture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif]);
  const valider = () => {
    const site = f.site.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    if (!site) return dire('Indiquez le site, sans « https:// » : linkedin.com.', true);
    if (lignes.some((l) => l.site.trim().toLowerCase() === site)) return dire(`${site} a déjà sa ligne.`, true);
    ajouter(ligneNeuve(site, f.identifiant.trim(), f.secret, f.actif));
    dire(`${site} ajouté : à enregistrer.`);
    fermer();
  };
  const entree = (e: React.KeyboardEvent) => e.key === 'Enter' && valider();
  return {
    cle: 'ajout', titre: 'Ajouter un site',
    corps: (
      <div className="section-f">
        <p className="texte-f">Un domaine vaut pour ses sous-domaines : « linkedin.com » couvre « fr.linkedin.com ». Le mot de passe va au coffre, jamais au modèle.</p>
        <div className="champ"><label htmlFor="aj-site">Site</label>
          <input id="aj-site" className="saisie" value={f.site} placeholder="linkedin.com" onChange={(e) => setF({ ...f, site: e.target.value })} onKeyDown={entree} /></div>
        <div className="champ"><label htmlFor="aj-id">Identifiant / e-mail</label>
          <input id="aj-id" className="saisie" value={f.identifiant} placeholder="vous@exemple.fr" onChange={(e) => setF({ ...f, identifiant: e.target.value })} onKeyDown={entree} /></div>
        <div className="champ"><label htmlFor="aj-mdp">Mot de passe</label>
          <input id="aj-mdp" className="saisie" type="password" autoComplete="new-password" value={f.secret} placeholder="non renseignée"
            onChange={(e) => setF({ ...f, secret: e.target.value })} onKeyDown={entree} /></div>
        <label className="inter" title={AIDE_ACTIF}>Actif<input type="checkbox" checked={f.actif} onChange={(e) => setF({ ...f, actif: e.target.checked })} /></label>
      </div>
    ),
    pied: (
      <>
        <button type="button" className="action" onClick={fermer}>Annuler</button>
        <button type="button" className="action plein" onClick={valider}>Ajouter<span className="ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </span></button>
      </>
    ),
  };
}
