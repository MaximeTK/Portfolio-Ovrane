'use client';

import './metriques.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appeler } from '../../api';
import { Activite } from '../../activite/Activite';
import { Dock, Fenetre, usePanneau } from '../../dock/Dock';
import { Panneau, type Onglet } from '../../dock/Panneau';
import { ongletFicheEntreprise } from '../../partage/FicheEntreprise';
import { libelleSource, ongletFicheOffre } from '../../partage/FicheOffre';
import type { ProprietesPage } from '../liste';
import {
  CorpsAppels, CorpsCouts, CorpsCv, CorpsFantomes, CorpsJobboards, CorpsLiens, CorpsMetiers, CorpsPartage, CorpsWinrate, CorpsWorkflows,
  dollars, jourMoisIso, jours, nombre, nomPoste, pourcent, winrate, type Fantome, type PageMetriques, type Suivi,
} from './panneaux';

type Periode = { debut: string; fin: string };
type Avis = { texte: string; erreur?: boolean } | null;

const RACCOURCIS: [number, string][] = [[7, '7 jours'], [30, '30 jours'], [90, '90 jours'], [0, 'Tout']];
// Les N derniers jours, aujourd'hui compris, en dates locales ; 0 : tout l'historique
const iso = (d: Date) => d.toLocaleDateString('sv-SE');
const plage = (j: number): Periode => (j ? { debut: iso(new Date(Date.now() - (j - 1) * 864e5)), fin: iso(new Date()) } : { debut: '', fin: '' });
const enClair = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—');
const requete = (p: Periode) => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v)).toString();
  return q ? `?${q}` : '';
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const pluriel = (n: number, mot: string) => `${nombre(n)} ${mot}${n > 1 ? 's' : ''}`;
// Le haut de l'échelle de l'histogramme : la valeur ronde juste au-dessus du jour le plus cher
const arrondi = (v: number) => {
  if (v <= 0) return 0.1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 4, 5, 8, 10].map((m) => m * p).find((x) => x >= v - 1e-12) ?? 10 * p;
};
const centimes = (v: number) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

const TRAIT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
const CHEVRON = <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
const DOSSIER = <svg {...TRAIT}><path d="M3 6h6l2 2h10v11H3z" /><path d="M3 11h18" /></svg>;
const VALIDER = <svg {...TRAIT}><path d="m5 12 5 5 9-10" /></svg>;

// Les sous-fenêtres de la page, ouvertes par leur carte ou leur petite carte
const DETAILS: Record<string, string> = {
  couts: 'Coûts · détail', jobboards: 'Jobboards · détail', winrate: 'Winrate des profils · détail', workflows: 'Workflows · détail',
  metiers: 'Métiers et postes', fantomes: 'Offres fantômes', liens: 'Liens suivis', partage: 'Base partagée', cv: 'Mise en page des CV', appels: 'Appels · détail',
};

export default function PageMetriques(_: ProprietesPage) {
  return (
    <Dock id="metriques" principal="metriques" panneau={null}
      fenetres={{ metriques: { mini: [560, 420], pref: [760, 480], flot: [920, 620] }, panneau: { flot: [480, 600] } }}>
      <Activite />
      <Metriques />
    </Dock>
  );
}

// Les lignes d'une carte qui ne tiennent pas entières se cachent : mesurées une fois les premières lignes posées, puis à chaque changement de taille
function useLignesQuiTiennent(cle: unknown) {
  const boite = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = boite.current;
    if (!el) return;
    const ajuster = () => {
      const lignes = [...el.querySelectorAll<HTMLElement>('[data-ligne]')];
      lignes.forEach((l) => (l.hidden = false));
      const bas = el.getBoundingClientRect().bottom + 0.5;
      lignes.filter((l) => l.getBoundingClientRect().bottom > bas).forEach((l) => (l.hidden = true));
      // Un sous-titre dont aucune ligne ne tient ne reste pas seul
      for (const t of el.querySelectorAll<HTMLElement>('[data-titre]')) {
        t.hidden = ![...(t.nextElementSibling?.querySelectorAll<HTMLElement>('[data-ligne]') ?? [])].some((l) => !l.hidden);
      }
    };
    ajuster();
    const observateur = new ResizeObserver(ajuster);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [cle]);
  return boite;
}

