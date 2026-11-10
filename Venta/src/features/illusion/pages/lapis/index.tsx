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
import { ChampSaisie, ChampListe, OptionsModele } from '../../elements/Champ';
import { ActionOnglet } from '../../elements/Groupes';
import { ICONES } from '../../elements/icones';
import { useAvis, type Dire } from '../../elements/Avis';
import { jourMoisIso, lienSur, message, parVirgules } from '../../elements/format';
import { PageDock } from '../../activite/PageDock';

// Ce que /lapis rend : personnes, offres, événements et derniers posts lus.
type Personne = {
  profil_url: string; nom: string; titre: string; photo: string; entreprise: string; poste: string;
  origine: { genre?: 'post' | 'offre'; url?: string; cle?: string; texte?: string };
};
type Post = {
  urn: string; url: string; auteur: string; auteur_titre: string; photo: string; nature: string; entreprise: string; recherche: string; lu_le: string;
  resume: string; offre: { intitule?: string; entreprise?: string; lieu?: string; lien?: string }; evenement: { nom?: string; date?: string; lieu?: string; lien?: string };
};
type Lapis = { personnes: Personne[]; offres: Post[]; evenements: Post[]; posts: Post[]; recherches: string[]; postes: string[] };
type Sorte = 'personnes' | 'offres' | 'evenements' | 'posts';
type Parametres = {
  lapis_recherches: string[]; lapis_postes: string[]; lapis_posts_par_recherche: number; lapis_personnes_par_poste: number;
  lapis_entreprises_par_passe: number; lapis_modele: string; modeles?: { nom: string }[];
};

const SORTES: [Sorte, string][] = [['personnes', 'Personnes'], ['offres', 'Offres repérées'], ['evenements', 'Événements'], ['posts', 'Posts lus']];
const VIDES: Record<Sorte, string> = {
  personnes: 'Aucune personne trouvée : lancez une passe, ou « Chercher des contacts » sur une offre repérée.',
  offres: 'Aucune offre repérée dans les posts lus.',
  evenements: 'Aucun événement repéré dans les posts lus.',
  posts: 'Aucun post lu : lancez une passe.',
};
const NATURES: Record<string, string> = { offre: 'Offre', evenement: 'Événement', autre: 'Autre' };
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
  return (
    <PageDock id="lapis" principal="galerie" fenetres={{ galerie: { mini: [470, 260] } }} panneau={null}>
      <Galerie donnees={donnees} erreur={erreur} avis={avis} dire={dire} />
      <PanneauLapis admin={compte.admin} donnees={donnees} dire={dire} relire={relire} />
    </PageDock>
  );
}

type ProprietesGalerie = { donnees: Lapis | null; erreur: string; avis: React.ReactNode; dire: Dire };

