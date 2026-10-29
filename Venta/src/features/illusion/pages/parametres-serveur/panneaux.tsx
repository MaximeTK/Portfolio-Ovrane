'use client';

import { useEffect, useRef, useState } from 'react';

export type Modele = {
  nom: string; fournisseur: string; modele: string; base_url: string; cle_api: boolean; reglages: Record<string, string>; reserve: string;
  max_tokens: number; prix_entree: number; prix_cache: number; prix_ecriture: number; prix_sortie: number;
};
export type Fournisseur = { nom: string; base_url: string; aide?: string; reglages: { cle: string; libelle: string; choix: string[]; aide?: string }[] };
// Le modèle tel qu'il se saisit : nombres en texte, la clé tapée ou à effacer
export type Brouillon = Omit<Modele, 'cle_api' | 'max_tokens' | 'prix_entree' | 'prix_cache' | 'prix_ecriture' | 'prix_sortie'> & {
  max_tokens: string; prix_entree: string; prix_cache: string; prix_ecriture: string; prix_sortie: string; cle: string; effacerCle: boolean; avaitCle: boolean; ancien: string;
};
export type Essai = { etat: 'encours' | 'ok' | 'ko'; detail: string };
export type Apercu = Record<string, number>;

export const NEUF: Brouillon = {
  nom: '', fournisseur: '', modele: '', base_url: '', reglages: {}, reserve: '', max_tokens: '', prix_entree: '', prix_cache: '', prix_ecriture: '', prix_sortie: '',
  cle: '', effacerCle: false, avaitCle: false, ancien: '',
};
export const versBrouillon = (m: Modele): Brouillon => ({
  ...m, max_tokens: m.max_tokens ? String(m.max_tokens) : '', prix_entree: String(m.prix_entree ?? 0), prix_cache: String(m.prix_cache ?? 0),
  prix_ecriture: String(m.prix_ecriture ?? 0), prix_sortie: String(m.prix_sortie ?? 0), cle: '', effacerCle: false, avaitCle: m.cle_api, ancien: m.nom,
});
// « Claude (Anthropic) » → « Claude » : le nom court du fournisseur, pour une colonne étroite
export const nomCourt = (fournisseurs: Record<string, Fournisseur>, cle: string) => (fournisseurs[cle]?.nom ?? cle).replace(/\s*\(.*\)$/, '') || '—';

// Ce que l'effacement emporte, dans l'ordre où on le lit
export const CE_QUI_PART: [string, string, string][] = [
  ['fiches', 'Fiches entreprises suivies', 'tes notes et tes écarts ; la fiche commune et son audit restent dans la base partagée'],
  ['offres', 'Offres en base', 'la file à postuler comprise'],
  ['candidatures', 'Candidatures', 'le registre de ce qui a été envoyé'],
  ['mails', 'Mails relevés', 'avec leurs étiquettes et leurs réponses rédigées'],
  ['appels', 'Appels transcrits', 'leur transcription et leur analyse'],
  ['mesures', 'Mesures', 'consommation des modèles et bilans des offres purgées'],
  ['lapis', 'LAPIS', 'posts LinkedIn lus et personnes trouvées'],
  ['fichiers', 'Fichiers', 'CV et lettres déjà écrits'],
];
export const totalApercu = (a: Apercu | null) => CE_QUI_PART.reduce((n, [cle]) => n + (a?.[cle] ?? 0), 0);

export function Voyant({ essai }: { essai?: Essai }) {
  return <span className={`voyant${essai ? ` ${essai.etat}` : ''}`} title={essai ? essai.detail : 'jamais testé'} role="img" aria-label={essai ? `Dernier test : ${essai.detail}` : 'Jamais testé'} />;
}

type ProprietesForm = {
  id: string; brouillon: Brouillon; poser: (b: Brouillon) => void; fournisseurs: Record<string, Fournisseur>; autres: string[]; erreur: string; valider: () => void;
};

