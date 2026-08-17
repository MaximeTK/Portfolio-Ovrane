/**
 * Journalisation à niveaux.
 *
 * Le dépôt comptait 275 appels console.* sans aucun moyen de les réduire en
 * production, où la rétention des logs Render est limitée. `debug` regroupe le
 * traçage par requête : muet par défaut, activable par LOG_VERBOSE=true.
 *
 * Lu à l'appel : dans server.js les imports sont évalués avant dotenv.config().
 */
export function debug(...args) {
  if (process.env.LOG_VERBOSE === 'true') console.log(...args);
}
