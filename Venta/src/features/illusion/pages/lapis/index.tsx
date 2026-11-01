'use client';

import './lapis.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appeler } from '../../api';
import { repris, useGarder } from '../../stockage';
import { Activite } from '../../activite/Activite';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { MarqueAdmin, Panneau, type Onglet } from '../../dock/Panneau';
import { jourMois, ongletFicheOffre } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';

// Ce que /lapis rend : les personnes trouvées, les offres et les événements repérés dans les posts, les derniers posts lus
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
type Avis = { texte: string; erreur?: boolean } | null;
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
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
// Seul un lien web s'ouvre depuis la galerie
const sur = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : undefined);
const initiales = (nom: string) => nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', 'aria-hidden': true } as const;
const ICONES = {
  reglages: <svg {...TRAIT} strokeLinejoin="miter"><polygon points="22.3,10.2 22.3,13.8 19.4,13.8 18.5,15.9 20.6,18.0 18.0,20.6 15.9,18.5 13.8,19.4 13.8,22.3 10.2,22.3 10.2,19.4 8.1,18.5 6.0,20.6 3.4,18.0 5.5,15.9 4.6,13.8 1.7,13.8 1.7,10.2 4.6,10.2 5.5,8.1 3.4,6.0 6.0,3.4 8.1,5.5 10.2,4.6 10.2,1.7 13.8,1.7 13.8,4.6 15.9,5.5 18.0,3.4 20.6,6.0 18.5,8.1 19.4,10.2" /><circle cx="12" cy="12" r="3" /></svg>,
  jouer: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>,
  sortie: <svg {...TRAIT} strokeWidth={2.4}><path d="M7 17 17 7M8 7h9v9" /></svg>,
  contacts: <svg {...TRAIT}><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.5 3-6 7-6" /><circle cx="17" cy="16" r="3" /><path d="m21 20-1.8-1.8" /></svg>,
  plus: <svg {...TRAIT} strokeWidth={2.6} strokeLinejoin="miter"><path d="M12 5v14M5 12h14" /></svg>,
  valider: <svg {...TRAIT} strokeWidth={2.6}><path d="m5 12 5 5 9-10" /></svg>,
};

// Un lien qui ouvre LinkedIn ou le site dans un nouvel onglet, sans fenêtre
function Sortie({ href, children, className = 'lien', fleche = true }: { href?: string; children: React.ReactNode; className?: string; fleche?: boolean }) {
  if (!sur(href)) return null;
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{children}{fleche && ICONES.sortie}</a>;
}

// La photo de LinkedIn, ses initiales derrière : un lien expiré les laisse paraître
function Photo({ url, nom }: { url?: string; nom: string }) {
  const [vue, setVue] = useState(true);
  return (
    <span className="initiales" aria-hidden="true">{initiales(nom)}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {vue && sur(url) && <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setVue(false)} />}
    </span>
  );
}

export default function PageLapis({ compte }: ProprietesPage) {
  // Ce que LAPIS a trouvé reste d'une visite à l'autre : en revenant, la galerie s'affiche aussitôt et se relit derrière
  const [donnees, setDonnees] = useState(() => repris<Lapis | null>('lapis:donnees', null));
  useGarder('lapis', { donnees });
  const [erreur, setErreur] = useState('');
  const [avis, setAvis] = useState<Avis>(null);
  const lire = useCallback(async () => {
    try {
      setDonnees(await appeler<Lapis>('/lapis'));
      setErreur('');
    } catch (e) {
      setErreur(message(e));
    }
  }, []);
  useEffect(() => {
    void lire();
  }, [lire]);
  return (
    <Dock id="lapis" principal="galerie" fenetres={{ galerie: { mini: [470, 260] } }} panneau={null}>
      <Activite />
      <Galerie donnees={donnees} erreur={erreur} avis={avis} setAvis={setAvis} />
      <PanneauLapis admin={compte.admin} donnees={donnees} setAvis={setAvis} relire={lire} />
    </Dock>
  );
}

