'use client';
/* eslint-disable @next/next/no-img-element -- les aperçus viennent d'Illusion par le relais, avec la session : l'optimiseur de next/image ne les atteint pas */

import { useEffect, useId, useState } from 'react';
import { appeler, telecharger } from '../../api';
import { usePanneau, useVues } from '../../dock/Dock';
import { AuPied, Confirmer, MarqueAdmin, Panneau, type Elements, type Onglet } from '../../dock/Panneau';
import { ongletAjoutCompetence, ongletFicheOffre, type DemandeAjout } from '../../partage/FicheOffre';
import { Couleurs, ICONES, ListeFichiers, RELAIS, court, message, poids, useFichiers, type Fichier } from './commun';
import { MODELE_VIDE, nomFichier, quand, sansJson, type Documents, type Formulaire, type Modele, type NomAtelier, type Parametres, type Production } from './index';

const FONDS = ['', 'aplat', 'degrade', 'photo', 'photo-teintee', 'blanc'];
const LANGUES = ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl'];
const STATUTS: Record<string, string> = {
  POSTULEE: 'Envoyée', PRETE: 'Prête, pas encore déposée', A_LA_MAIN: 'À faire à la main', ECHEC: 'Échec', INADAPTEE: 'Inadaptée',
  IGNOREE: 'Écartée', EN_COURS: 'En cours',
};
const REPONSES: Record<string, string> = { positive: 'réponse positive', refus: 'refus', reponse: 'réponse reçue' };
// Ce que Nouveau CV et Nouvelle lettre se repassent, comme dans l'ancien dashboard
const PARTAGES = ['profil', 'offre', 'poste', 'entreprise', 'deja_postule'] as const;
const duree = (s: number) => (!s ? "à l'instant" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);
const hexa = (v?: string) => /^#[0-9a-f]{3,8}$/i.test(v ?? '');

// Le panneau : les éléments (pièce, fiche de poste, modèle de CV spontané), puis chaque sous-fenêtre de la page en onglet ; l'ajout d'une compétence n'y est qu'avec son objet
export function PanneauDocuments({ d }: { d: Documents }) {
  const { onglet, ouvrir } = usePanneau();
  const ouverts = useVues().vues[0].objets;
  // L'ajout d'une compétence, et l'élément où revenir ensuite
  const [demande, setDemande] = useState<{ ajout: DemandeAjout; sorte: string; objet: string } | null>(null);
  // Refermé, le panneau oublie l'ajout en cours
  useEffect(() => {
    if (onglet === null) setDemande(null);
  }, [onglet]);
  const ajouter = (ajout: DemandeAjout, sorte: string, objet: string) => {
    setDemande({ ajout, sorte, objet });
    ouvrir('ajout-competence');
  };
  const elements: Elements = {
    fiche: (cle) => {
      const p = d.piece(cle);
      return p ? {
        cle: 'fiche', titre: `${p.nature === 'cv' ? 'CV' : 'Lettre'} · ${court(p.entreprise || '—', 14)}`, label: `Fiche de fabrication · ${p.entreprise || '—'}`,
        corps: <FichePiece p={p} d={d} ajouter={(dm) => ajouter(dm, 'fiche', cle)} />, pied: true,
      } : null;
    },
    'fiche-offre': (c) => ongletFicheOffre(c, { ajouterAuProfil: (dm) => ajouter(dm, 'fiche-offre', c) }),
    // Un modèle renommé garde sa fenêtre jusqu'à ce qu'elle passe à son nouveau nom : la fiche ne disparaît pas si son nom manque
    spontane: (nom) => ({
      cle: 'spontane', titre: `Modèle ${court(nom, 14)}`, label: `Modèle de CV spontané · ${nom}`,
      corps: d.parametres ? <FicheModele depart={d.parametres.cv_spontanes?.find((m) => m.nom === nom)} d={d} enregistre={(n) => n !== nom && ouvrir('spontane', n)} />
        : <p className="texte-f">Lecture du modèle…</p>,
      pied: !!d.parametres,
    }),
  };
  const cv = useOngletFabrication(d, 'constructeur');
  const lettre = useOngletFabrication(d, 'lettre');
  const reglages = useOngletReglages(d, onglet === 'reglages');
  const nouveauModele: Onglet = {
    cle: 'nouveau-modele', titre: 'Nouveau modèle', label: 'Nouveau modèle de CV spontané',
    corps: <FicheModele key={d.vierge} depart={MODELE_VIDE} d={d} enregistre={(nom) => { d.viderModele(); ouvrir('spontane', nom); }} />, pied: true,
  };
  const objets = Object.keys(elements).filter((c) => ouverts[c] !== undefined && elements[c](ouverts[c])).length + (demande ? 1 : 0);
  // Deux objets ouverts : les onglets de geste ne restent que s'ils sont ouverts, sinon la tête du panneau déborde
  const peu = objets <= 1;
  const voulu = (o: Onglet, montre: boolean) => (montre || onglet === o.cle ? [o] : []);
  const onglets: Onglet[] = [
    ...(demande ? [ongletAjoutCompetence(demande.ajout, (texte) => {
      setDemande(null);
      if (texte) {
        d.dire(texte);
        // La puce change de camp sous les yeux : « manquante ici, ajoutée depuis »
        d.marquerAjoutee(demande.ajout.cle, demande.ajout.competence);
      }
      ouvrir(demande.sorte, demande.objet);
    })] : []),
    ...voulu(cv, d.genre === 'cv' && peu),
    ...voulu(lettre, d.genre === 'lettre' && peu),
    ...voulu(nouveauModele, d.genre === 'spontanes' && peu),
    ...voulu(reglages, peu),
  ];
  return <Panneau elements={elements} onglets={onglets} />;
}

