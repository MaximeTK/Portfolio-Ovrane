'use client';

import { dateUtc, libelleSource } from '../../partage/FicheOffre';

export type Bilan = { offres: number; envoyees: number; reponses: number; entretiens: number; refus: number; taux_reponse: number | null; taux_entretien: number | null };
export type Jobboard = Bilan & { source: string; exclusives: number; revues_ici: number; ouvertes: number; cout: number; cout_moyen: number | null; delai_median_jours: number | null };
export type Poste = { poste: string; modeles: string[]; appels: number; entree: number; cache: number; ecrits: number; sortie: number; raisonnement: number; cout: number };
type Jetons = { entree: number; cache: number; ecrits: number; sortie: number; raisonnement: number };
export type Workflow = {
  site: string; candidatures: number; abouties: number; taux_abouties: number | null; rejouees: number; conversation: number | null;
  creation: { conversation: number | null }; tours_moyen: number; jade_moyen: number; jetons_moyen: Jetons; remplis_moyen: number;
  remplis_ia_moyen: number; duree_moyenne_s: number; cout: number; cout_moyen: number; motifs: { motif: string; nombre: number }[];
};
export type Profil = { genre: 'cv' | 'recherche'; profil: string; total: Bilan; metiers: Record<string, Bilan> };
export type PageMetriques = {
  periode: { debut: string; fin: string };
  resume: {
    offres: number; envoyees: number; reponses: number; entretiens: number; taux_reponse: number | null; taux_entretien: number | null; cout_total: number;
    cout_par_envoyee: number | null; cout_par_entretien: number | null; delai_median_jours: number | null; visites: number; sans_prix: string[];
  };
  jobboards: Jobboard[];
  couts: { postes: Poste[]; total: number; par_jour: { jour: string; cout: number }[] };
  workflows: Workflow[];
  metiers: (Bilan & { metier: string })[];
  postes: (Bilan & { poste: string; variantes: number })[];
  fantomes: (Bilan & { publication: string })[];
  profils: Profil[];
  cv: Record<string, (Bilan & { valeur: string })[]>;
  liens: { suivies: number; ouvertes: number; taux_ouverture: number | null; par_cible: Record<string, number>; robots: number;
    recentes: { date: string; cible: string; offre_cle: string; titre: string; entreprise: string }[] };
  appels: { nombre: number; duree_s: number; cout_transcription: number; cout_analyse: number;
    liste: { id: number; titre: string; debut: string; duree_s: number; analyse: boolean; cout: number }[] };
};
export type Visite = { cible: string; date: string; robot: boolean };
export type Suivi = { branchee: boolean; candidatures: { jeton: string; titre: string; entreprise: string; envoyee_le: string; cv: boolean; visites: Visite[]; offre_cle: string }[] };
export type Fantome = { cle: string; entreprise: string; titre: string; source: string; republiee: number; creee_le: string; statut: string };

// Le nom lisible de chaque poste de dépense, tel que les services le consignent
const POSTES: Record<string, string> = {
  navigation: 'Candidature', jade: 'JADE (jugement)', lettre: 'Lettre', etiquettes: 'Tri des intitulés', tri: 'Tri des intitulés',
  metiers: 'Métiers des offres', etiquette: 'Mails', reponse: 'Réponses aux mails', relance: 'Relances', preparation: "Préparation d'entretien",
  appel: "Analyse d'appel", transcription: 'Transcription des appels', cv_spontane: 'Choix du CV spontané', relations: 'Fiches des relations', lapis: 'LAPIS',
};
export const nomPoste = (p: string) => POSTES[p] ?? p;
const CIBLES: Record<string, string> = { linkedin: 'LinkedIn', github: 'GitHub', portfolio: 'Portfolio', site: 'Portfolio', cv: 'CV', cvdesign: 'CV design' };
export const nomCible = (c: string) => CIBLES[c] ?? c;
const DIMENSIONS: Record<string, string> = { mode: 'Fond', structure: 'Structure', photo: 'Photo', famille: 'Police' };
const STATUTS: Record<string, string> = { POSTULEE: 'Envoyée', ECHEC: 'Échec', A_LA_MAIN: 'À la main', INADAPTEE: 'Inadaptée', IGNOREE: 'Écartée', PRETE: 'Prête' };