// Fenêtre principale : quatre onglets, ce que la passe cherche, la galerie.
function Galerie({ donnees, erreur, avis, dire }: ProprietesGalerie) {
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
            <span>Recherches : <b>{donnees.recherches.join(', ') || 'aucune'}</b></span>
            <span>postes : <b>{donnees.postes.join(', ') || 'aucun'}</b></span>
          </p>
        )}
        <span className="espace" />
        <div className="actions" role="group" aria-label="Actions">
          <ActionOnglet cle="reglages" icone={ICONES.reglages} title="Réglages">Réglages
          </ActionOnglet>
          <Action plein iconeApres={ICONES.jouer} disabled={occupe} title="Lit les posts récents de chaque recherche, puis fouille les employeurs qu'ils nomment ; personne n'est contacté" onClick={() => void lancer()}>
            Lancer une passe
          </Action>
        </div>
      </div>
      <div ref={grille} className={`galerie${taille === 'auto' ? ' ajuste' : ''}${sorte === 'evenements' || sorte === 'posts' ? ' haute' : ''}`} role="tabpanel" aria-label={libelle}>
        {sorte === 'personnes' && (visibles as Personne[]).map((p) => (
          <article key={p.profil_url} className="personne">
            <CartePhoto url={p.photo} nom={p.nom}>
                <b title={p.nom}>{p.nom || '—'}</b>
                <span className="titre-p" title={p.titre}>{p.titre}</span>
                <span className="poste" title={`${p.entreprise} · poste cherché : ${p.poste}`}>{p.entreprise || '—'} · <i>poste cherché :</i> {p.poste || '—'}</span>
                <Sortie href={p.profil_url}>Profil LinkedIn</Sortie>
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
          <p className={`vide-l${erreur ? ' erreur' : ''}`} role={erreur ? 'alert' : undefined}>{erreur ? `LAPIS illisible : ${erreur}` : VIDES[sorte]}</p>
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
function PanneauLapis({ admin, donnees, dire, relire }: { admin: boolean; donnees: Lapis | null; dire: Dire; relire: () => Promise<void> }) {
  const { onglet, fermer } = usePanneau();
  const reglages = useOngletReglages({ admin, actif: onglet === 'reglages', fermer, dire, relire });
  const elements = {
    offre: (urn: string) => ongletOffre(urn, donnees, dire),
    'fiche-offre': (cle: string) => ongletFicheOffre(cle),
  };
  return <Panneau elements={elements} onglets={[reglages]} />;
}

type Formulaire = { recherches: string; postes: string; posts: string; personnes: string; employeurs: string; modele: string };

// Réglages LAPIS : recherches, postes et volumes ; le modèle est à l'admin.
function useOngletReglages({ admin, actif, fermer, dire, relire }: {
  admin: boolean; actif: boolean; fermer: () => void; dire: Dire; relire: () => Promise<void>;
}): Onglet {
  // Réglages gardés d'une visite à l'autre, relus à la première ouverture.
  const [lu, setLu] = useState(() => repris<Formulaire | null>('lapis:reglages', null));
  const [f, setF] = useState<Formulaire | null>(lu);
  const [modeles, setModeles] = useState(() => repris<{ nom: string }[]>('lapis:modeles', []));
  useGarder('lapis', { reglages: lu, modeles });
  const [erreur, setErreur] = useState('');
  const { occupe, geste } = useGeste(setErreur);
  const relu = useRef(false);
  const lire = useCallback(async () => {
    try {
      const p = await appeler<Parametres>('/parametres');
      const forme = { recherches: p.lapis_recherches.join(', '), postes: p.lapis_postes.join(', '), posts: String(p.lapis_posts_par_recherche),
        personnes: String(p.lapis_personnes_par_poste), employeurs: String(p.lapis_entreprises_par_passe), modele: p.lapis_modele ?? '' };
      setLu(forme);
      setF(forme);
      setModeles(p.modeles ?? []);
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
    void lire();
  }, [actif, lire]);
  const change = !!f && JSON.stringify(f) !== JSON.stringify(lu);
  const enregistrer = () => {
    if (!f || !change) return;
    return geste(async () => {
      await appeler('/parametres', { methode: 'PUT', corps: {
        lapis_recherches: parVirgules(f.recherches), lapis_postes: parVirgules(f.postes), lapis_posts_par_recherche: parseInt(f.posts, 10) || 0,
        lapis_personnes_par_poste: parseInt(f.personnes, 10) || 0, lapis_entreprises_par_passe: parseInt(f.employeurs, 10) || 0,
        ...(admin ? { lapis_modele: f.modele } : {}),
      } });
      dire('Réglages de LAPIS enregistrés : ils valent dès la prochaine passe.');
      await Promise.all([lire(), relire()]);
    });
  };
  const champ = (cle: keyof Formulaire, id: string, libelle: React.ReactNode, type = 'text') => (
    <ChampSaisie id={id} libelle={libelle} type={type} min={type === 'number' ? 0 : undefined} value={f?.[cle] ?? ''} disabled={!f} onChange={(e) => setF((v) => (v ? { ...v, [cle]: e.target.value } : v))} onKeyDown={(e) => e.key === 'Enter' && !occupe && void enregistrer()} />
  );
  return {
    cle: 'reglages', titre: 'Réglages', label: 'Réglages · LAPIS',
    corps: (
      <div className="section-f lapis-reglages">
        {champ('recherches', 'l-rech', 'Recherches de posts')}
        <p className="aide-champ">Comme les recherches de la veille. Vide : les intitulés cherchés des profils de recherche menés.</p>
        {champ('postes', 'l-postes', 'Postes à chercher')}
        <p className="aide-champ">Tapés un par un dans la page « Personnes » de chaque employeur.</p>
        <div className="grille-2">
          {champ('posts', 'l-posts', 'Posts par recherche', 'number')}
          {champ('personnes', 'l-pers', 'Personnes par poste', 'number')}
        </div>
        <div className="grille-2">
          {champ('employeurs', 'l-empl', 'Employeurs par passe', 'number')}
          {admin && (
            <ChampListe id="l-modele" libelle={<>Modèle<MarqueAdmin /></>} value={f?.modele ?? ''} disabled={!f} onChange={(e) => setF((v) => (v ? { ...v, modele: e.target.value } : v))}>
                <OptionsModele modeles={modeles} vide="Aucun" valeur={f?.modele ?? ''} detail={false} />
              </ChampListe>
          )}
        </div>
        <p className="aide-champ">Un employeur fouillé il y a moins de deux semaines attend. Le modèle lit les posts ; vide : celui des mails.</p>
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
function ongletOffre(urn: string, donnees: Lapis | null, dire: Dire): Onglet | null {
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
      </div>
    ),
    pied: <PiedOffre key={urn} post={post} dire={dire} />,
  };
}

// Chaque geste d'une offre repérée occupe sa fenêtre le temps de son appel.
function PiedOffre({ post, dire }: { post: Post; dire: Dire }) {
  const { occupe, geste } = useGeste((t) => dire(t, true));
  const o = post.offre;
  const entreprise = o.entreprise || post.entreprise;
  const contacts = () => geste(async () => dire((await appeler<{ lancee: boolean }>('/lapis/contacts', { methode: 'POST', corps: { post_urn: post.urn } })).lancee
    ? "LAPIS cherche des contacts chez cet employeur ; personne n'est contacté." : 'Une passe de LAPIS tourne déjà.'));
  const ajouter = () => geste(async () => dire((await appeler<{ neuve: boolean }>('/offres', { methode: 'POST', corps: {
    url: o.lien, entreprise: entreprise || '', titre: o.intitule || '', lieu: o.lieu || '' } })).neuve ? 'Offre ajoutée à la file.' : 'Cette offre était déjà en base.'));
  return (
    <>
      {entreprise && <Action icone={ICONES.contacts} disabled={occupe} onClick={() => void contacts()}>Chercher des contacts</Action>}
      {o.lien && <Action plein iconeApres={ICONES.plus_pages} disabled={occupe} onClick={() => void ajouter()}>Ajouter à la file</Action>}
    </>
  );
}