function Metriques() {
  const { onglet, ouvrir, fermer } = usePanneau();
  const [periode, setPeriode] = useState<Periode>(() => plage(30));
  const [raccourci, setRaccourci] = useState<number | null>(30);
  const [brouillon, setBrouillon] = useState<Periode>(periode);
  const [menuDate, setMenuDate] = useState<'debut' | 'fin' | null>(null);
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState<PageMetriques | null>(null);
  const [erreur, setErreur] = useState('');
  const [suivi, setSuivi] = useState<Suivi | null>(null);
  const [erreurSuivi, setErreurSuivi] = useState('');
  const [fantomes, setFantomes] = useState<Fantome[] | null>(null);
  const [erreurFantomes, setErreurFantomes] = useState('');
  const [detail, setDetail] = useState('couts');
  const [cle, setCle] = useState<string | null>(null);
  const [siren, setSiren] = useState<string | null>(null);
  const [avis, setAvis] = useState<Avis>(null);
  const [range, setRange] = useState(false);
  const boutonDebut = useRef<HTMLButtonElement>(null);
  const boutonFin = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const bouton = menuDate === 'debut' ? boutonDebut : boutonFin;

  // La période ne change qu'à la validation, le calcul relisant tout le compte ; les dossiers partagés et les fantômes la suivent
  useEffect(() => {
    let vivant = true;
    const q = requete(periode);
    appeler<PageMetriques>(`/metriques${q}`).then((p) => {
      if (!vivant) return;
      setPage(p);
      setErreur('');
    }).catch((e) => {
      if (vivant) setErreur(message(e));
    });
    appeler<Suivi>('/vues/metriques/suivi').then((s) => {
      if (!vivant) return;
      setSuivi(s);
      setErreurSuivi('');
    }).catch((e) => {
      if (vivant) setErreurSuivi(message(e));
    });
    appeler<Fantome[]>(`/vues/metriques/fantomes${q}`).then((f) => {
      if (!vivant) return;
      setFantomes(f);
      setErreurFantomes('');
    }).catch((e) => {
      if (vivant) setErreurFantomes(message(e));
    });
    return () => {
      vivant = false;
    };
  }, [periode, version]);

  // À l'ouverture, les dossiers pas encore rangés partent ensuite, sans faire attendre la page : une base injoignable met des secondes à le dire
  useEffect(() => {
    let vivant = true;
    appeler<{ mongodb_uri: boolean }>('/parametres')
      .then((p) => (p.mongodb_uri ? appeler<{ envoyes: number }>('/ovrane/synchroniser', { methode: 'POST' }) : null))
      .then((r) => {
        if (vivant && r?.envoyes) setVersion((v) => v + 1);
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  // Un avis se lit 3,5 s, une erreur 8 s
  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), avis.erreur ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [avis]);

  // Échap ferme le choix d'une date, sinon le panneau ; un clic ailleurs ferme le choix
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (menuDate) {
        e.preventDefault();
        setMenuDate(null);
      } else if (onglet) fermer();
    };
    const dehors = (e: PointerEvent) => {
      const cible = e.target as Node;
      if (menuDate && !menu.current?.contains(cible) && !bouton.current?.contains(cible)) setMenuDate(null);
    };
    document.addEventListener('keydown', echap);
    document.addEventListener('pointerdown', dehors);
    return () => {
      document.removeEventListener('keydown', echap);
      document.removeEventListener('pointerdown', dehors);
    };
  }, [menuDate, onglet, fermer, bouton]);

  const raccourcir = (j: number) => {
    const p = plage(j);
    setRaccourci(j);
    setBrouillon(p);
    setMenuDate(null);
    setPeriode(p);
  };
  const afficher = () => {
    if (brouillon.debut && brouillon.fin && brouillon.debut > brouillon.fin) {
      setAvis({ texte: 'La date de début vient après la date de fin.', erreur: true });
      return;
    }
    setMenuDate(null);
    setRaccourci(null);
    setPeriode({ ...brouillon });
  };
  const ranger = async () => {
    setRange(true);
    try {
      const r = await appeler<{ envoyes: number }>('/ovrane/synchroniser', { methode: 'POST' });
      setAvis({ texte: `Base partagée : ${r.envoyes} dossier(s) rangé(s).` });
      setVersion((v) => v + 1);
    } catch (e) {
      setAvis({ texte: message(e), erreur: true });
    }
    setRange(false);
  };
  const ouvrirDetail = useCallback((d: string) => {
    setDetail(d);
    setCle(null);
    setSiren(null);
    ouvrir(d);
  }, [ouvrir]);
  const voirOffre = (c: string) => {
    setCle(c);
    ouvrir('fiche-offre');
  };
  const voirEntreprise = (s: string) => {
    setSiren(s);
    ouvrir('fiche-entreprise');
  };

  const corps: Record<string, React.ReactNode> = page ? {
    couts: <CorpsCouts page={page} />, jobboards: <CorpsJobboards page={page} />, winrate: <CorpsWinrate page={page} />,
    workflows: <CorpsWorkflows page={page} />, metiers: <CorpsMetiers page={page} />,
    fantomes: <CorpsFantomes page={page} fantomes={fantomes} erreur={erreurFantomes} voir={voirOffre} />, liens: <CorpsLiens page={page} voir={voirOffre} />,
    partage: <CorpsPartage suivi={suivi} erreur={erreurSuivi} voir={voirOffre} />, cv: <CorpsCv page={page} />, appels: <CorpsAppels page={page} />,
  } : {};
  const ongletDetail: Onglet = {
    cle: detail, titre: DETAILS[detail], corps: corps[detail] ?? <p className="texte-f">Lecture des métriques…</p>,
    pied: <button type="button" className="action" onClick={fermer}>Fermer</button>,
  };
  const ficheOffre = ongletFicheOffre(cle, { ouvrirEntreprise: voirEntreprise });
  // Deux onglets au plus, la fiche et ce qui l'a ouverte : le panneau n'en tient pas trois
  const onglets = onglet === 'fiche-entreprise' ? [ficheOffre, ongletFicheEntreprise(siren, { ouvrirOffre: voirOffre })]
    : onglet === 'fiche-offre' ? [ongletDetail, ficheOffre] : [ongletDetail];

  const choixDate = (quoi: 'debut' | 'fin', lib: string) => (
    <button ref={quoi === 'debut' ? boutonDebut : boutonFin} type="button" className={`filtre${menuDate === quoi ? ' actif' : ''}`}
      aria-haspopup="dialog" aria-expanded={menuDate === quoi} aria-label={`${lib} ${enClair(periode[quoi])} : choisir la date`}
      onClick={() => {
        setBrouillon(periode);
        setMenuDate((m) => (m === quoi ? null : quoi));
      }}>
      <span><span className="lib">{lib}</span>{enClair(periode[quoi])}</span>{CHEVRON}
    </button>
  );

  return (
    <>
      <Fenetre id="metriques" className="tableau" aria-label="Métriques" titrePrise="Glisser pour détacher les métriques">
        <div className="outils">
          {choixDate('debut', 'Du')}
          {choixDate('fin', 'au')}
          <span className="raccourcis" role="group" aria-label="Période">
            {RACCOURCIS.map(([j, lib]) => (
              <button key={j} type="button" className={`filtre${raccourci === j ? ' actif' : ''}`} aria-pressed={raccourci === j} onClick={() => raccourcir(j)}>{lib}</button>
            ))}
          </span>
          <span className="espace" />
          <div className="actions" role="group" aria-label="Actions">
            <button type="button" className="action" disabled={range} onClick={ranger}
              title="Range dans la base partagée les dossiers qu'elle n'a pas encore ; fait aussi chaque jour et à l'ouverture de la page.">
              <span className="ico">{DOSSIER}</span><span className="txt">Ranger les dossiers</span>
            </button>
          </div>
        </div>
        {menuDate && (
          <div ref={menu} className="menu verre menu-periode" role="dialog" aria-label={menuDate === 'debut' ? 'Date de début' : 'Date de fin'}
            style={{ left: Math.max(14, (bouton.current?.offsetLeft ?? 14) - 12) }}>
            <span className="verre-halos" aria-hidden="true" />
            <form onSubmit={(e) => {
              e.preventDefault();
              afficher();
            }}>
              <label className="lib-champ" htmlFor="metriques-date">{menuDate === 'debut' ? 'Du' : 'Au'}</label>
              <input id="metriques-date" type="date" className="saisie" autoFocus value={brouillon[menuDate]}
                onChange={(e) => setBrouillon((b) => ({ ...b, [menuDate]: e.target.value }))} />
              <button type="submit" className="action plein" title="Les dates se choisissent d'abord : le calcul ne part qu'ici.">Afficher<span className="ico">{VALIDER}</span></button>
            </form>
          </div>
        )}
        {page ? <Tableau page={page} suivi={suivi} erreurSuivi={erreurSuivi} onglet={onglet} ouvrir={ouvrirDetail} />
          : <p className={`attente-m${erreur ? ' erreur' : ''}`} role={erreur ? 'alert' : 'status'}>{erreur ? `Métriques illisibles. ${erreur}` : 'Lecture des métriques…'}</p>}
        {(avis || (page && erreur)) && (
          <p className={`avis${avis?.erreur || !avis ? ' erreur' : ''}`} role={avis && !avis.erreur ? 'status' : 'alert'} onClick={() => setAvis(null)}>
            {avis?.texte ?? `Métriques illisibles. ${erreur}`}
          </p>
        )}
      </Fenetre>
      <Panneau onglets={onglets} />
    </>
  );
}

