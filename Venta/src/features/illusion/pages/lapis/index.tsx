'use client';

import './lapis.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';

import { Fenetre, usePanneau } from '../../dock/Dock';
import { MarqueAdmin, Panneau, type Onglet } from '../../dock/Panneau';
import { ongletFicheOffre } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import { decouper, useEchap, useGeste, useLecture, PaginationAller, usePagination } from '../commun';
import { Action } from '../../elements/Action';
import { Champ, ChampSaisie, ChampListe, Interrupteur, OptionsModele } from '../../elements/Champ';
import { ActionOnglet } from '../../elements/Groupes';
import { Menu, OptionMenu } from '../../elements/Menu';
import { ICONES } from '../../elements/icones';
import { useAvis, type Dire } from '../../elements/Avis';
import { jourMoisIso, lienSur, message, parVirgules } from '../../elements/format';
import { PageDock } from '../../activite/PageDock';

// Ce que /lapis rend : personnes, offres, événements et derniers posts lus.
type Degre = '1' | '2' | '3';
type Personne = {
  profil_url: string; nom: string; titre: string; photo: string; entreprise: string; poste: string; relation: Degre | ''; recherche: string;
  origine: { genre?: 'post' | 'offre'; url?: string; cle?: string; texte?: string };
};
type Post = {
  urn: string; url: string; auteur: string; auteur_titre: string; photo: string; nature: string; entreprise: string; recherche: string; lu_le: string;
  resume: string; texte?: string; offre: { intitule?: string; entreprise?: string; lieu?: string; lien?: string }; evenement: { nom?: string; date?: string; lieu?: string; lien?: string };
};
type Lapis = { personnes: Personne[]; offres: Post[]; evenements: Post[]; posts: Post[]; recherches: string[] };
type Sorte = 'personnes' | 'offres' | 'evenements' | 'posts';
// Une recherche du compte : personnes d'une cible, ou offres lues en posts
type RechercheLapis = {
  type: 'personnes' | 'offres'; actif: boolean; entreprise: string; secteur: number; postes: string[]; profils_max: number;
  relations: Degre[]; mots_cles: string; posts_max: number;
};
type OptionsLapis = { secteurs: { id: number; nom: string; groupe: string }[]; postes_rh: string[] };
type Parametres = { lapis_recherches: RechercheLapis[]; lapis_garder: boolean; lapis_modele: string; modeles?: { nom: string }[] };

const SORTES: [Sorte, string][] = [['personnes', 'Personnes'], ['offres', 'Offres repérées'], ['evenements', 'Événements'], ['posts', 'Posts lus']];
const VIDES: Record<Sorte, string> = {
  personnes: 'Aucune personne trouvée : ajoutez une recherche Personnes dans les Réglages, ou « Chercher des contacts » sur une offre repérée.',
  offres: 'Aucune offre repérée dans les posts lus.',
  evenements: 'Aucun événement repéré dans les posts lus.',
  posts: 'Aucun post lu : lancez une passe.',
};
const NATURES: Record<string, string> = { offre: 'Offre', evenement: 'Événement', autre: 'Autre' };
const DEGRES: Record<Degre, string> = { '1': '1er', '2': '2e', '3': '3e et +' };
const RELATIONS = Object.keys(DEGRES) as Degre[];
const TAILLES = [24, 48];
const initiales = (nom: string) => nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';


// Un lien qui ouvre LinkedIn ou le site dans un nouvel onglet, sans fenêtre
function Sortie({ href, children, className = 'lien', fleche = true }: { href?: string; children: React.ReactNode; className?: string; fleche?: boolean }) {
  const lien = lienSur(href);
  if (!lien) return null;
  return <a className={className} href={lien} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{children}{fleche && ICONES.sortie}</a>;
}

// La photo de LinkedIn, ses initiales derrière si le lien a expiré.
// La photo d'une carte et ce qui la décrit
function CartePhoto({ url, nom, children }: { url?: string; nom: string; children: React.ReactNode }) {
  return <div><Photo url={url} nom={nom} /><div className="qui">{children}</div></div>;
}

function Photo({ url, nom }: { url?: string; nom: string }) {
  const [vue, setVue] = useState(true);
  const lien = lienSur(url);
  return (
    <span className="initiales" aria-hidden="true">{initiales(nom)}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {vue && lien && <img src={lien} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setVue(false)} />}
    </span>
  );
}

