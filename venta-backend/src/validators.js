/** Validation des entrées */

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Jeton de candidature Illusion : 10 caractères [a-z0-9], liens en minuscules
export function isValidJeton(jeton) {
  return typeof jeton === 'string' && /^[a-z0-9]{10}$/.test(jeton);
}

// Scanners, aperçus, crawlers, clients HTTP, sans tête, pré-requête Office
const ROBOT_USER_AGENT = /(?<!cu)bot\b|crawl|spider|slurp|preview|scanner|safelinks|proofpoint|urldefense|mimecast|barracuda|facebookexternalhit|slack|whatsapp|skype|embedly|curl|wget|python|aiohttp|httpx|go-http-client|java\/|okhttp|node-fetch|axios|headless|phantomjs|lighthouse|microsoft office|ms-office/i;

// Vrai si le user-agent n'est pas un humain en navigateur ; absent = robot
export function isRobotUserAgent(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent.trim() : '';
  return !ua || ua.toLowerCase() === 'unknown' || ROBOT_USER_AGENT.test(ua);
}

// Nom d'image sans séparateur de chemin ni caractère à risque
export function isValidAssetFilename(filename) {
  if (typeof filename !== 'string') return false;
  const name = filename.trim();
  if (!name || name.length > 200 || name.includes('..')) return false;
  return /^[a-zA-Z0-9 _.\-()]+$/.test(name) && /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
}

// Nom de fichier seul, sans le point final que le modèle ajoute parfois
export function normalizeAssetParamToFilename(param) {
  let raw = typeof param === 'string' ? param.trim() : '';
  if (raw.endsWith('.')) raw = raw.slice(0, -1);
  return (raw.split(/[\\/]/).pop() || '').trim();
}