// Fiche de fabrication d'une pièce, une par fenêtre, avec son pied (Supprimer, Exporter les paramètres, Télécharger) pour que sa confirmation reste la sienne
function FichePiece({ p, d, ajouter }: { p: Production; d: Documents; ajouter: (dm: DemandeAjout) => void }) {
  const { ouvrir, fermer } = usePanneau();
  const [confirmer, setConfirmer] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const lien = `${RELAIS}/productions/${p.candidature}/${p.nature}`;
  const piece = p.nature === 'cv' ? 'CV' : 'Lettre';
  const exporter = () => {
    const nom: NomAtelier = p.nature === 'cv' ? 'constructeur' : 'lettre';
    const couleurs = [p.fond_accent, p.fond_secondaire].filter((c): c is string => /^#[0-9a-f]{6}$/i.test(c ?? ''));
    const repris: Partial<Formulaire> = {
      ...(d.profils.includes(p.profil) ? { profil: p.profil } : {}), ...(p.offre_reelle && p.url ? { offre: p.url } : {}),
      ...(p.poste ? { poste: p.poste } : {}), ...(p.entreprise ? { entreprise: p.entreprise } : {}),
      ...(nom === 'constructeur' && couleurs.length ? { palette: couleurs } : {}),
    };
    const n = Object.keys(repris).length;
    if (!n) return d.dire('Rien à reprendre : cette pièce ne porte aucun paramètre réutilisable.', true);
    d.changerFormulaire(nom, repris);
    d.dire(`${n} paramètre(s) repris dans « ${nom === 'constructeur' ? 'Nouveau CV' : 'Nouvelle lettre'} » — il ne reste qu'à relancer.`);
    ouvrir(nom === 'constructeur' ? 'nouveau-cv' : 'nouvelle-lettre');
  };
  const supprimer = async () => {
    setOccupe(true);
    // La fiche parle d'UNE pièce : c'est elle qu'on supprime, pas ce qui reste coché dans la galerie ; partie, sa fenêtre se ferme
    if (await d.supprimer([p])) fermer();
    setOccupe(false);
  };
  const tirage = ([['fond_mode', 'Fond'], ['fond_accent', 'Accent'], ['fond_famille', 'Police'], ['fond_structure', 'Structure'], ['fond_secondaire', 'Secondaire'], ['fond_photo', 'Photo']] as const)
    .filter(([c]) => p[c]);
  const ligne = ([c, lib]: (typeof tirage)[number]) => (
    <li key={c}><span className="lib-champ">{lib}</span>
      {c === 'fond_photo' ? <span className="d">{p[c] === 'True' ? 'oui' : 'non'}</span>
        : hexa(p[c]) ? <span className="d mono"><i className="pastille petite" style={{ background: p[c] }} />{p[c]}</span> : <span className="d">{p[c]}</span>}
    </li>
  );
  const donne = `${STATUTS[p.statut] ?? p.statut}${p.statut === 'POSTULEE' && !p.reponse ? ' · pas encore de réponse' : ''}`;
  return (
    <>
      {confirmer && (
        <Confirmer question={p.nature === 'cv' ? 'Supprimer ce CV ?' : 'Supprimer cette lettre ?'} occupe={occupe} action="Supprimer"
          detail={p.offre_reelle ? 'Le fichier part, la candidature envoyée reste.' : "Bâti sans annonce : rien d'autre n'en dépend."}
          onAnnuler={() => setConfirmer(false)} onConfirmer={supprimer} />
      )}
      <div className="docs-f">
        <div className="fiche">
          {p.apercu ? (
            <a href={lien} target="_blank" rel="noopener noreferrer" className="grande" title="Ouvrir le fichier">
              <img className="page-img" src={`${lien}/apercu?v=${encodeURIComponent(p.nom || p.date)}`} alt={`Aperçu ${p.nature === 'cv' ? 'du CV' : 'de la lettre'}`} />
            </a>
          ) : (
            <div className={`page grande${p.nature === 'lettre' ? ' lettre' : ''}`} style={{ ['--t' as string]: p.fond_accent || '#6E8FFE' }} role="img"
              aria-label="Pas d'aperçu : cette pièce est antérieure à la capture faite à l'export."><span className="format">{p.format || '?'}</span></div>
          )}
          <div>
            <ul className="liste-f">
              <li><span className="lib-champ">Pièce</span><span className="d">{piece} · <span className="mono" title={p.nom}>{p.nom}</span></span></li>
              <li><span className="lib-champ">Poste</span><span className="d">{p.poste || '(sans intitulé)'}</span></li>
              <li><span className="lib-champ">Entreprise</span><span className="d">{p.entreprise || '—'}</span></li>
              <li><span className="lib-champ">Offre</span>{p.offre_reelle
                ? <button type="button" className="d lien" aria-haspopup="dialog" data-ouvre="fiche-offre" data-objet={p.offre} onClick={() => ouvrir('fiche-offre', p.offre)}>Voir la fiche de poste</button>
                : <span className="d">aucune annonce : bâti sans lien</span>}</li>
              <li><span className="lib-champ">Profil</span><span className="d mono">{nomFichier(p.profil_chemin || p.profil) || '—'}</span></li>
              <li><span className="lib-champ">Fabriquée le</span><span className="d">{quand(p.date)}{p.fabrication_s ? ` · en ${Math.round(p.fabrication_s)} s` : ''}</span></li>
              <li><span className="lib-champ">Ce qu&apos;elle a donné</span><span className="d">{p.essai ? 'Essai de mise en page' : donne}
                {p.reponse && <> · <span className="t-rep">{REPONSES[p.reponse] ?? p.reponse}</span></>}{p.liens_suivis ? ` · ${p.clics} clic(s) sur ses liens` : ''}</span></li>
            </ul>
            {tirage.length > 0 && (
              <>
                <p className="sous-f">Mise en page</p>
                <div className="grille-2">
                  <ul className="liste-f">{tirage.filter(([c]) => ['fond_mode', 'fond_accent', 'fond_famille'].includes(c)).map(ligne)}</ul>
                  <ul className="liste-f">{tirage.filter(([c]) => !['fond_mode', 'fond_accent', 'fond_famille'].includes(c)).map(ligne)}</ul>
                </div>
              </>
            )}
          </div>
        </div>
        {(p.retenues.length > 0 || p.manquantes.length > 0 || p.implicites.length > 0) && (
          <div className="competences">
            <div><p className="lib-champ lib-bloc">Compétences retenues</p>
              {p.retenues.length ? <div className="puces">{p.retenues.map((c) => <span key={c} className="puce">{c}</span>)}</div> : <p className="aide-champ">—</p>}</div>
            <div><p className="lib-champ lib-bloc">Compétences manquantes</p>
              {p.manquantes.length ? (
                <div className="puces">{p.manquantes.map((c) => (p.ajoutees.includes(c)
                  ? <span key={c} className="puce ajoutee" title="Manquante sur cette candidature-là, ajoutée au profil depuis : les suivantes la trouveront.">{c}<b>✓</b></span>
                  : <button key={c} type="button" className="puce" title={`Ajouter « ${c} » au profil`} aria-haspopup="dialog"
                    onClick={() => ajouter({ cle: p.offre, competence: c, profil: p.profil })}>{c}<b>+</b></button>))}</div>
              ) : <p className="aide-champ">—</p>}</div>
            <div><p className="lib-champ lib-bloc">Exigences sous-entendues</p>
              {p.implicites.length ? <div className="puces">{p.implicites.map((c) => <span key={c} className="puce implicite">{c}</span>)}</div> : <p className="aide-champ">—</p>}</div>
          </div>
        )}
      </div>
      <AuPied>
        <button type="button" className="action rouge gauche" onClick={() => setConfirmer(true)}><span className="ico">{ICONES.supprimer}</span>Supprimer</button>
        <button type="button" className="action" title="Exporter les paramètres" onClick={exporter}><span className="ico">{ICONES.exporter}</span><span className="txt">Exporter les paramètres</span></button>
        <button type="button" className="action plein" onClick={() => telecharger(`/productions/${p.candidature}/${p.nature}`).catch((e) => d.dire(message(e), true))}>
          Télécharger<span className="ico">{ICONES.telecharger}</span>
        </button>
      </AuPied>
    </>
  );
}

// Nouveau CV et Nouvelle lettre : l'atelier de la brique, ses champs, Exécuter qui devient Arrêter, et l'état du lancement
function useOngletFabrication(d: Documents, nom: NomAtelier): Onglet {
  const f = d.formulaires[nom];
  const etat = d.etats[nom];
  const changer = (champs: Partial<Formulaire>) => d.changerFormulaire(nom, champs);
  const cv = nom === 'constructeur';
  const motif = f.profil ? '' : 'Profil du candidat est obligatoire';
  const reprendre = () => {
    const autre = d.formulaires[cv ? 'lettre' : 'constructeur'];
    const repris = PARTAGES.filter((c) => autre[c]);
    if (repris.length) changer(Object.fromEntries(repris.map((c) => [c, autre[c]])) as Partial<Formulaire>);
    d.dire(repris.length ? `${repris.length} paramètre(s) repris.` : "Rien à reprendre : l'autre formulaire n'a pas encore servi.", !repris.length);
  };
  const lancer = () => {
    if (!etat?.en_cours && motif) return d.dire(`Impossible de lancer : ${motif}.`, true);
    void d.executer(nom);
  };
  const id = (c: string) => `${nom}-${c}`;
  const bascule = (c: 'deja_postule' | 'essai' | 'silencieux', libelle: string, aide: string, admin = false, inactif = false) => (
    <label className={`inter${inactif ? ' inactif' : ''}`} title={aide}>
      <span>{libelle}{admin && <MarqueAdmin />}</span>
      <input type="checkbox" checked={f[c]} disabled={inactif} onChange={(e) => changer({ [c]: e.target.checked } as Partial<Formulaire>)} />
    </label>
  );
  const options = (
    <>
      {bascule('deja_postule', 'Candidature manuelle', "Coché : vous avez postulé vous-même — l'offre sort de la file, la fiche entreprise est créée si elle manque. Décoché : même chose, mais l'offre rejoint ce qu'il reste à postuler.")}
      {d.admin && bascule('essai', 'Mode test', "Coché : rien n'est engagé. Le fichier paraît dans la galerie sous l'étiquette « essai » ; aucune fiche d'employeur, rien dans la file à postuler. Grisé tant que « Candidature manuelle » est coché.", true, f.deja_postule)}
      {d.admin && bascule('silencieux', 'Débogage', "Coché, la brique détaille tout ce qu'elle fait. Décoché, elle n'imprime que l'essentiel.", true)}
    </>
  );
  const badge = !etat || (!etat.en_cours && etat.ok == null) ? null
    : etat.en_cours ? <p className="etat-l cours" role="status"><span className="carre cours" />en cours · {duree(etat.depuis_s)}</p>
      : etat.ok ? <p className="etat-l" role="status"><span className="carre finie" />terminée en {duree(etat.duree_s)}</p>
        : <p className="etat-l echec" role="alert">en échec — {etat.erreur || 'voir le journal du serveur'}</p>;
  return {
    cle: cv ? 'nouveau-cv' : 'nouvelle-lettre',
    titre: cv ? 'Nouveau CV' : 'Nouvelle lettre',
    corps: (
      <form className="docs-f" aria-label={cv ? 'Nouveau CV' : 'Nouvelle lettre'} onSubmit={(e) => { e.preventDefault(); lancer(); }}>
        <button type="button" className="action" onClick={reprendre}><span className="ico">{ICONES.reprendre}</span>Reprendre les paramètres {cv ? 'de la lettre' : 'du CV'}</button>
        <div className="section-f haut">
          <div className="champ"><label htmlFor={id('url')} title="L'annonce est ouverte et lue : elle donne l'intitulé, l'employeur et les compétences qui taillent le dossier. Vide : le dossier vaut pour lui-même.">URL de l&apos;offre</label>
            <input id={id('url')} className="saisie" type="url" placeholder="https://…/offre/12345" value={f.offre} onChange={(e) => changer({ offre: e.target.value })} /></div>
          <div className="champ"><label htmlFor={id('ent')} title="Sert à nommer les fichiers ; n'apparaît pas sur le CV.">Entreprise</label>
            <input id={id('ent')} className="saisie" value={f.entreprise} onChange={(e) => changer({ entreprise: e.target.value })} /></div>
          <div className="champ"><label htmlFor={id('poste')} title="Repris en tête du CV. Vide : celui du profil.">Poste visé</label>
            <input id={id('poste')} className="saisie" value={f.poste} onChange={(e) => changer({ poste: e.target.value })} /></div>
          <div className="champ"><label htmlFor={id('profil')}>Profil du candidat *</label>
            <select id={id('profil')} className="saisie" value={f.profil} required onChange={(e) => changer({ profil: e.target.value })}>
              <option value="">— choisir un profil —</option>
              {d.profils.map((p) => <option key={p} value={p}>{sansJson(p)}</option>)}
            </select></div>
          {cv ? (
            <div className="champ"><span className="lib-champ">Palette du fond</span>
              <Couleurs valeurs={f.palette} changer={(palette) => changer({ palette })} libelle="Palette du fond" />
              <p className="aide-champ">Vide : celles de l&apos;identité de l&apos;entreprise.</p></div>
          ) : (
            <>
              <div className="champ"><label htmlFor={id('langue')} title="Celle de l'offre : le corps, l'objet, la date et la formule s'y écrivent.">Langue de la lettre</label>
                <select id={id('langue')} className="saisie" value={f.langue} onChange={(e) => changer({ langue: e.target.value })}>
                  {LANGUES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select></div>
              {options}
            </>
          )}
        </div>
        {cv && <div className="section-f"><h3>Options</h3>{options}</div>}
        {badge}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    ),
    pied: (
      <>
        {cv && (
          <button type="button" className="action" disabled={!!etat?.en_cours} title="Le même CV, mis en page pareil, sans son fond : le texte seul, en PNG transparent à 300 ppp. Rien n'entre en base ; le fichier se télécharge à la fin."
            onClick={() => (motif ? d.dire(`Impossible de lancer : ${motif}.`, true) : void d.executer(nom, { transparent: true, essai: true }))}>
            <span className="ico">{ICONES.image}</span>PNG transparent
          </button>
        )}
        <button type="button" className="action plein" disabled={!etat?.en_cours && !!motif} title={!etat?.en_cours && motif ? `Impossible de lancer : ${motif}.` : undefined} onClick={lancer}>
          {etat?.en_cours ? 'Arrêter' : 'Exécuter'}<span className="ico">{etat?.en_cours ? ICONES.arret : ICONES.fleche}</span>
        </button>
      </>
    ),
  };
}

// Réglages · Documents : ce qui vaut pour tous les CV et toutes les lettres du compte ; les fichiers de renfort partent aussitôt
function useOngletReglages(d: Documents, actif: boolean): Onglet {
  const p = d.parametres;
  const depart = () => ({ fond: p?.constructeur_fond ?? '', palette: p?.constructeur_palette ?? [], modele: p?.constructeur_modele ?? '',
    prompt: p?.constructeur_prompt_lettre ?? '', notes: p?.constructeur_notes_lettre ?? '' });
  const [brouillon, setBrouillon] = useState(depart);
  const [aSupprimer, setASupprimer] = useState<Fichier | null>(null);
  const pieces = useFichiers('/pieces-lettre', d.dire, actif);
  useEffect(() => {
    if (actif) setBrouillon(depart());
    // Le brouillon repart des réglages à l'ouverture de l'onglet et après chaque enregistrement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, p]);
  const change = JSON.stringify(brouillon) !== JSON.stringify(depart());
  const enregistrer = () => void d.enregistrer({
    constructeur_fond: brouillon.fond, constructeur_palette: brouillon.palette, constructeur_prompt_lettre: brouillon.prompt,
    constructeur_notes_lettre: brouillon.notes, ...(d.admin ? { constructeur_modele: brouillon.modele } : {}),
  });
  const modeles = p?.modeles ?? [];
  return {
    cle: 'reglages',
    titre: 'Réglages',
    label: 'Réglages · Documents',
    corps: (
      <div className="docs-f" onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).matches('select') && change) enregistrer();
      }}>
        <div className="section-f"><h3>CV</h3>
          <div className="grille-2">
            <div className="champ"><label htmlFor="rg-fond" title="Reprend le fond imposé à tous les CV : vide, un tirage différent à chaque CV.">Fond</label>
              <select id="rg-fond" className="saisie" value={brouillon.fond} onChange={(e) => setBrouillon({ ...brouillon, fond: e.target.value })}>
                {FONDS.map((f) => <option key={f} value={f}>{f || 'Défaut'}</option>)}
              </select></div>
            <div className="champ"><span className="lib-champ">Palette imposée</span>
              <Couleurs valeurs={brouillon.palette} changer={(palette) => setBrouillon({ ...brouillon, palette })} libelle="Palette imposée" /></div>
          </div>
        </div>
        <div className="section-f"><h3>Lettre</h3>
          {d.admin && (
            <div className="champ"><label htmlFor="rg-modele" title="Celui qui rédige les lettres. Vide : aucune rédaction, le gabarit suffit.">Modèle<MarqueAdmin /></label>
              <select id="rg-modele" className="saisie" value={brouillon.modele} onChange={(e) => setBrouillon({ ...brouillon, modele: e.target.value })}>
                {modeles.map((m) => <option key={m.nom} value={m.nom}>{m.modele && m.modele !== m.nom ? `${m.nom} · ${m.modele}` : m.nom}</option>)}
                <option value="">— aucun : le gabarit —</option>
              </select></div>
          )}
          <div className="grille-2">
            <div className="champ"><label htmlFor="rg-prompt" title="Ce que le modèle doit écrire, et comment. Vide : la lettre est assemblée par le gabarit, sans réseau ni jeton.">Prompt de la lettre</label>
              <textarea id="rg-prompt" className="saisie" rows={3} value={brouillon.prompt} onChange={(e) => setBrouillon({ ...brouillon, prompt: e.target.value })} /></div>
            <div className="champ"><label htmlFor="rg-notes" title="Remises au modèle sous PROJETS : pour chaque projet, le contexte, la difficulté, la décision prise, ce que ça a donné.">Vos notes (PROJETS)</label>
              <textarea id="rg-notes" className="saisie" rows={3} value={brouillon.notes} onChange={(e) => setBrouillon({ ...brouillon, notes: e.target.value })} /></div>
          </div>
          <div className="champ"><span className="lib-champ" title="Fichiers texte joints aux notes de chaque lettre — un carnet de projet, un README, des chiffres. Rangés sous votre compte ; chacun est titré de son nom pour que le modèle cite sa source.">Fichiers de renfort</span>
            {aSupprimer && (
              <Confirmer question={`Supprimer ${aSupprimer.nom} ?`} detail={`${poids(aSupprimer.taille)} · il ne sera plus joint aux lettres.`} action="Supprimer"
                onAnnuler={() => setASupprimer(null)} onConfirmer={() => {
                  void pieces.supprimer(aSupprimer.nom);
                  setASupprimer(null);
                }} />
            )}
            <ListeFichiers route="/pieces-lettre" accept=".md,.txt,.json,.csv,text/*" compact sorte="Fichier de renfort" portee="propre à votre compte"
              gestion={pieces} aSupprimer={setASupprimer} vise={aSupprimer?.nom} />
          </div>
        </div>
      </div>
    ),
    pied: <button type="button" className="action plein" disabled={!change} title={change ? undefined : "Rien n'a changé"} onClick={enregistrer}>Enregistrer<span className="ico">{ICONES.fleche}</span></button>,
  };
}