export default function PageLapis({ compte }: ProprietesPage) {
  // Ce que LAPIS a trouvé est gardé d'une visite à l'autre et relu derrière.
  const { lu: donnees, erreur, relire } = useLecture<Lapis>('lapis', 'donnees', '/lapis');
  const { dire, vue: avis } = useAvis('avis-l', true);
  useEffect(() => {
    void relire();
  }, [relire]);
  // Le serveur ne répond qu'à la fin de la passe : la galerie se relit à ce moment-là
  const suivre = useCallback(async () => {
    try {
      let fini = false;
      while (!fini) fini = (await appeler<{ fini: boolean }>('/lapis/attendre')).fini;
    } catch {
      // Serveur coupé : la galerie se relira à la prochaine visite
      return;
    }
    await relire();
  }, [relire]);
  return (
    <PageDock id="lapis" principal="galerie" fenetres={{ galerie: { mini: [470, 260] } }} panneau={null}>
      <Galerie donnees={donnees} erreur={erreur} avis={avis} dire={dire} suivre={suivre} />
      <PanneauLapis admin={compte.admin} donnees={donnees} dire={dire} relire={relire} suivre={suivre} />
    </PageDock>
  );
}

type ProprietesGalerie = { donnees: Lapis | null; erreur: string; avis: React.ReactNode; dire: Dire; suivre: () => Promise<void> };