export const nombre = (v?: number | null) => (v ?? 0).toLocaleString('fr-FR');
export const pourcent = (v?: number | null) => (v == null ? '—' : `${v} %`);
export const jours = (v?: number | null) => (v == null ? '—' : `${v.toLocaleString('fr-FR')} j`);
// Un coût sous le centime garde ses chiffres significatifs : 0,039 $, 0,0042 $
export const dollars = (v?: number | null) => (v == null ? '—'
  : `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: v === 0 ? 2 : v < 0.01 ? 4 : v < 0.1 ? 3 : 2 })} $`);
export const duree = (s: number) => (!s ? '—' : s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`
  : `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`);
export const quand = (iso: string) => (iso ? dateUtc(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
// « 2026-10-28 » → « 28/10 »
export const jourMoisIso = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
// Entretiens sur envois, ce qu'on appelle le winrate : « 3/61 · 5 % »
export const winrate = (b?: Bilan) => (b && b.envoyees ? `${b.entretiens}/${b.envoyees} · ${pourcent(b.taux_entretien)}` : '—');
const sur = (n: number, taux: number | null) => `${nombre(n)} · ${pourcent(taux)}`;

export function periodeTexte(p: { debut: string; fin: string }) {
  if (!p.debut && !p.fin) return "Sur tout l'historique";
  if (!p.debut) return `Jusqu'au ${jourMoisIso(p.fin)}`;
  if (!p.fin) return `Depuis le ${jourMoisIso(p.debut)}`;
  const n = Math.round((Date.parse(p.fin) - Date.parse(p.debut)) / 864e5) + 1;
  return `Du ${jourMoisIso(p.debut)} au ${jourMoisIso(p.fin)}, ${n} jour${n > 1 ? 's' : ''}`;
}