type ProprietesGalerie = { donnees: Lapis | null; erreur: string; avis: Avis; setAvis: (a: Avis) => void };

// La fenêtre principale : les quatre onglets de ce que LAPIS a trouvé, ce que la passe cherche, la galerie paginée
function Galerie({ donnees, erreur, avis, setAvis }: ProprietesGalerie) {
  const { onglet, objet, ouvrir, fermer } = usePanneau();
  const [sorte, setSorte] = useState(() => repris<Sorte>('lapis:sorte', 'personnes'));
  const [page, setPage] = useState(() => repris('lapis:page', 1));
  const [taille, setTaille] = useState(() => repris<number | 'auto'>('lapis:taille', 'auto'));
  const [auto, setAuto] = useState(() => repris('lapis:auto', 12));
  useGarder('lapis', { sorte, page, taille, auto });
  const [occupe, setOccupe] = useState(false);
  const grille = useRef<HTMLDivElement>(null);

  // Échap ferme le panneau ; un avis se lit 3,5 s, une erreur 8 s
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [fermer]);
  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), avis.erreur ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [avis, setAvis]);

  const cartes = donnees?.[sorte] ?? [];
  const parPage = taille === 'auto' ? auto : taille;
  const pages = Math.max(1, Math.ceil(cartes.length / parPage));
  const courante = Math.min(page, pages);
  const visibles = cartes.slice((courante - 1) * parPage, courante * parPage);
  // « auto » : autant de cartes que la galerie en montre sans en couper une, mesuré une fois les premières cartes posées
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

  const lancer = async () => {
    setOccupe(true);
    try {
      const r = await appeler<{ lancee: boolean }>('/briques/lapis/lancer', { methode: 'POST' });
      setAvis({ texte: r.lancee ? 'Passe lancée : LAPIS lit LinkedIn, sans contacter personne.' : 'Une passe de LAPIS tourne déjà.' });
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    }
    setOccupe(false);
  };
  const ouvrirOffre = (u: string) => ouvrir('offre', u);

  const numeros = [...new Set([1, 2, 3, courante - 1, courante, courante + 1, pages - 2, pages - 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
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
          <button type="button" className={`action${onglet === 'reglages' ? ' allume' : ''}`} title="Réglages" aria-haspopup="dialog" aria-expanded={onglet === 'reglages'} onClick={() => ouvrir('reglages')}>
            <span className="ico">{ICONES.reglages}</span><span className="txt">Réglages</span>
          </button>
          <button type="button" className="action plein" disabled={occupe} title="Lit les posts récents de chaque recherche, puis fouille les employeurs qu'ils nomment ; personne n'est contacté" onClick={() => void lancer()}>
            Lancer une passe<span className="ico">{ICONES.jouer}</span>
          </button>
        </div>
      </div>
      <div ref={grille} className={`galerie${taille === 'auto' ? ' ajuste' : ''}${sorte === 'evenements' || sorte === 'posts' ? ' haute' : ''}`} role="tabpanel" aria-label={libelle}>
        {sorte === 'personnes' && (visibles as Personne[]).map((p) => (
          <article key={p.profil_url} className="personne">
            <div>
              <Photo url={p.photo} nom={p.nom} />
              <div className="qui">
                <b title={p.nom}>{p.nom || '—'}</b>
                <span className="titre-p" title={p.titre}>{p.titre}</span>
                <span className="poste" title={`${p.entreprise} · poste cherché : ${p.poste}`}>{p.entreprise || '—'} · <i>poste cherché :</i> {p.poste || '—'}</span>
                <Sortie href={p.profil_url}>Profil LinkedIn</Sortie>
                {p.origine.genre === 'post' && <span className="origine" title={p.origine.texte}>Vue dans un post · <Sortie href={p.origine.url} className="" fleche={false}>voir le post</Sortie></span>}
                {p.origine.genre === 'offre' && p.origine.cle && (
                  <span className="origine">Cherchée pour l&apos;offre <button type="button" aria-haspopup="dialog" data-ouvre="fiche-offre" data-objet={p.origine.cle} onClick={() => ouvrir('fiche-offre', p.origine.cle!)}>{p.origine.texte}</button></span>
                )}
              </div>
            </div>
          </article>
        ))}
        {sorte === 'offres' && (visibles as Post[]).map((o) => {
          const entreprise = o.offre.entreprise || o.entreprise;
          return (
            <article key={o.urn} className={`personne cliquable${onglet === 'offre' && objet === o.urn ? ' ouverte' : ''}`} data-ouvre="offre" data-objet={o.urn} onClick={() => ouvrirOffre(o.urn)}>
              <div>
                <Photo url={o.photo} nom={o.auteur} />
                <div className="qui">
                  <b><button type="button" className="titre-c" aria-haspopup="dialog" title={o.offre.intitule || o.resume} data-ouvre="offre" data-objet={o.urn} onClick={(e) => { e.stopPropagation(); ouvrirOffre(o.urn); }}>{o.offre.intitule || o.resume}</button></b>
                  <span className="titre-p">{[entreprise, o.offre.lieu].filter(Boolean).join(' · ') || '—'}</span>
                  <span className="poste" title={[o.auteur, o.auteur_titre].filter(Boolean).join(', ')}><i>Publiée par</i> {o.auteur || '—'}</span>
                  <Sortie href={o.url}>Voir le post</Sortie>
                  <span className="origine">Lue le {jourMois(o.lu_le)} · « {o.recherche} »</span>
                </div>
              </div>
            </article>
          );
        })}
        {sorte === 'evenements' && (visibles as Post[]).map((e) => (
          <article key={e.urn} className="personne">
            <div>
              <Photo url={e.photo} nom={e.auteur} />
              <div className="qui">
                <b title={e.evenement.nom || e.resume}>{e.evenement.nom || e.resume}</b>
                <span className="titre-p">{[e.evenement.date, e.evenement.lieu].filter(Boolean).join(' · ') || 'date et lieu non précisés'}</span>
                <span className="poste">{e.entreprise || e.auteur || '—'}</span>
                <span className="liens"><Sortie href={e.url}>Voir le post</Sortie><Sortie href={e.evenement.lien}>Page de l&apos;événement</Sortie></span>
                <span className="resume-c" title={e.resume}>{e.resume}</span>
              </div>
            </div>
          </article>
        ))}
        {sorte === 'posts' && (visibles as Post[]).map((p) => (
          <article key={p.urn} className="personne">
            <div>
              <Photo url={p.photo} nom={p.auteur} />
              <div className="qui">
                <b title={p.auteur}>{p.auteur || '—'}</b>
                <span className="titre-p" title={p.auteur_titre}>{p.auteur_titre}</span>
                <span className="poste"><span className="nature">{NATURES[p.nature] ?? p.nature}</span>« {p.recherche} », lu le {jourMois(p.lu_le)}</span>
                <Sortie href={p.url}>Voir le post</Sortie>
                <span className="resume-c" title={p.resume}>{p.resume}</span>
              </div>
            </div>
          </article>
        ))}
        {(erreur || (donnees && !cartes.length)) && (
          <p className={`vide-l${erreur ? ' erreur' : ''}`} role={erreur ? 'alert' : undefined}>{erreur ? `LAPIS illisible : ${erreur}` : VIDES[sorte]}</p>
        )}
      </div>
      {avis && <p className={`avis-l${avis.erreur ? ' erreur' : ''}`} role={avis.erreur ? 'alert' : 'status'} onClick={() => setAvis(null)}>{avis.texte}</p>}
      <div className="pagination">
        <select aria-label="Cartes par page" value={String(taille)} onChange={(e) => { setTaille(e.target.value === 'auto' ? 'auto' : Number(e.target.value)); setPage(1); }}>
          <option value="auto">auto ({auto})</option>
          {TAILLES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <nav className="pages" aria-label="Pages">
          <button type="button" className="pl" disabled={courante <= 1} aria-label="Page précédente" onClick={() => setPage(courante - 1)}>‹</button>
          {numeros.map((n, i) => (
            <span key={n} className="numero">
              {i > 0 && n - numeros[i - 1] > 1 && <span className="pl trou" aria-hidden="true">…</span>}
              <button type="button" className={`pl${n === courante ? ' actif' : ''}`} aria-current={n === courante ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>
            </span>
          ))}
          <button type="button" className="pl" disabled={courante >= pages} aria-label="Page suivante" onClick={() => setPage(courante + 1)}>›</button>
        </nav>
        <span className="espace" />
        <span className="compteur">{donnees ? `${cartes.length} ${libelle.toLowerCase()}` : ''}</span>
      </div>
    </Fenetre>
  );
}

// Le panneau : les offres repérées et les fiches des offres pour lesquelles une personne a été cherchée (une par fenêtre), puis Réglages
function PanneauLapis({ admin, donnees, setAvis, relire }: { admin: boolean; donnees: Lapis | null; setAvis: (a: Avis) => void; relire: () => Promise<void> }) {
  const { onglet, fermer } = usePanneau();
  const reglages = useOngletReglages({ admin, actif: onglet === 'reglages', fermer, setAvis, relire });
  const elements = {
    offre: (urn: string) => ongletOffre(urn, donnees, setAvis),
    'fiche-offre': (cle: string) => ongletFicheOffre(cle),
  };
  return <Panneau elements={elements} onglets={[reglages]} />;
}

type Formulaire = { recherches: string; postes: string; posts: string; personnes: string; employeurs: string; modele: string };

// Réglages · LAPIS : recherches, postes et volumes ; le modèle qui lit les posts n'appartient qu'à l'admin
function useOngletReglages({ admin, actif, fermer, setAvis, relire }: {
  admin: boolean; actif: boolean; fermer: () => void; setAvis: (a: Avis) => void; relire: () => Promise<void>;
}): Onglet {
  // Les réglages lus restent d'une visite à l'autre et le formulaire en repart ; ils se relisent quand même à la première ouverture de chaque visite
  const [lu, setLu] = useState(() => repris<Formulaire | null>('lapis:reglages', null));
  const [f, setF] = useState<Formulaire | null>(lu);
  const [modeles, setModeles] = useState(() => repris<string[]>('lapis:modeles', []));
  useGarder('lapis', { reglages: lu, modeles });
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  const relu = useRef(false);
  const lire = useCallback(async () => {
    try {
      const p = await appeler<Parametres>('/parametres');
      const forme = { recherches: p.lapis_recherches.join(', '), postes: p.lapis_postes.join(', '), posts: String(p.lapis_posts_par_recherche),
        personnes: String(p.lapis_personnes_par_poste), employeurs: String(p.lapis_entreprises_par_passe), modele: p.lapis_modele ?? '' };
      setLu(forme);
      setF(forme);
      setModeles((p.modeles ?? []).map((m) => m.nom));
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
  const liste = (t: string) => t.split(',').map((v) => v.trim()).filter(Boolean);
  const enregistrer = async () => {
    if (!f || !change) return;
    setOccupe(true);
    try {
      await appeler('/parametres', { methode: 'PUT', corps: {
        lapis_recherches: liste(f.recherches), lapis_postes: liste(f.postes), lapis_posts_par_recherche: parseInt(f.posts, 10) || 0,
        lapis_personnes_par_poste: parseInt(f.personnes, 10) || 0, lapis_entreprises_par_passe: parseInt(f.employeurs, 10) || 0,
        ...(admin ? { lapis_modele: f.modele } : {}),
      } });
      setAvis({ texte: 'Réglages de LAPIS enregistrés : ils valent dès la prochaine passe.' });
      await Promise.all([lire(), relire()]);
    } catch (e) {
      setErreur(message(e));
    }
    setOccupe(false);
  };
  const champ = (cle: keyof Formulaire, id: string, libelle: React.ReactNode, type = 'text') => (
    <div className="champ"><label htmlFor={id}>{libelle}</label>
      <input id={id} className="saisie" type={type} min={type === 'number' ? 0 : undefined} value={f?.[cle] ?? ''} disabled={!f}
        onChange={(e) => setF((v) => (v ? { ...v, [cle]: e.target.value } : v))} onKeyDown={(e) => e.key === 'Enter' && !occupe && void enregistrer()} />
    </div>
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
            <div className="champ"><label htmlFor="l-modele">Modèle<MarqueAdmin /></label>
              <select id="l-modele" className="saisie" value={f?.modele ?? ''} disabled={!f} onChange={(e) => setF((v) => (v ? { ...v, modele: e.target.value } : v))}>
                <option value="">Aucun</option>
                {[...new Set([...modeles, ...(f?.modele ? [f.modele] : [])])].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
        <p className="aide-champ">Un employeur fouillé il y a moins de deux semaines attend. Le modèle lit les posts ; vide : celui des mails.</p>
        {erreur && <p className="erreur-f" role="alert">{erreur}</p>}
      </div>
    ),
    pied: (
      <>
        <button type="button" className="action" onClick={() => { setF(lu); setErreur(''); fermer(); }}>Annuler</button>
        <button type="button" className="action plein" disabled={!change || occupe} onClick={() => void enregistrer()}>Enregistrer<span className="ico">{ICONES.valider}</span></button>
      </>
    ),
  };
}

// Offre repérée : le post qui l'annonce, de quoi chercher des contacts chez l'employeur ou la mettre dans la file ; personne n'est contacté
function ongletOffre(urn: string, donnees: Lapis | null, setAvis: (a: Avis) => void): Onglet | null {
  const post = donnees?.offres.find((o) => o.urn === urn);
  // LAPIS pas encore relu (retour sur la page) : la fenêtre attend ; relu sans ce post, elle n'a plus rien à montrer
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
          <li>Lue le<span className="d">{jourMois(post.lu_le)}, recherche « {post.recherche} »</span></li>
          {o.lien && <li>Lien de l&apos;offre<Sortie href={o.lien} className="d">{o.lien.replace(/^https?:\/\//i, '')}</Sortie></li>}
          <li>Post<Sortie href={post.url} className="d">Voir le post</Sortie></li>
        </ul>
      </div>
    ),
    pied: <PiedOffre key={urn} post={post} setAvis={setAvis} />,
  };
}

// Les gestes d'une offre repérée, chacun occupé dans sa fenêtre le temps de son appel
function PiedOffre({ post, setAvis }: { post: Post; setAvis: (a: Avis) => void }) {
  const [occupe, setOccupe] = useState(false);
  const o = post.offre;
  const entreprise = o.entreprise || post.entreprise;
  const geste = async (faire: () => Promise<string>) => {
    setOccupe(true);
    try {
      setAvis({ texte: await faire() });
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    }
    setOccupe(false);
  };
  const contacts = () => geste(async () => ((await appeler<{ lancee: boolean }>('/lapis/contacts', { methode: 'POST', corps: { post_urn: post.urn } })).lancee
    ? "LAPIS cherche des contacts chez cet employeur ; personne n'est contacté." : 'Une passe de LAPIS tourne déjà.'));
  const ajouter = () => geste(async () => ((await appeler<{ neuve: boolean }>('/offres', { methode: 'POST', corps: {
    url: o.lien, entreprise: entreprise || '', titre: o.intitule || '', lieu: o.lieu || '' } })).neuve ? 'Offre ajoutée à la file.' : 'Cette offre était déjà en base.'));
  return (
    <>
      {entreprise && <button type="button" className="action" disabled={occupe} onClick={() => void contacts()}><span className="ico">{ICONES.contacts}</span>Chercher des contacts</button>}
      {o.lien && <button type="button" className="action plein" disabled={occupe} onClick={() => void ajouter()}>Ajouter à la file<span className="ico">{ICONES.plus}</span></button>}
    </>
  );
}