// Fenêtre principale : quatre onglets, ce que la passe cherche, la galerie.
function Galerie({ donnees, erreur, avis, dire, suivre }: ProprietesGalerie) {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const [sorte, setSorte] = useState(() => repris<Sorte>('lapis:sorte', 'personnes'));
  const { page, setPage, taille, setTaille, auto, setAuto } = usePagination('lapis', 12);
  useGarder('lapis', { sorte });
  const { occupe, geste } = useGeste((t) => dire(t, true));
  const grille = useRef<HTMLDivElement>(null);

  // Échap ferme le panneau
  useEchap(fermer);

  const cartes = donnees?.[sorte] ?? [];
  const { pages, courante, visibles } = decouper<Personne | Post>(cartes, page, taille, auto);
  // « auto » : autant de cartes que la galerie en montre sans en couper une.
  const posees = visibles.length > 0;
  useLayoutEffect(() => {
    const g = grille.current;
    if (!g || !posees || taille !== 'auto') return;
    const mesurer = () => {
      const s = getComputedStyle(g);
      const pistes = (v: string) => v.split(' ').filter((p) => parseFloat(p) > 0).length;
      setAuto(Math.max(1, pistes(s.gridTemplateColumns) * pistes(s.gridTemplateRows)));
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(g);
    return () => observateur.disconnect();
  }, [posees, taille, sorte]);

  const lancer = () => geste(async () => {
    const r = await appeler<{ lancee: boolean }>('/briques/lapis/lancer', { methode: 'POST' });
    dire(r.lancee ? 'Passe lancée : LAPIS lit LinkedIn, sans contacter personne.' : 'Une passe de LAPIS tourne déjà.');
    void suivre();
  });
  const ouvrirOffre = (u: string) => ouvrir('offre', u);

  const libelle = SORTES.find(([s]) => s === sorte)?.[1] ?? '';
  return (
    <Fenetre id="galerie" as="main" className="tableau lapis" aria-label="LAPIS" titrePrise="Glisser pour détacher la galerie de LAPIS">
      <div className="outils">
        <div className="onglets-l" role="tablist" aria-label="Ce que LAPIS a trouvé">
          {SORTES.map(([s, nom]) => (
            <button key={s} type="button" role="tab" aria-selected={s === sorte} className={`filtre${s === sorte ? ' actif' : ''}`} onClick={() => { setSorte(s); setPage(1); }}>
              {nom}<span className="compteur">{donnees ? donnees[s].length : ''}</span>
            </button>
          ))}
        </div>
        {donnees && (
          <p className="resume">
            <span title={donnees.recherches.join(', ')}>Recherches : <b>{donnees.recherches.join(', ') || 'aucune'}</b></span>
          </p>
        )}
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">
          <ActionOnglet cle="reglages" icone={ICONES.reglages} title="Réglages">Réglages
          </ActionOnglet>
          <Action plein iconeApres={ICONES.jouer} disabled={occupe} title="Lance chaque recherche active de LAPIS ; personne n'est contacté" onClick={() => void lancer()}>
            Lancer une passe
          </Action>
        </div>
      </div>
      <div ref={grille} className={`galerie${taille === 'auto' ? ' ajuste' : ''}${sorte === 'evenements' || sorte === 'posts' ? ' haute' : ''}`} role="tabpanel" aria-label={libelle}>
        {sorte === 'personnes' && (visibles as Personne[]).map((p) => (
          <article key={p.profil_url} className="personne">
            <CartePhoto url={p.photo} nom={p.nom}>
                <b title={p.nom}>{p.relation && <span className="nature" title="Degré de relation LinkedIn">{DEGRES[p.relation]}</span>}{p.nom || '—'}</b>
                <span className="titre-p" title={p.titre}>{p.titre}</span>
                <span className="poste" title={`${p.entreprise} · poste cherché : ${p.poste}`}>{p.entreprise || '—'} · <i>poste cherché :</i> {p.poste || '—'}</span>
                <Sortie href={p.profil_url}>Profil LinkedIn</Sortie>
                {p.recherche && <span className="origine" title={p.recherche}>Recherche « {p.recherche} »</span>}
                {p.origine.genre === 'post' && <span className="origine" title={p.origine.texte}>Vue dans un post · <Sortie href={p.origine.url} className="" fleche={false}>voir le post</Sortie></span>}
                {p.origine.genre === 'offre' && p.origine.cle && (
                  <span className="origine">Cherchée pour l&apos;offre <button type="button" aria-haspopup="dialog" data-ouvre="fiche-offre" data-objet={p.origine.cle} onClick={() => ouvrir('fiche-offre', p.origine.cle!)}>{p.origine.texte}</button></span>
                )}
              </CartePhoto>
          </article>
        ))}
        {sorte === 'offres' && (visibles as Post[]).map((o) => {
          const entreprise = o.offre.entreprise || o.entreprise;
          return (
            <article key={o.urn} className={`personne cliquable${onglet === 'offre' && objet === o.urn ? ' ouverte' : ''}`} data-ouvre="offre" data-objet={o.urn} onClick={() => ouvrirOffre(o.urn)}>
              <CartePhoto url={o.photo} nom={o.auteur}>
                  <b><button type="button" className="titre-c" aria-haspopup="dialog" title={o.offre.intitule || o.resume} data-ouvre="offre" data-objet={o.urn} onClick={(e) => { e.stopPropagation(); ouvrirOffre(o.urn); }}>{o.offre.intitule || o.resume}</button></b>
                  <span className="titre-p">{[entreprise, o.offre.lieu].filter(Boolean).join(' · ') || '—'}</span>
                  <span className="poste" title={[o.auteur, o.auteur_titre].filter(Boolean).join(', ')}><i>Publiée par</i> {o.auteur || '—'}</span>
                  <Sortie href={o.url}>Voir le post</Sortie>
                  <span className="origine">Lue le {jourMoisIso(o.lu_le)} · « {o.recherche} »</span>
                </CartePhoto>
            </article>
          );
        })}
        {sorte === 'evenements' && (visibles as Post[]).map((e) => (
          <article key={e.urn} className="personne">
            <CartePhoto url={e.photo} nom={e.auteur}>
                <b title={e.evenement.nom || e.resume}>{e.evenement.nom || e.resume}</b>
                <span className="titre-p">{[e.evenement.date, e.evenement.lieu].filter(Boolean).join(' · ') || 'date et lieu non précisés'}</span>
                <span className="poste">{e.entreprise || e.auteur || '—'}</span>
                <span className="liens"><Sortie href={e.url}>Voir le post</Sortie><Sortie href={e.evenement.lien}>Page de l&apos;événement</Sortie></span>
                <span className="resume-c" title={e.resume}>{e.resume}</span>
              </CartePhoto>
          </article>
        ))}
        {sorte === 'posts' && (visibles as Post[]).map((p) => (
          <article key={p.urn} className="personne">
            <CartePhoto url={p.photo} nom={p.auteur}>
                <b title={p.auteur}>{p.auteur || '—'}</b>
                <span className="titre-p" title={p.auteur_titre}>{p.auteur_titre}</span>
                <span className="poste"><span className="nature">{NATURES[p.nature] ?? p.nature}</span>« {p.recherche} », lu le {jourMoisIso(p.lu_le)}</span>
                <Sortie href={p.url}>Voir le post</Sortie>
                <span className="resume-c" title={p.resume}>{p.resume}</span>
              </CartePhoto>
          </article>
        ))}
        {(erreur || (donnees && !cartes.length)) && (
          <p className={`vide-l${erreur ? ' erreur' : ''}`} role={erreur ? 'alert' : undefined}>
            {/* Des recherches actives qui n'ont rien ramené : aucun résultat */}
            {erreur ? `LAPIS illisible : ${erreur}` : donnees?.recherches.length ? 'Aucun résultat.' : VIDES[sorte]}
          </p>
        )}
      </div>
      {avis}
      <PaginationAller page={courante} pages={pages} setPage={setPage} taille={taille} tailles={TAILLES} auto={auto} libelle="Cartes par page" setTaille={(t) => {
        setTaille(t);
        setPage(1);
      }}>
        <span className="espace" />
        <span className="compteur">{donnees ? `${cartes.length} ${libelle.toLowerCase()}` : ''}</span>
      </PaginationAller>
    </Fenetre>
  );
}

// Panneau : offres repérées, fiches des offres cherchées, puis Réglages.
function PanneauLapis({ admin, donnees, dire, relire, suivre }: { admin: boolean; donnees: Lapis | null; dire: Dire; relire: () => Promise<void>; suivre: () => Promise<void> }) {
  const { onglet, fermer } = usePanneau();
  const reglages = useOngletReglages({ admin, actif: onglet === 'reglages', fermer, dire, relire });
  const elements = {
    offre: (urn: string) => ongletOffre(urn, donnees, dire, suivre),
    'fiche-offre': (cle: string) => ongletFicheOffre(cle),
  };
  return <Panneau elements={elements} onglets={[reglages]} />;
}

type Cible = 'tout' | 'entreprise' | 'secteur';
// Une recherche en saisie : sa cible, ses postes et ses nombres en texte
type Carte = Omit<RechercheLapis, 'postes' | 'profils_max' | 'posts_max'> & { cible: Cible; postes: string; profils_max: string; posts_max: string };
type Formulaire = { recherches: Carte[]; garder: boolean; modele: string };

type Secteur = OptionsLapis['secteurs'][number];
// Sans accents ni casse : « energie » trouve « Énergie »
const plat = (texte: string) => texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Secteur choisi dans sa liste, filtrée à mesure qu'on tape
function ChoixSecteur({ id, secteurs, valeur, changer }: { id: string; secteurs: Secteur[]; valeur: number; changer: (secteur: number) => void }) {
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const choisi = secteurs.find((s) => s.id === valeur);
  const trouves = secteurs.filter((s) => plat(`${s.nom} ${s.groupe}`).includes(plat(q.trim())));
  const prendre = (s: Secteur) => {
    changer(s.id);
    setQ('');
    setOuvert(false);
  };
  return (
    <Champ pour={id} libelle="Secteur">
      <div className="menu-hote secteur-hote">
        <input
          id={id} className={`saisie${ouvert && trouves.length > 0 ? ' ouvert' : ''}`} type="search" role="combobox" autoComplete="off" placeholder={choisi?.nom ?? 'Chercher un secteur…'}
          value={ouvert ? q : choisi?.nom ?? ''} aria-autocomplete="list" aria-expanded={ouvert && trouves.length > 0} aria-controls={`${id}-liste`}
          onFocus={() => setOuvert(true)}
          onBlur={() => { setOuvert(false); setQ(''); }}
          onChange={(e) => { setQ(e.target.value); setOuvert(true); }}
          onKeyDown={(e) => {
            // Entrée prend le premier secteur trouvé, sans enregistrer les réglages
            if (e.key === 'Enter' && ouvert && trouves[0]) {
              e.preventDefault();
              e.stopPropagation();
              prendre(trouves[0]);
            } else if (e.key === 'Escape' && ouvert) {
              e.preventDefault();
              e.stopPropagation();
              setOuvert(false);
              setQ('');
            }
          }}
        />
        {ouvert && trouves.length > 0 && (
          // Au-dessus de la page, comme les listes natives : son verre floute ce qu'il couvre
          <Menu id={`${id}-liste`} role="listbox" aria-label="Secteurs LinkedIn" className="menu-secteurs" popover="manual"
            ref={(menu) => { if (menu && !menu.matches(':popover-open')) menu.showPopover(); }}>
            <div className="menu-liste">
              {trouves.map((s) => (
                <OptionMenu key={s.id} actif={s.id === valeur} onMouseDown={(e) => e.preventDefault()} onClick={() => prendre(s)}>
                  <span className="nom">{s.nom}</span><span className="groupe">{s.groupe}</span>
                </OptionMenu>
              ))}
            </div>
          </Menu>
        )}
      </div>
    </Champ>
  );
}

// Réglages LAPIS : la liste des recherches ; le modèle est à l'admin.
function useOngletReglages({ admin, actif, fermer, dire, relire }: {
  admin: boolean; actif: boolean; fermer: () => void; dire: Dire; relire: () => Promise<void>;
}): Onglet {
  // Réglages gardés d'une visite à l'autre, relus à la première ouverture.
  const [lu, setLu] = useState(() => repris<Formulaire | null>('lapis:reglages2', null));
  const [f, setF] = useState<Formulaire | null>(lu);
  const [modeles, setModeles] = useState(() => repris<{ nom: string }[]>('lapis:modeles', []));
  const [options, setOptions] = useState(() => repris<OptionsLapis>('lapis:options', { secteurs: [], postes_rh: [] }));
  useGarder('lapis', { reglages2: lu, modeles, options });
  const [erreur, setErreur] = useState('');
  const { occupe, geste } = useGeste(setErreur);
  const relu = useRef(false);
  const lire = useCallback(async (ouverture = false) => {
    try {
      // Secteurs et postes RH par défaut : lus à l'ouverture seulement
      const [p, o] = await Promise.all([appeler<Parametres>('/parametres'), ouverture ? appeler<OptionsLapis>('/lapis/options') : null]);
      const forme = {
        recherches: p.lapis_recherches.map((r): Carte => ({ ...r, cible: r.entreprise ? 'entreprise' : r.secteur ? 'secteur' : 'tout',
          postes: r.postes.join(', '), profils_max: String(r.profils_max), posts_max: String(r.posts_max) })),
        garder: !!p.lapis_garder,
        modele: p.lapis_modele ?? '',
      };
      setLu(forme);
      setF(forme);
      setModeles(p.modeles ?? []);
      if (o) setOptions(o);
      setErreur('');
    } catch (e) {
      // Une lecture ratée se retente à la prochaine ouverture
      relu.current = false;
      setErreur(message(e));
    }
  }, []);
  useEffect(() => {
    if (!actif || relu.current) return;
    relu.current = true;
    void lire(true);
  }, [actif, lire]);
  const change = !!f && JSON.stringify(f) !== JSON.stringify(lu);
  const enregistrer = () => {
    if (!f || !change) return;
    return geste(async () => {
      await appeler('/parametres', { methode: 'PUT', corps: {
        lapis_recherches: f.recherches.map((r): RechercheLapis => ({
          type: r.type, actif: r.actif, entreprise: r.entreprise.trim(), secteur: r.secteur, postes: parVirgules(r.postes),
          profils_max: parseInt(r.profils_max, 10) || 0, relations: r.relations, mots_cles: r.mots_cles.trim(), posts_max: parseInt(r.posts_max, 10) || 0,
        })),
        lapis_garder: !!f.garder,
        ...(admin ? { lapis_modele: f.modele } : {}),
      } });
      dire('Réglages de LAPIS enregistrés : ils valent dès la prochaine passe.');
      await Promise.all([lire(), relire()]);
    });
  };
  const modifier = (i: number, champs: Partial<Carte>) => setF((v) => (v ? { ...v, recherches: v.recherches.map((r, j) => (j === i ? { ...r, ...champs } : r)) } : v));
  // Une recherche neuve : active, sur tout LinkedIn, aux volumes par défaut
  const ajouter = (type: RechercheLapis['type']) => setF((v) => (v ? { ...v, recherches: [...v.recherches, {
    type, actif: true, cible: 'tout', entreprise: '', secteur: 0, postes: type === 'personnes' ? options.postes_rh.join(', ') : '',
    profils_max: '25', relations: RELATIONS, mots_cles: '', posts_max: '10',
  }] } : v));
  return {
    cle: 'reglages', titre: 'Réglages', label: 'Réglages · LAPIS',
    corps: (
      <div className="section-f lapis-reglages" onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).matches('input:not([type=checkbox])') && !occupe && void enregistrer()}>
        <div className="cartes">
          {f?.recherches.map((r, i) => (
            <article key={i} className="carte-f">
              <div className="carte-tete">
                <h3>{r.type === 'personnes' ? 'Personnes' : 'Offres dans les posts'}</h3>
                <Interrupteur libelle="Active" title="Décochée, la recherche reste dans la liste sans être menée." checked={r.actif} onChange={(e) => modifier(i, { actif: e.target.checked })} />
                <button type="button" className="lien-d" aria-label={`Retirer la recherche ${i + 1}`} onClick={() => setF((v) => (v ? { ...v, recherches: v.recherches.filter((_, j) => j !== i) } : v))}>Retirer</button>
              </div>
              {r.type === 'personnes' ? (
                <>
                  {/* Le serveur refuse une entreprise et un secteur ensemble */}
                  <ChampListe id={`l${i}-cible`} libelle="Cible" value={r.cible} onChange={(e) => modifier(i, { cible: e.target.value as Cible, entreprise: '', secteur: 0 })}>
                    <option value="tout">Tout LinkedIn</option>
                    <option value="entreprise">Une entreprise</option>
                    <option value="secteur">Un secteur</option>
                  </ChampListe>
                  {r.cible === 'entreprise' && (
                    <ChampSaisie id={`l${i}-ent`} libelle="Entreprise" aide="Nom ou lien LinkedIn de l'entreprise." value={r.entreprise} onChange={(e) => modifier(i, { entreprise: e.target.value })} />
                  )}
                  {r.cible === 'secteur' && (
                    <ChoixSecteur id={`l${i}-sect`} secteurs={options.secteurs} valeur={r.secteur} changer={(secteur) => modifier(i, { secteur })} />
                  )}
                  <ChampSaisie id={`l${i}-postes`} libelle="Postes recherchés" aide="Séparés par des virgules. Vide : les postes RH par défaut." value={r.postes} onChange={(e) => modifier(i, { postes: e.target.value })} />
                  <label className="reglage">Profils maximum<input className="saisie" type="number" min={1} max={100} value={r.profils_max} onChange={(e) => modifier(i, { profils_max: e.target.value })} /></label>
                  <Champ groupe libelle="Relations" titre="Au moins un degré reste coché." role="group" aria-label="Relations">
                    <span className="puces">
                      {RELATIONS.map((d) => (
                        <label key={d} className="choix puce-p">
                          <input type="checkbox" className="cache" checked={r.relations.includes(d)} onChange={(e) => {
                            const relations = RELATIONS.filter((x) => (x === d ? e.target.checked : r.relations.includes(x)));
                            if (relations.length) modifier(i, { relations });
                          }} />
                          {DEGRES[d]}
                        </label>
                      ))}
                    </span>
                  </Champ>
                </>
              ) : (
                <>
                  <ChampSaisie id={`l${i}-mots`} libelle="Mots-clés" aide="Comme les recherches de la veille. Vide : les intitulés cherchés des profils de recherche menés." value={r.mots_cles} onChange={(e) => modifier(i, { mots_cles: e.target.value })} />
                  <label className="reglage">Posts maximum<input className="saisie" type="number" min={1} max={50} value={r.posts_max} onChange={(e) => modifier(i, { posts_max: e.target.value })} /></label>
                </>
              )}
            </article>
          ))}
          {f && !f.recherches.length && <p className="texte-f">Aucune recherche : une passe ne lit rien.</p>}
        </div>
        <div className="actions ajouts-l" role="group" aria-label="Ajouter une recherche">
          <Action icone={ICONES.plus_pages} disabled={!f} title="Ajouter une recherche de personnes" onClick={() => ajouter('personnes')}>Personnes</Action>
          <Action icone={ICONES.plus_pages} disabled={!f} title="Ajouter une recherche d'offres dans les posts" onClick={() => ajouter('offres')}>Offres dans les posts</Action>
        </div>
        <Interrupteur libelle="Garder les résultats précédents" checked={!!f?.garder} disabled={!f} onChange={(e) => setF((v) => (v ? { ...v, garder: e.target.checked } : v))} />
        <p className="aide-champ">Désactivé, chaque passe remplace les personnes trouvées par les passes d&apos;avant ; activé, elle les ajoute.</p>
        {admin && (
          <ChampListe id="l-modele" libelle={<>Modèle<MarqueAdmin /></>} aide="Il lit les posts des recherches Offres ; vide : celui des mails." value={f?.modele ?? ''} disabled={!f} onChange={(e) => setF((v) => (v ? { ...v, modele: e.target.value } : v))}>
              <OptionsModele modeles={modeles} vide="Aucun" valeur={f?.modele ?? ''} detail={false} />
            </ChampListe>
        )}
        {erreur && <p className="erreur-f" role="alert">{erreur}</p>}
      </div>
    ),
    pied: (
      <>
        <Action onClick={() => { setF(lu); setErreur(''); fermer(); }}>Annuler</Action>
        <Action plein iconeApres={ICONES.valider} disabled={!change || occupe} onClick={() => void enregistrer()}>Enregistrer</Action>
      </>
    ),
  };
}