export function CorpsCouts({ page }: { page: PageMetriques }) {
  const { postes, total } = page.couts;
  const somme = (c: keyof Jetons | 'appels') => postes.reduce((n, p) => n + p[c], 0);
  const jeton = (p: Poste, c: keyof Jetons) => (p.entree || p.sortie ? nombre(p[c]) : '—');
  return (
    <div className="metriques-f">
      <p className="intro-f">{periodeTexte(page.periode)} : jetons écrits et reçus par poste, au prix de chaque modèle. La transcription se paie à la minute.</p>
      {page.resume.sans_prix.length > 0 && <p className="alerte-f">Sans prix, donc comptés zéro : {page.resume.sans_prix.join(', ')}.</p>}
      {postes.length ? (
        <table className="compact tab-couts">
          <thead><tr><th>Poste</th><th>Appels</th><th>Écrits</th><th>Dont lus en cache</th><th>Dont écrits en cache</th><th>Reçus</th><th>Dont raisonnement</th><th>Coût</th></tr></thead>
          <tbody>
            {postes.map((p) => (
              <tr key={p.poste}>
                <td title={p.modeles.join(', ')}>{nomPoste(p.poste)}</td><td>{nombre(p.appels)}</td><td>{jeton(p, 'entree')}</td><td>{jeton(p, 'cache')}</td>
                <td>{jeton(p, 'ecrits')}</td><td>{jeton(p, 'sortie')}</td><td>{jeton(p, 'raisonnement')}</td><td>{dollars(p.cout)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td>{nombre(somme('appels'))}</td><td>{nombre(somme('entree'))}</td><td>{nombre(somme('cache'))}</td><td>{nombre(somme('ecrits'))}</td>
            <td>{nombre(somme('sortie'))}</td><td>{nombre(somme('raisonnement'))}</td><td>{dollars(total)}</td></tr></tfoot>
        </table>
      ) : <p className="texte-f">Aucun appel au modèle dans la période.</p>}
      <p className="aide-champ">Écrits : jetons d&apos;entrée, dont la part lue en cache, facturée une fraction du prix, et celle écrite en cache, facturée plus cher. Reçus : jetons de sortie, raisonnement compris. Le prix de chaque modèle se règle dans Paramètres serveur.</p>
    </div>
  );
}

// Un bloc par ligne du tableau de la carte : le panneau est trop étroit pour toutes ses colonnes
function Bloc({ titre, lignes }: { titre: string; lignes: [string, React.ReactNode][] }) {
  return (
    <section className="bloc-m">
      <h4>{titre}</h4>
      <dl className="def">{lignes.map(([dt, dd]) => [<dt key={`t-${dt}`}>{dt}</dt>, <dd key={`d-${dt}`}>{dd}</dd>])}</dl>
    </section>
  );
}

export function CorpsJobboards({ page }: { page: PageMetriques }) {
  return (
    <div className="metriques-f">
      <p className="intro-f">« Exclusives » : vues sur ce seul jobboard. « Déjà vues ailleurs » : offres qu&apos;il a aussi publiées, mais qu&apos;un autre avait ramenées d&apos;abord ; un jobboard qui n&apos;a que celles-là n&apos;apporte rien de neuf.</p>
      {page.jobboards.length ? page.jobboards.map((b) => (
        <Bloc key={b.source} titre={libelleSource(b.source)} lignes={[
          ['Offres', nombre(b.offres)], ['Exclusives', nombre(b.exclusives)], ['Déjà vues ailleurs', nombre(b.revues_ici)], ['Envoyées', nombre(b.envoyees)],
          ['Réponses', sur(b.reponses, b.taux_reponse)], ['Entretiens', sur(b.entretiens, b.taux_entretien)], ['Délai médian', jours(b.delai_median_jours)],
          ['Coût / envoi', b.cout ? dollars(b.cout_moyen) : '—'], ['Liens ouverts', nombre(b.ouvertes)],
        ]} />
      )) : <p className="texte-f">Aucune offre dans la période.</p>}
    </div>
  );
}

export function CorpsWinrate({ page }: { page: PageMetriques }) {
  const genres: ['cv' | 'recherche', string][] = [['cv', 'Profil de CV'], ['recherche', 'Profil de recherche']];
  return (
    <div className="metriques-f">
      <p className="intro-f">Entretiens obtenus sur candidatures envoyées, métier par métier : par profil de CV, puis par profil de recherche.</p>
      {page.profils.length ? genres.map(([genre, titre]) => (
        <div key={genre} className="genre-m">
          <p className="sous-carte">{titre}</p>
          {page.profils.filter((p) => p.genre === genre).map((p) => (
            <Bloc key={p.profil} titre={p.profil} lignes={[['Tous', winrate(p.total)], ...Object.entries(p.metiers).sort(([a], [b]) => a.localeCompare(b))
              .map(([m, b]): [string, string] => [m, winrate(b)])]} />
          ))}
        </div>
      )) : <p className="texte-f">Aucune candidature envoyée dans la période.</p>}
    </div>
  );
}

export function CorpsWorkflows({ page }: { page: PageMetriques }) {
  return (
    <div className="metriques-f">
      <p className="intro-f">Par site : « Conversé par l&apos;IA », la part des gestes que le modèle a dû décider, le reste rejoué par le workflow appris ; à sa création il converse tout, puis le rejeu prend le relais. Moyennes par candidature.</p>
      {page.workflows.length ? page.workflows.map((w) => (
        <Bloc key={w.site} titre={w.site} lignes={[
          ['Candidatures', nombre(w.candidatures)], ['Abouties', sur(w.abouties, w.taux_abouties)], ['Réutilisations', nombre(w.rejouees)],
          ["Conversé par l'IA", `${pourcent(w.conversation)} · création : ${pourcent(w.creation.conversation)}`],
          ['Appels au modèle', `${nombre(w.tours_moyen)} + ${nombre(w.jade_moyen)} JADE`],
          ['Jetons', `${nombre(w.jetons_moyen.entree)} écrits, ${pourcent(w.jetons_moyen.entree ? Math.round((100 * w.jetons_moyen.cache) / w.jetons_moyen.entree) : null)} lus en cache, ${nombre(w.jetons_moyen.ecrits)} écrits en cache, ${nombre(w.jetons_moyen.sortie)} reçus`],
          ['Infos utilisées', `${nombre(w.remplis_moyen)} dont ${nombre(w.remplis_ia_moyen)} par l'IA`], ['Durée', duree(w.duree_moyenne_s)],
          ['Coût moyen', w.cout ? dollars(w.cout_moyen) : '—'], ['Arrêts', w.motifs.map((m) => `${m.motif} ×${m.nombre}`).join(', ') || '—'],
        ]} />
      )) : <p className="texte-f">Aucune candidature mesurée dans la période. Les mesures arrivent avec les candidatures menées depuis cette version.</p>}
    </div>
  );
}

// Un tableau de bilans : détectées, envoyées, réponses et entretiens ; `sans` retire les détectées, qui ne comptent que les envoyées
function TableBilans<T extends Bilan>({ titre, lignes, nom, sans }: { titre: string; lignes: T[]; nom: (b: T) => React.ReactNode; sans?: boolean }) {
  return (
    <table className="compact tab-bilans">
      <thead><tr><th>{titre}</th>{!sans && <th>Détectées</th>}<th>Envoyées</th><th>Réponses</th><th>Entretiens</th></tr></thead>
      <tbody>
        {lignes.map((b, i) => (
          <tr key={i}><td>{nom(b)}</td>{!sans && <td>{nombre(b.offres)}</td>}<td>{nombre(b.envoyees)}</td><td>{sur(b.reponses, b.taux_reponse)}</td><td>{sur(b.entretiens, b.taux_entretien)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function CorpsMetiers({ page }: { page: PageMetriques }) {
  return (
    <div className="metriques-f">
      <p className="intro-f">Les familles de métiers des offres, puis les intitulés les plus détectés, leurs écritures voisines réunies (« H/F », tirets, majuscules).</p>
      {page.metiers.length ? <TableBilans titre="Métier" lignes={page.metiers} nom={(b) => b.metier} /> : <p className="texte-f">Aucune offre.</p>}
      {page.postes.length > 0 && (
        <TableBilans titre="Poste" lignes={page.postes} nom={(b) => <>{b.poste}{b.variantes > 1 && <span className="d"> · {b.variantes} écritures</span>}</>} />
      )}
    </div>
  );
}

export function CorpsFantomes({ page, fantomes, erreur, voir }: { page: PageMetriques; fantomes: Fantome[] | null; erreur: string; voir: (cle: string) => void }) {
  return (
    <div className="metriques-f">
      <p className="intro-f">Une offre FANTÔME est un poste que l&apos;employeur avait déjà publié dans les 90 jours : republié en boucle, répond-il moins qu&apos;un poste neuf ?</p>
      <TableBilans titre="Publication" lignes={page.fantomes} nom={(b) => b.publication} />
      <p className="sous-carte">Offres fantômes de la période</p>
      {erreur ? <p className="alerte-f">{erreur}</p> : fantomes === null ? <p className="texte-f">Lecture…</p> : fantomes.length ? (
        <table className="compact tab-liste">
          <thead><tr><th>Offre</th><th>Republiée</th><th>Candidature</th></tr></thead>
          <tbody>
            {fantomes.map((f) => (
              <tr key={f.cle} tabIndex={0} onClick={() => voir(f.cle)} onKeyDown={(e) => e.key === 'Enter' && voir(f.cle)} title="Ouvrir la fiche de l'offre">
                <td><b>{f.entreprise}</b> <span className="d">{f.titre}</span></td><td>{f.republiee} fois</td><td>{STATUTS[f.statut] ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="texte-f">Aucune offre fantôme dans la période.</p>}
    </div>
  );
}

export function CorpsLiens({ page, voir }: { page: PageMetriques; voir: (cle: string) => void }) {
  const l = page.liens;
  return (
    <div className="metriques-f">
      {l.suivies ? (
        <>
          <p className="intro-f">{nombre(l.ouvertes)} candidature(s) ouverte(s) sur {nombre(l.suivies)} envoyée(s) avec des liens suivis ({pourcent(l.taux_ouverture)}).</p>
          <div className="puces">{Object.keys(l.par_cible).length ? Object.entries(l.par_cible).map(([c, n]) => <span key={c} className="puce">{nomCible(c)} ×{n}</span>)
            : <span className="d">Aucun clic pour l&apos;instant.</span>}</div>
          {l.robots > 0 && <p className="aide-champ">{l.robots} passage(s) de robots (scanners de messagerie, aperçus) écartés.</p>}
        </>
      ) : <p className="intro-f">Aucune candidature envoyée avec des liens suivis : ils s&apos;activent dans Réglages → Liens suivis, une fois Ovrane déployé.</p>}
      {l.recentes.length > 0 && (
        <table className="compact tab-liste">
          <thead><tr><th>Quand</th><th>Lien</th><th>Offre</th></tr></thead>
          <tbody>
            {l.recentes.map((v, i) => (
              <tr key={i} tabIndex={v.offre_cle ? 0 : undefined} className={v.offre_cle ? '' : 'inerte'} title={v.offre_cle ? "Ouvrir la fiche de l'offre" : 'Offre purgée'}
                onClick={() => v.offre_cle && voir(v.offre_cle)} onKeyDown={(e) => e.key === 'Enter' && v.offre_cle && voir(v.offre_cle)}>
                <td>{quand(v.date)}</td><td>{nomCible(v.cible)}</td><td><b>{v.entreprise}</b> <span className="d">{v.titre}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function CorpsPartage({ suivi, erreur, voir }: { suivi: Suivi | null; erreur: string; voir: (cle: string) => void }) {
  if (erreur) return <div className="metriques-f"><p className="alerte-f">Injoignable : {erreur}</p></div>;
  if (!suivi) return <div className="metriques-f"><p className="texte-f">Lecture de la base partagée…</p></div>;
  if (!suivi.branchee) {
    return <div className="metriques-f"><p className="intro-f">Renseigne l&apos;adresse de la base et ton adresse dans Paramètres serveur → Base partagée : le portfolio y lira tes candidatures, et leurs visites reviendront ici.</p></div>;
  }
  return (
    <div className="metriques-f">
      <p className="intro-f">{nombre(suivi.candidatures.length)} candidature(s) lue(s) par le portfolio, avec les visites qu&apos;il a comptées.</p>
      {suivi.candidatures.length > 0 && (
        <table className="compact tab-liste">
          <thead><tr><th>Envoyée</th><th>Offre</th><th>CV servi</th><th>Visites</th></tr></thead>
          <tbody>
            {suivi.candidatures.map((c) => {
              const humaines = c.visites.filter((v) => !v.robot);
              return (
                <tr key={c.jeton} tabIndex={c.offre_cle ? 0 : undefined} className={c.offre_cle ? '' : 'inerte'} title={c.offre_cle ? "Ouvrir la fiche de l'offre" : 'Offre purgée'}
                  onClick={() => c.offre_cle && voir(c.offre_cle)} onKeyDown={(e) => e.key === 'Enter' && c.offre_cle && voir(c.offre_cle)}>
                  <td>{quand(c.envoyee_le)}</td><td><b>{c.entreprise}</b> <span className="d">{c.titre}</span></td><td>{c.cv ? 'oui' : '—'}</td>
                  <td>{humaines.length ? humaines.map((v) => `${nomCible(v.cible)} le ${quand(v.date)}`).join(', ') : 'pas encore ouverte'}
                    {c.visites.length > humaines.length && <span className="d"> +{c.visites.length - humaines.length} robot(s)</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function CorpsCv({ page }: { page: PageMetriques }) {
  const dimensions = Object.entries(page.cv);
  return (
    <div className="metriques-f">
      <p className="intro-f">Ce que le tirage du CV (fond, structure, photo, police) change aux réponses, sur les candidatures envoyées.</p>
      {dimensions.length ? dimensions.map(([d, valeurs]) => <TableBilans key={d} titre={DIMENSIONS[d] ?? d} lignes={valeurs} nom={(b) => b.valeur} sans />)
        : <p className="texte-f">Aucun CV tiré dans la période.</p>}
    </div>
  );
}

export function CorpsAppels({ page }: { page: PageMetriques }) {
  const a = page.appels;
  return (
    <div className="metriques-f">
      <p className="intro-f">{a.nombre ? `${nombre(a.nombre)} appel(s), ${duree(a.duree_s)} au total ; transcription ${dollars(a.cout_transcription)}, analyse ${dollars(a.cout_analyse)}.`
        : 'Aucun appel enregistré dans la période : la page Appels les transcrit et les analyse.'}</p>
      {a.liste.length > 0 && (
        <table className="compact tab-liste">
          <thead><tr><th>Quand</th><th>Appel</th><th>Durée</th><th>Transcription</th></tr></thead>
          <tbody>{a.liste.map((x) => <tr key={x.id}><td>{quand(x.debut)}</td><td><b>{x.titre || 'Appel'}</b></td><td>{duree(x.duree_s)}</td><td>{dollars(x.cout)}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}
