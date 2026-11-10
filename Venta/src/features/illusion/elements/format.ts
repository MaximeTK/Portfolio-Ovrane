// Les mises en forme partagées : erreurs, dates, montants, listes
export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Une date d'Illusion sans fuseau est en UTC, un jour seul aussi
export function dateUtc(texte: string) {
  const iso = texte.trim().replace(' ', 'T');
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(iso) || iso.length <= 10 ? iso : `${iso}Z`);
}

// Jour, mois, heure et minute ; sans date, un tiret
export const quand = (iso?: string | null) => (iso ? dateUtc(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—');

export const heure = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const jourDe = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
// « 28/10 » à l'heure d'ici ; sans date, `vide`
export const jourMois = (iso?: string | null, vide = '—') => (iso ? jourDe(dateUtc(iso)) : vide);

// « 2026-10-28 » → « 28/10 », lu tel quel, sans fuseau
export function jourMoisIso(iso?: string | null) {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[2]}/${m[1]}` : '—';
}

// « 28/10 à 14:30 » ; sans date lisible, un tiret
export function jourEtHeure(iso?: string | null) {
  const d = iso ? dateUtc(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? `${jourDe(d)} à ${heure(d)}` : '—';
}

// Une durée mesurée, des secondes aux heures ; sans durée, un tiret
export const dureeOuTiret = (s?: number | null) => (!s ? '—' : s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`
  : `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`);

export const dollars = (v: number) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: v > 0 && v < 0.01 ? 4 : 2 })} $`;

export const sansJson = (nom: string) => nom.replace(/\.json$/i, '');
// « data/developpeur.json » → « developpeur.json », puis « developpeur »
export const nomFichier = (chemin?: string | null) => String(chemin ?? '').split(/[\\/]/).pop() ?? '';
export const nomProfil = (chemin?: string | null) => sansJson(nomFichier(chemin));

// Seules les adresses web s'ouvrent
export function lienSur(url?: string | null) {
  try {
    const u = new URL(url ?? '');
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

// Les plateformes de la brique Veille, dans l'ordre de l'ancien dashboard
export const PLATEFORMES: Record<string, string> = {
  france_travail: 'France Travail', apec: 'APEC', free_work: 'Free-Work', wttj: 'Welcome to the Jungle', hellowork: 'HelloWork',
  linkedin: 'LinkedIn', adzuna: 'Adzuna', jooble: 'Jooble', careerjet: 'Careerjet', indeed: 'Indeed', ats: 'Boards employeurs',
};
const SOURCES: Record<string, string> = { ...PLATEFORMES, manuelle: 'Ajoutée à la main', constructeur: 'Constructeur' };
export const libelleSource = (s: string) => SOURCES[s] ?? (s || '—');

// Langues proposées ; un code posé hors liste reste proposé tel quel
export const LANGUES: Record<string, string> = { fr: 'Français', en: 'Anglais', de: 'Allemand', es: 'Espagnol', it: 'Italien', pt: 'Portugais', nl: 'Néerlandais' };
export const nomLangue = (v: string) => (v === '-' ? 'sans langue' : LANGUES[v] ?? v);
export const nomMetier = (v: string) => (v === '-' ? 'sans métier' : v);

// Un filtre par métier ou langue : le choix courant reste, « sans » en dernier
export function optionsGroupe(comptes: Record<string, number> | undefined, choisi: string, nom: (v: string) => string) {
  const tous = { ...(comptes ?? {}) };
  if (choisi && !(choisi in tous)) tous[choisi] = 0;
  return Object.entries(tous)
    .sort(([a], [b]) => Number(a === '-') - Number(b === '-') || a.localeCompare(b, 'fr'))
    .map(([valeur, compte]) => ({ valeur, nom: nom(valeur), compte }));
}

// « a, b, c » devient une liste, sans vide
export const parVirgules = (texte: string) => texte.split(',').map((v) => v.trim()).filter(Boolean);

// Les motifs d'un dossier resté à la main, nommés comme dans l'ancien dashboard
export const MOTIFS: Record<string, string> = {
  offre_fermee: 'offre retirée', hors_profil: 'hors profil', captcha: 'vérification humaine', compte: 'compte / connexion',
  depot: 'pièce refusée', page_sourde: 'page muette', boucle: 'tourne en rond', plafond_tours: 'plafond de tours', brique: 'brique muette',
};

// Le catalogue en options ; `detail` montre le vrai modèle derrière le nom
export const optionsModele = (modeles: { nom: string; modele?: string }[], vide: string, detail = true): [string, string][] =>
  [['', vide], ...modeles.map((m): [string, string] => [m.nom, detail && m.modele ? `${m.nom} · ${m.modele}` : m.nom])];

// Une valeur enregistrée qui a quitté le catalogue reste visible
export const avecAbsent = (options: [string, string][], valeur: string): [string, string][] =>
  (valeur && !options.some(([o]) => o === valeur) ? [...options, [valeur, `${valeur} (absent du catalogue)`]] : options);