// Offre repérée : son post, contacts chez l'employeur ou file ; aucun contact.
function ongletOffre(urn: string, donnees: Lapis | null, dire: Dire, suivre: () => Promise<void>): Onglet | null {
  const post = donnees?.offres.find((o) => o.urn === urn);
  // Pas encore relu : la fenêtre attend ; relu sans ce post, elle est vide.
  if (!post) return donnees ? null : { cle: 'offre', titre: 'Offre', label: 'Offre repérée', corps: <p className="texte-f">Lecture de LAPIS…</p> };
  const o = post.offre;
  const entreprise = o.entreprise || post.entreprise;
  return {
    cle: 'offre', titre: `Offre · ${entreprise || '—'}`, label: `Offre repérée · ${o.intitule || post.resume}${entreprise ? ` chez ${entreprise}` : ''}`,
    corps: (
      <div className="lapis-offre">
        <div className="auteur"><Photo url={post.photo} nom={post.auteur} /><p><b>{o.intitule || '—'}</b>{[entreprise, o.lieu].filter(Boolean).join(' · ')}</p></div>
        <p className="resume-offre">{post.resume}</p>
        <ul className="liste-f">
          <li>Publiée par<span className="d">{[post.auteur, post.auteur_titre].filter(Boolean).join(', ') || '—'}</span></li>
          <li>Lue le<span className="d">{jourMoisIso(post.lu_le)}, recherche « {post.recherche} »</span></li>
          {o.lien && <li>Lien de l&apos;offre<Sortie href={o.lien} className="d">{o.lien.replace(/^https?:\/\//i, '')}</Sortie></li>}
          <li>Post<Sortie href={post.url} className="d">Voir le post</Sortie></li>
        </ul>
        {post.texte && <p className="resume-offre texte-post">{post.texte}</p>}
      </div>
    ),
    pied: <PiedOffre key={urn} post={post} dire={dire} suivre={suivre} />,
  };
}

// Chaque geste d'une offre repérée occupe sa fenêtre le temps de son appel.
function PiedOffre({ post, dire, suivre }: { post: Post; dire: Dire; suivre: () => Promise<void> }) {
  const { occupe, geste } = useGeste((t) => dire(t, true));
  const o = post.offre;
  const entreprise = o.entreprise || post.entreprise;
  const contacts = () => geste(async () => {
    dire((await appeler<{ lancee: boolean }>('/lapis/contacts', { methode: 'POST', corps: { post_urn: post.urn } })).lancee
      ? "LAPIS cherche des contacts chez cet employeur ; personne n'est contacté." : 'Une passe de LAPIS tourne déjà.');
    void suivre();
  });
  const ajouter = () => geste(async () => dire((await appeler<{ neuve: boolean }>('/offres', { methode: 'POST', corps: {
    url: o.lien, entreprise: entreprise || '', titre: o.intitule || '', lieu: o.lieu || '' } })).neuve ? 'Offre ajoutée à la file.' : 'Cette offre était déjà en base.'));
  return (
    <>
      {entreprise && <Action icone={ICONES.contacts} disabled={occupe} onClick={() => void contacts()}>Chercher des contacts</Action>}
      {o.lien && <Action plein iconeApres={ICONES.plus_pages} disabled={occupe} onClick={() => void ajouter()}>Ajouter à la file</Action>}
    </>
  );
}