// Le formulaire d'un modèle du catalogue : le fournisseur d'abord, ses réglages et son adresse en découlent
export function FormModele({ id, brouillon: b, poser, fournisseurs, autres, erreur, valider }: ProprietesForm) {
  const f = fournisseurs[b.fournisseur];
  const champ = (cle: keyof Brouillon) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => poser({ ...b, [cle]: e.target.value });
  const prix = (cle: 'prix_entree' | 'prix_sortie' | 'prix_cache' | 'prix_ecriture', lib: string, exemple: string) => (
    <div className="champ"><label htmlFor={`${id}-${cle}`}>{lib}</label>
      <input id={`${id}-${cle}`} className="saisie" inputMode="decimal" placeholder={exemple} value={b[cle]} onChange={champ(cle)} /></div>
  );
  return (
    <form id={id} className="form-modele" onSubmit={(e) => {
      e.preventDefault();
      valider();
    }}>
      <div className="section-f form-serre">
        <div className="grille-2">
          <div className="champ"><label htmlFor={`${id}-nom`}>Nom</label><input id={`${id}-nom`} className="saisie" placeholder="Audit" value={b.nom} onChange={champ('nom')} /></div>
          <div className="champ"><label htmlFor={`${id}-four`}>Fournisseur</label>
            {/* Un autre fournisseur, d'autres réglages : seuls les siens restent, une valeur qu'il ne propose pas tombe */}
            <select id={`${id}-four`} className="saisie" value={b.fournisseur} onChange={(e) => {
              const neuf = fournisseurs[e.target.value];
              poser({ ...b, fournisseur: e.target.value, reglages: Object.fromEntries(Object.entries(b.reglages)
                .filter(([cle, v]) => neuf?.reglages.some((r) => r.cle === cle && r.choix.includes(v)))) });
            }}>
              <option value="">— choisir —</option>
              {Object.entries(fournisseurs).map(([cle, x]) => <option key={cle} value={cle}>{x.nom}</option>)}
            </select></div>
        </div>
        <div className="grille-2">
          <div className="champ"><label htmlFor={`${id}-mod`}>Modèle</label><input id={`${id}-mod`} className="saisie" placeholder="gpt-5.6-luna" value={b.modele} onChange={champ('modele')} /></div>
          <div className="champ"><label htmlFor={`${id}-tok`}>Tokens max</label>
            <input id={`${id}-tok`} className="saisie" inputMode="numeric" placeholder="au choix de la brique" value={b.max_tokens} onChange={champ('max_tokens')} /></div>
        </div>
        <div className="grille-2">
          <div className="champ"><label htmlFor={`${id}-adr`}>Adresse</label>
            <input id={`${id}-adr`} className="saisie" placeholder={f?.base_url || 'celle du fournisseur'} value={b.base_url} onChange={champ('base_url')} /></div>
          <div className="champ"><label htmlFor={`${id}-reg`}>Réglages</label>
            {f?.reglages.length ? f.reglages.map((r, i) => (
              <select key={r.cle} id={i ? undefined : `${id}-reg`} className="saisie" title={r.aide} aria-label={r.libelle} value={b.reglages[r.cle] ?? ''}
                onChange={(e) => poser({ ...b, reglages: { ...b.reglages, [r.cle]: e.target.value } })}>
                {r.choix.map((v) => <option key={v} value={v}>{`${r.libelle} : ${v || 'défaut'}`}</option>)}
              </select>
            )) : <select id={`${id}-reg`} className="saisie" disabled title={f?.aide ?? "Choisissez d'abord le fournisseur."}><option>—</option></select>}
          </div>
        </div>
      </div>
      <div className="section-f form-serre"><h3>Prix, en $ par million de tokens</h3>
        <div className="grille-2">{prix('prix_entree', '$/M entrée', '1.25')}{prix('prix_sortie', '$/M sortie', '10')}</div>
        <div className="grille-2">{prix('prix_cache', '$/M lu en cache', '0.125')}{prix('prix_ecriture', '$/M écrit en cache', '1.5')}</div>
      </div>
      <div className="section-f form-serre"><h3>Accès</h3>
        <div className="grille-2">
          <div className="champ"><label htmlFor={`${id}-cle`}>Clé d&apos;API</label>
            <span className="secret">
              <input id={`${id}-cle`} className="saisie" type="password" autoComplete="new-password" value={b.cle}
                placeholder={b.effacerCle ? "effacée à l'enregistrement" : b.avaitCle && b.nom === b.ancien ? 'enregistrée' : 'non renseignée'}
                onChange={(e) => poser({ ...b, cle: e.target.value, effacerCle: false })} />
              {b.avaitCle && b.nom === b.ancien && !b.effacerCle && !b.cle && (
                <button type="button" className="effacer" title="Retire cette clé du coffre à l'enregistrement." onClick={() => poser({ ...b, effacerCle: true })}>Effacer</button>
              )}
            </span></div>
          <div className="champ"><label htmlFor={`${id}-res`}>Réserve</label>
            <select id={`${id}-res`} className="saisie" value={b.reserve} onChange={champ('reserve')} title="La réserve prend la demande sur-le-champ quand ce modèle sature ou tombe.">
              {['', ...new Set([...autres, b.reserve].filter(Boolean))].map((n) => <option key={n} value={n}>{n || '— aucune —'}</option>)}
            </select></div>
        </div>
        {b.avaitCle && b.ancien && b.nom !== b.ancien && !b.cle && <p className="aide-champ">Renommé, le modèle perd sa clé : retapez-la.</p>}
      </div>
      {erreur && <p className="alerte-f" role="alert">{erreur}</p>}
    </form>
  );
}