type ProprietesTableau = { page: PageMetriques; suivi: Suivi | null; erreurSuivi: string; onglet: string | null; ouvrir: (d: string) => void };

function Tableau({ page, suivi, erreurSuivi, onglet, ouvrir }: ProprietesTableau) {
  const r = page.resume;
  // Rien de mesuré encore : un coût par candidature à zéro dirait qu'elles n'ont rien coûté
  const unitaire = (v: number | null) => (r.cout_total ? dollars(v) : '—');
  const tuiles: [string, string, string, string?][] = [
    ['c-offres', 'Offres détectées', nombre(r.offres)], ['c-envoi', 'Envoyées', nombre(r.envoyees)],
    ['c-reponse', 'Réponses %', pourcent(r.taux_reponse), `${nombre(r.reponses)} réponse(s)`],
    ['c-entretien', 'Entretiens %', pourcent(r.taux_entretien), `${nombre(r.entretiens)} entretien(s)`],
    ['', 'Coût de la période', dollars(r.cout_total)], ['', 'Par candidature', unitaire(r.cout_par_envoyee)],
    ['', 'Par entretien', unitaire(r.cout_par_entretien)], ['', 'Délai de réponse', jours(r.delai_median_jours)], ['', 'Clics sur les liens', nombre(r.visites)],
  ];
  const fantomes = page.fantomes.find((f) => f.publication === 'FANTÔME')?.offres ?? 0;
  const servis = suivi?.candidatures.filter((c) => c.cv).length ?? 0;
  const meilleur = [...(page.cv.mode ?? [])].filter((v) => v.taux_reponse != null).sort((a, b) => (b.taux_reponse ?? 0) - (a.taux_reponse ?? 0))[0];
  const minis: [string, string, string, string?][] = [
    ['metiers', 'Métiers et postes', pluriel(page.metiers.length, 'métier')],
    ['fantomes', 'Offres fantômes', pluriel(fantomes, 'offre')],
    ['liens', 'Liens suivis', pluriel(r.visites, 'clic')],
    ['partage', 'Base partagée', erreurSuivi ? 'injoignable' : !suivi ? '…' : !suivi.branchee ? 'non branchée' : `${nombre(servis)} CV servi${servis > 1 ? 's' : ''}`],
    ['cv', 'Mise en page des CV', meilleur ? `${meilleur.valeur} · ${pourcent(meilleur.taux_reponse)}` : '—', 'Le fond qui obtient le plus de réponses'],
    ['appels', 'Appels', `${nombre(page.appels.nombre)} · ${dollars(page.appels.cout_transcription + page.appels.cout_analyse)}`, 'Les appels, et ce qu’ont coûté leur transcription et leur analyse'],
  ];
  return (
    <div className="metriques">
      <div className="tuiles-m">
        {tuiles.map(([classe, lib, valeur, titre]) => (
          <div key={lib} className={`tuile-m${classe ? ` ${classe}` : ''}`} title={titre}><p className="etiquette">{lib}</p><b>{valeur}</b></div>
        ))}
      </div>
      <div className="cartes">
        <CarteCouts page={page} ouverte={onglet === 'couts'} ouvrir={() => ouvrir('couts')} />
        <CarteJobboards page={page} ouverte={onglet === 'jobboards'} ouvrir={() => ouvrir('jobboards')} />
        <CarteWinrate page={page} ouverte={onglet === 'winrate'} ouvrir={() => ouvrir('winrate')} />
        <CarteWorkflows page={page} ouverte={onglet === 'workflows'} ouvrir={() => ouvrir('workflows')} />
      </div>
      <div className="mini-cartes-m">
        {minis.map(([cle, lib, valeur, titre]) => (
          <button key={cle} type="button" className={`mini-m${onglet === cle ? ' allume' : ''}`} aria-haspopup="dialog" title={titre} onClick={() => ouvrir(cle)}>
            <span className="etiquette">{lib}</span><b>{valeur}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

type ProprietesCarte = { page: PageMetriques; ouverte: boolean; ouvrir: () => void };

// Une carte : sa tête, son chiffre, son lien Détail ; un clic n'importe où sur elle ouvre son détail
function Carte({ titre, d, large, ouverte, ouvrir, className, children }: {
  titre: string; d?: string; large?: boolean; ouverte: boolean; ouvrir: () => void; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={`carte${large ? ' large' : ''}${ouverte ? ' ouverte' : ''}${className ? ` ${className}` : ''}`} aria-label={titre} onClick={ouvrir}>
      <div className="carte-tete">
        <h3 className="etiquette">{titre}</h3>{d && <span className="d">{d}</span>}
        <button type="button" className="detail" aria-haspopup="dialog" aria-label={`Détail : ${titre}`} onClick={(e) => {
          e.stopPropagation();
          ouvrir();
        }}>Détail ›</button>
      </div>
      {children}
    </section>
  );
}

function CarteCouts({ page, ouverte, ouvrir }: ProprietesCarte) {
  const { total, par_jour: parJour, postes } = page.couts;
  const moyenne = parJour.length ? parJour.reduce((n, j) => n + j.cout, 0) / parJour.length : 0;
  const haut = arrondi(Math.max(0, ...parJour.map((j) => j.cout)));
  const pas = 300 / Math.max(parJour.length, 1);
  const premier = parJour[0]?.jour ?? '';
  const dernier = parJour.at(-1)?.jour ?? '';
  return (
    <Carte titre="Coûts" d={`${dollars(total)} · ${dollars(moyenne)} par jour`} ouverte={ouverte} ouvrir={ouvrir} className="carte-couts">
      <div className="histo">
        <span className="histo-y" aria-hidden="true"><i>{centimes(haut)}</i><i>{centimes(haut / 2)}</i><i>0</i></span>
        <div className="histo-trace">
          <svg className="histo-svg" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label={`Coût par jour du ${jourMoisIso(premier)} au ${jourMoisIso(dernier)}`}>
            {parJour.map((j, i) => {
              const h = j.cout ? Math.max(1.5, (100 * j.cout) / haut) : 0;
              return <rect key={j.jour} x={i * pas + pas * 0.15} y={100 - h} width={pas * 0.7} height={h}><title>{`${jourMoisIso(j.jour)} · ${dollars(j.cout)}`}</title></rect>;
            })}
          </svg>
        </div>
      </div>
      <div className="histo-x" aria-hidden="true">
        <span>{jourMoisIso(premier)}</span><span>{jourMoisIso(parJour[Math.floor(parJour.length / 2)]?.jour ?? '')}</span><span>{jourMoisIso(dernier)}</span>
      </div>
      <ul className="postes">{postes.slice(0, 3).map((p) => <li key={p.poste}>{nomPoste(p.poste)}<span>{dollars(p.cout)}</span></li>)}</ul>
    </Carte>
  );
}

function CarteJobboards({ page, ouverte, ouvrir }: ProprietesCarte) {
  const boite = useLignesQuiTiennent(page);
  const sources = page.jobboards.filter((b) => b.offres).length;
  return (
    <Carte titre="Jobboards" d={`${pluriel(sources, 'source')} · ${pluriel(page.resume.offres, 'offre')}`} large ouverte={ouverte} ouvrir={ouvrir}>
      <div ref={boite} className="corps-carte">
        {page.jobboards.length ? (
          <table className="compact t-jobs">
            <thead><tr><th>Jobboard</th><th>Offres</th><th>Exclusives</th><th>Envoyées</th><th>Réponses</th><th>Entretiens</th><th>Délai médian</th><th>Coût / envoi</th></tr></thead>
            <tbody>
              {page.jobboards.map((b) => (
                <tr key={b.source} data-ligne>
                  <td>{libelleSource(b.source)}</td><td>{nombre(b.offres)}</td><td>{nombre(b.exclusives)}</td><td>{nombre(b.envoyees)}</td><td>{nombre(b.reponses)}</td>
                  <td>{nombre(b.entretiens)}</td><td>{jours(b.delai_median_jours)}</td><td>{b.cout ? dollars(b.cout_moyen) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="vide-m">Aucune offre dans la période.</p>}
      </div>
    </Carte>
  );
}

function CarteWinrate({ page, ouverte, ouvrir }: ProprietesCarte) {
  const boite = useLignesQuiTiennent(page);
  const genres: ['cv' | 'recherche', string][] = [['cv', 'Profil de CV'], ['recherche', 'Profil de recherche']];
  return (
    <Carte titre="Winrate des profils" ouverte={ouverte} ouvrir={ouvrir}>
      <div ref={boite} className="corps-carte">
        {page.profils.length ? genres.map(([genre, titre]) => (
          <div key={genre}>
            <p className="sous-carte" data-titre>{titre}</p>
            <ul className="winrate">
              {page.profils.filter((p) => p.genre === genre).map((p) => {
                const b = p.total;
                const taux = b.envoyees ? (100 * b.entretiens) / b.envoyees : 0;
                return (
                  <li key={p.profil} data-ligne>
                    <span className="w-nom" title={p.profil}>{p.profil}</span>
                    {/* L'échelle va de 0 à 10 % : au-delà, la barre est pleine */}
                    <span className="w-barre" title={`${b.entretiens} entretien(s) sur ${b.envoyees} envoi(s)`}><i style={{ width: `${Math.min(100, taux * 10)}%` }} /></span>
                    <span className="w-val">{winrate(b)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )) : <p className="vide-m">Aucune candidature envoyée dans la période.</p>}
      </div>
    </Carte>
  );
}

function CarteWorkflows({ page, ouverte, ouvrir }: ProprietesCarte) {
  const boite = useLignesQuiTiennent(page);
  const candidatures = page.workflows.reduce((n, w) => n + w.candidatures, 0);
  return (
    <Carte titre="Workflows" d={`${pluriel(page.workflows.length, 'site')} · ${pluriel(candidatures, 'candidature')}`} large ouverte={ouverte} ouvrir={ouvrir}>
      <div ref={boite} className="corps-carte">
        {page.workflows.length ? (
          <table className="compact t-wf">
            <thead><tr><th>Site</th><th>Candidatures</th><th>Abouties</th><th>Réutilisations</th><th>Appels au modèle</th><th>Coût moyen</th><th>Arrêts</th></tr></thead>
            <tbody>
              {page.workflows.map((w) => (
                <tr key={w.site} data-ligne>
                  <td>{w.site}</td><td>{nombre(w.candidatures)}</td><td>{nombre(w.abouties)}</td><td>{nombre(w.rejouees)}</td>
                  <td title={`${nombre(w.tours_moyen)} tours et ${nombre(w.jade_moyen)} appels de JADE par candidature`}>{nombre(w.tours_moyen)}</td>
                  <td>{w.cout ? dollars(w.cout_moyen) : '—'}</td>
                  <td title={w.motifs.map((m) => `${m.motif} ×${m.nombre}`).join(', ')}>{nombre(w.motifs.reduce((n, m) => n + m.nombre, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="vide-m">Aucune candidature mesurée dans la période.</p>}
      </div>
    </Carte>
  );
}
