'use client';

import { MenuFiltre } from '../../elements/Menu';
import { Champ, ChampSaisie, ChampListe, SectionFiche } from '../../elements/Champ';
import { SaisieSecrete } from '../../elements/Champ';

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
// « Claude (Anthropic) » devient « Claude », pour une colonne étroite.
export const nomCourt = (fournisseurs: Record<string, Fournisseur>, cle: string) => (fournisseurs[cle]?.nom ?? cle).replace(/\s*\(.*\)$/, '') || '—';

// Ce que l'effacement emporte, dans l'ordre où on le lit
const CE_QUI_PART: [string, string, string][] = [
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

// Formulaire d'un modèle : le fournisseur d'abord, le reste en découle.
export function FormModele({ id, brouillon: b, poser, fournisseurs, autres, erreur, valider }: ProprietesForm) {
  const f = fournisseurs[b.fournisseur];
  const champ = (cle: keyof Brouillon) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => poser({ ...b, [cle]: e.target.value });
  const prix = (cle: 'prix_entree' | 'prix_sortie' | 'prix_cache' | 'prix_ecriture', lib: string, exemple: string) => (
    <ChampSaisie id={`${id}-${cle}`} libelle={lib} inputMode="decimal" placeholder={exemple} value={b[cle]} onChange={champ(cle)} />
  );
  return (
    <form id={id} className="form-modele" onSubmit={(e) => {
      e.preventDefault();
      valider();
    }}>
      <div className="section-f form-serre">
        <div className="grille-2">
          <ChampSaisie id={`${id}-nom`} libelle="Nom" placeholder="Audit" value={b.nom} onChange={champ('nom')} />
          {/* Un autre fournisseur ne garde que ses réglages ; le reste tombe */}
          <ChampListe id={`${id}-four`} libelle="Fournisseur" value={b.fournisseur} onChange={(e) => {
            const neuf = fournisseurs[e.target.value];
            poser({ ...b, fournisseur: e.target.value, reglages: Object.fromEntries(Object.entries(b.reglages)
              .filter(([cle, v]) => neuf?.reglages.some((r) => r.cle === cle && r.choix.includes(v)))) });
          }}>
            <option value="">— choisir —</option>
            {Object.entries(fournisseurs).map(([cle, x]) => <option key={cle} value={cle}>{x.nom}</option>)}
          </ChampListe>
        </div>
        <div className="grille-2">
          <ChampSaisie id={`${id}-mod`} libelle="Modèle" placeholder="gpt-5.6-luna" value={b.modele} onChange={champ('modele')} />
          <ChampSaisie id={`${id}-tok`} libelle="Tokens max" inputMode="numeric" placeholder="au choix de la brique" value={b.max_tokens} onChange={champ('max_tokens')} />
        </div>
        <div className="grille-2">
          <ChampSaisie id={`${id}-adr`} libelle="Adresse" placeholder={f?.base_url || 'celle du fournisseur'} value={b.base_url} onChange={champ('base_url')} />
          <Champ pour={`${id}-reg`} libelle="Réglages">
            {f?.reglages.length ? f.reglages.map((r, i) => (
              <select key={r.cle} id={i ? undefined : `${id}-reg`} className="saisie" title={r.aide} aria-label={r.libelle} value={b.reglages[r.cle] ?? ''}
                onChange={(e) => poser({ ...b, reglages: { ...b.reglages, [r.cle]: e.target.value } })}>
                {r.choix.map((v) => <option key={v} value={v}>{`${r.libelle} : ${v || 'défaut'}`}</option>)}
              </select>
            )) : <select id={`${id}-reg`} className="saisie" disabled title={f?.aide ?? "Choisissez d'abord le fournisseur."}><option>—</option></select>}
          </Champ>
        </div>
      </div>
      <SectionFiche titre="Prix, en $ par million de tokens" className="form-serre">
        <div className="grille-2">{prix('prix_entree', '$/M entrée', '1.25')}{prix('prix_sortie', '$/M sortie', '10')}</div>
        <div className="grille-2">{prix('prix_cache', '$/M lu en cache', '0.125')}{prix('prix_ecriture', '$/M écrit en cache', '1.5')}</div>
      </SectionFiche>
      <SectionFiche titre="Accès" className="form-serre">
        <div className="grille-2">
          <Champ pour={`${id}-cle`} libelle="Clé d&apos;API">
            <SaisieSecrete id={`${id}-cle`} valeur={b.cle} pose={!!b.avaitCle && b.nom === b.ancien} efface={!!b.effacerCle} titre="Retire cette clé du coffre à l'enregistrement."
              changer={(v) => poser({ ...b, cle: v, effacerCle: false })} effacer={() => poser({ ...b, effacerCle: true })} /></Champ>
          <ChampListe id={`${id}-res`} libelle="Réserve" value={b.reserve} onChange={champ('reserve')} title="La réserve prend la demande sur-le-champ quand ce modèle sature ou tombe.">
              {['', ...new Set([...autres, b.reserve].filter(Boolean))].map((n) => <option key={n} value={n}>{n || '— aucune —'}</option>)}
            </ChampListe>
        </div>
        {b.avaitCle && b.ancien && b.nom !== b.ancien && !b.cle && <p className="aide-champ">Renommé, le modèle perd sa clé : retapez-la.</p>}
      </SectionFiche>
      {erreur && <p className="alerte-f" role="alert">{erreur}</p>}
    </form>
  );
}

// Filtre Fournisseur : menu en colonne
export function MenuFournisseur(p: { valeur: string; choix: { cle: string; libelle: string; n: number }[]; courant: string; choisir: (c: string) => void }) {
  return <MenuFiltre {...p} lib="Fournisseur" titre="Fournisseur des modèles" actif={!!p.courant} classeMenu="menu-fournisseur" />;
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