// Modèle de CV spontané, un par fenêtre (vierge pour « Nouveau modèle ») : à qui il s'adresse, ce qu'il met en avant, sa mise en page, les échanges avec le Constructeur ; sa saisie et son pied sont les siens
function FicheModele({ depart, d, enregistre }: { depart?: Modele; d: Documents; enregistre: (nom: string) => void }) {
  const { fermer } = usePanneau();
  const [m, setM] = useState<(Modele & { original: string }) | null>(() => (depart ? { ...depart, original: depart.nom } : null));
  const [rubriques, setRubriques] = useState<[string, string[]][] | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [batit, setBatit] = useState(false);
  const base = useId();
  const profil = m?.profil ?? '';
  useEffect(() => {
    if (!profil) return setRubriques([]);
    let vivant = true;
    setRubriques(null);
    // Les compétences d'un profil comme le Constructeur les lit : par rubrique, en liste ou en texte à virgules
    appeler<{ contenu: string }>(`/profils-candidature/${encodeURIComponent(profil)}`).then((r) => {
      const lues = Object.entries((JSON.parse(r.contenu)?.competences ?? {}) as Record<string, string | string[]>)
        .map(([rub, l]): [string, string[]] => [rub, (typeof l === 'string' ? l.split(',') : l ?? []).map((c) => String(c).trim()).filter(Boolean)])
        .filter(([, l]) => l.length);
      if (vivant) setRubriques(lues);
    }).catch((e) => {
      if (vivant) setRubriques([]);
      d.dire(`Compétences du profil illisibles : ${message(e)}`, true);
    });
    return () => {
      vivant = false;
    };
    // Relues quand le profil choisi change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil]);
  // Supprimé ailleurs, ou jamais trouvé : la fenêtre le dit ; renommé, il est retrouvé sous son nouveau nom
  if (!m || (m.original && !d.parametres?.cv_spontanes?.some((x) => x.nom === m.original))) return <p className="texte-f">Ce modèle n&apos;existe plus.</p>;
  const changer = (champs: Partial<Modele>) => setM({ ...m, ...champs });
  const choisies = new Set(m.competences.map((c) => c.toLowerCase()));
  const enregistrer = async (avis = true) => {
    const nom = m.nom.trim();
    if (!nom) {
      d.dire("Donnez un nom au modèle avant de l'enregistrer.", true);
      return null;
    }
    const { original, ...modele } = { ...m, nom, destination: m.destination.trim(), poste: m.poste.trim() };
    const liste = [...(d.parametres?.cv_spontanes ?? [])];
    const rang = liste.findIndex((x) => x.nom === original);
    if (rang >= 0) liste[rang] = modele;
    else liste.push(modele);
    if (!await d.enregistrer({ cv_spontanes: liste }, avis ? `Modèle « ${nom} » enregistré.` : '')) return null;
    setM({ ...modele, original: nom });
    return nom;
  };
  const sauver = async () => {
    const nom = await enregistrer();
    if (nom) enregistre(nom);
  };
  const batir = async () => {
    // Ce qui est saisi part d'abord : le serveur bâtit le modèle tel qu'il est écrit à l'écran
    const nom = await enregistrer(false);
    if (!nom) return;
    setBatit(true);
    try {
      const bati = await appeler<Modele>(`/cv-spontanes/${encodeURIComponent(nom)}/batir`, { methode: 'POST' });
      d.setParametres(await appeler<Parametres>('/parametres'));
      setM({ ...bati, original: bati.nom });
      d.dire(`CV spontané « ${bati.nom} » bâti.`);
      // Nouveau ou renommé, il ne passe à la fenêtre de son nom qu'une fois bâti, pour que « Mise en page… » reste sous les yeux
      enregistre(bati.nom);
    } catch (e) {
      d.dire(message(e), true);
    }
    setBatit(false);
  };
  const reprendre = () => {
    const f = d.formulaires.constructeur;
    changer({ constructeur: false, fond: d.parametres?.constructeur_fond ?? '', palette: f.palette.length ? f.palette : d.parametres?.constructeur_palette ?? [],
      ...(d.profils.includes(f.profil) ? { profil: f.profil } : {}), ...(f.poste ? { poste: f.poste } : {}) });
    d.dire('Paramètres du Constructeur repris : ils ne valent plus que pour ce modèle. Enregistrez-le pour les garder.');
  };
  const envoyer = async () => {
    d.changerFormulaire('constructeur', { ...(d.profils.includes(m.profil) ? { profil: m.profil } : {}), poste: m.poste, ...(m.constructeur ? {} : { palette: m.palette }) });
    // Le fond du Constructeur est un réglage du compte : l'envoyer le change pour tous ses CV
    const fond = !m.constructeur && m.fond !== (d.parametres?.constructeur_fond ?? '');
    if (fond && !await d.enregistrer({ constructeur_fond: m.fond }, '')) return;
    d.dire(`Profil, poste${m.constructeur ? '' : ' et palette'} envoyés au Constructeur${fond ? `, et son fond réglé sur « ${m.fond || 'tiré au sort'} »` : ''}.`);
  };
  const supprimer = async () => {
    if (await d.enregistrer({ cv_spontanes: (d.parametres?.cv_spontanes ?? []).filter((x) => x.nom !== m.original) }, `Modèle « ${m.original} » supprimé.`)) fermer();
  };
  const id = (c: string) => `${base}-${c}`;
  return (
    <>
      {confirmer && (
        <Confirmer question={`Supprimer le modèle « ${m.original} » ?`} detail="Son PDF bâti n'est plus proposé aux candidatures spontanées." action="Supprimer"
          onAnnuler={() => setConfirmer(false)} onConfirmer={() => void supprimer()} />
      )}
      <form className="docs-f" aria-label="Modèle de CV spontané" onSubmit={(e) => { e.preventDefault(); void sauver(); }}>
        <div className="section-f">
          <div className="grille-2">
            <div className="champ"><label htmlFor={id('nom')}>Nom</label><input id={id('nom')} className="saisie" placeholder="ESN" value={m.nom} onChange={(e) => changer({ nom: e.target.value })} /></div>
            <div className="champ"><label htmlFor={id('poste')}>Poste en tête du CV</label><input id={id('poste')} className="saisie" placeholder="Vide : celui du profil" value={m.poste} onChange={(e) => changer({ poste: e.target.value })} /></div>
          </div>
          <div className="champ"><label htmlFor={id('dest')} title="Ce que l'IA lit pour choisir ce CV face à un employeur.">Destiné à</label>
            <textarea id={id('dest')} className="saisie court" rows={2} placeholder="ESN et cabinets de conseil qui placent des consultants chez leurs clients" value={m.destination} onChange={(e) => changer({ destination: e.target.value })} /></div>
          <div className="grille-2">
            <div className="champ"><label htmlFor={id('profil')}>Profil mis en page</label>
              <select id={id('profil')} className="saisie" value={m.profil} onChange={(e) => changer({ profil: e.target.value, competences: [] })}>
                <option value="">— choisir un profil —</option>
                {[...new Set([...d.profils, ...(m.profil ? [m.profil] : [])])].map((p) => <option key={p} value={p}>{sansJson(p)}</option>)}
              </select></div>
            <div className="champ"><span className="lib-champ">Mise en page</span>
              <div><label className="inter" title={`Cochée : le fond et la palette réglés pour le Constructeur au moment de bâtir — aujourd'hui ${d.parametres?.constructeur_fond || 'fond tiré au sort'} —, sans rien recopier.`}>
                celle du Constructeur<input type="checkbox" checked={m.constructeur} onChange={(e) => changer({ constructeur: e.target.checked })} /></label></div></div>
          </div>
          {!m.constructeur && (
            <div className="grille-2">
              <div className="champ"><label htmlFor={id('fond')}>Fond</label>
                <select id={id('fond')} className="saisie" value={m.fond} onChange={(e) => changer({ fond: e.target.value })}>
                  {FONDS.map((f) => <option key={f} value={f}>{f || 'Tiré au sort'}</option>)}
                </select></div>
              <div className="champ"><span className="lib-champ">Palette</span><Couleurs valeurs={m.palette} changer={(palette) => changer({ palette })} libelle="Palette du modèle" /></div>
            </div>
          )}
          <div className="gestes">
            <button type="button" className="action" title="Recopie dans ce modèle le profil et le poste de « Nouveau CV », son fond et sa palette : ils ne valent plus que pour ce modèle." onClick={reprendre}>
              <span className="ico">{ICONES.reprendre}</span>Reprendre du Constructeur</button>
            <button type="button" className="action" title="Recopie dans « Nouveau CV » le profil, le poste et la palette de ce modèle. Son fond devient celui de tous vos CV." onClick={() => void envoyer()}>
              <span className="ico">{ICONES.envoyer}</span>Envoyer au Constructeur</button>
          </div>
        </div>
        <div className="section-f"><h3>Compétences</h3>
          <p className="lib-champ lib-bloc">Mises en avant, en tête du CV <span className="compteur">{m.competences.length}</span></p>
          {m.competences.length ? (
            <div className="puces">{m.competences.map((c) => (
              <button key={c} type="button" className="puce" title="Retirer" aria-label={`Retirer ${c}`} onClick={() => changer({ competences: m.competences.filter((x) => x !== c) })}>{c}<b>−</b></button>
            ))}</div>
          ) : <p className="aide-champ">Aucune : le CV garde l&apos;ordre du profil.</p>}
          <p className="lib-champ lib-bloc profil-c">Compétences du profil</p>
          {!m.profil ? <p className="aide-champ">Choisissez le profil mis en page : ses compétences s&apos;affichent ici.</p>
            : rubriques === null ? <p className="aide-champ">Lecture du profil…</p>
              : !rubriques.length ? <p className="aide-champ">Ce profil ne déclare aucune compétence.</p>
                : rubriques.map(([rub, noms]) => (
                  <div key={rub} className="rubrique"><span className="lib-r" title={rub}>{rub}</span>
                    <div className="puces">{noms.map((c) => (choisies.has(c.toLowerCase())
                      ? <button key={c} type="button" className="puce actif" title="Ne plus la mettre en avant" onClick={() => changer({ competences: m.competences.filter((x) => x.toLowerCase() !== c.toLowerCase()) })}>{c}<b>−</b></button>
                      : <button key={c} type="button" className="puce" title="La mettre en avant" onClick={() => changer({ competences: [...m.competences, c] })}>{c}<b>+</b></button>))}</div>
                  </div>
                ))}
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      <AuPied>
        {m.original && <button type="button" className="action rouge gauche" onClick={() => setConfirmer(true)}><span className="ico">{ICONES.supprimer}</span>Supprimer</button>}
        <button type="button" className="action" onClick={() => void sauver()}>Enregistrer</button>
        <button type="button" className="action plein" disabled={batit} onClick={() => void batir()}>
          {batit ? 'Mise en page…' : m.cv ? 'Rebâtir le CV' : 'Bâtir le CV'}<span className="ico">{ICONES.fleche}</span>
        </button>
      </AuPied>
    </>
  );
}