// Le filtre Fournisseur : un menu en colonne, le choix courant allumé ; un clic ailleurs ou Échap le referme
export function MenuFournisseur({ valeur, choix, courant, choisir }: { valeur: string; choix: { cle: string; libelle: string; n: number }[]; courant: string; choisir: (c: string) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const hote = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!hote.current?.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setOuvert(false);
    };
    document.addEventListener('pointerdown', dehors);
    document.addEventListener('keydown', echap, true);
    return () => {
      document.removeEventListener('pointerdown', dehors);
      document.removeEventListener('keydown', echap, true);
    };
  }, [ouvert]);
  return (
    <div ref={hote} className="menu-hote">
      <button type="button" className={`filtre${courant ? ' actif' : ''}`} aria-haspopup="listbox" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        <span><span className="lib">Fournisseur</span>{valeur}</span>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {ouvert && (
        <div className="menu verre menu-fournisseur" role="listbox" aria-label="Fournisseur des modèles">
          <span className="verre-halos" aria-hidden="true" />
          {choix.map((c) => (
            <button key={c.cle} type="button" role="option" aria-selected={c.cle === courant} className={`menu-option${c.cle === courant ? ' actif' : ''}`}
              onClick={() => {
                choisir(c.cle);
                setOuvert(false);
              }}>{c.libelle}<span className="compteur">{c.n}</span></button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CorpsEffacer({ apercu, erreur }: { apercu: Apercu | null; erreur: string }) {
  if (erreur) return <p className="alerte-f" role="alert">{erreur}</p>;
  if (!apercu) return <p className="texte-f">Décompte de ce qui partirait…</p>;
  const total = totalApercu(apercu);
  if (!total) return <p className="texte-f">Rien à effacer : la base de ce compte est déjà vide, réglages mis à part.</p>;
  return (
    <>
      <p className="intro-f">Définitif : l&apos;effacement ne se défait pas. Voici ce qui part :</p>
      <ul className="liste-f compte">
        {CE_QUI_PART.map(([cle, titre, quoi]) => (
          <li key={cle} title={quoi} className={apercu[cle] ? '' : 'rien'}><span className="n">{(apercu[cle] ?? 0).toLocaleString('fr-FR')}</span><span>{titre}<small>{quoi}</small></span></li>
        ))}
        <li className="total"><span className="n">{total.toLocaleString('fr-FR')}</span><span>enregistrement{total > 1 ? 's' : ''}</span></li>
      </ul>
      <p className="aide-champ">Seuls les réglages survivent : profils, pièces de lettre, modèles, clés d&apos;API, teinte. Les fichiers, eux, sont bien effacés : un CV dont l&apos;offre, la candidature et la fiche ont disparu ne se rattache plus à rien.</p>
    </>
  );
}
