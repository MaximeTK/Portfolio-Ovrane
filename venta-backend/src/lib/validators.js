/**
 * Helpers de validation / sanitation centralisés (sécurité + robustesse)
 */

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Identifiant client-side (localStorage) ou hash backend.
 * On limite volontairement le set de caractères pour éviter injections / path tricks.
 *
 * @param {unknown} userId
 */
export function isValidUserId(userId) {
  if (typeof userId !== 'string') return false;
  const trimmed = userId.trim();
  // 6..64 pour éviter les IDs trop courts (bruteforce) ou trop longs (DoS / logs / DB)
  return /^[a-zA-Z0-9_-]{6,64}$/.test(trimmed);
}

/**
 * Noms d'assets autorisés (ex: "Pico Interface.png").
 * On interdit les séparateurs de chemin et les caractères à risque.
 *
 * @param {unknown} filename
 */
export function isValidAssetFilename(filename) {
  if (typeof filename !== 'string') return false;
  const name = filename.trim();
  if (!name) return false;
  if (name.length > 200) return false;
  if (name.includes('..')) return false;
  if (name.includes('/') || name.includes('\\')) return false;
  // Autoriser lettres, chiffres, espaces et quelques caractères usuels
  if (!/^[a-zA-Z0-9 _.\-()]+$/.test(name)) return false;
  // Extensions d'images courantes
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
}

/**
 * Normalise un paramètre d'asset image en nom de fichier (basename) et retire le point final.
 * @param {unknown} param
 * @returns {string}
 */
export function normalizeAssetParamToFilename(param) {
  let raw = typeof param === 'string' ? param.trim() : '';
  if (!raw) return '';

  // Nettoyage: OpenAI met parfois un point final après l'extension
  if (raw.endsWith('.')) raw = raw.slice(0, -1);

  // On conserve uniquement le basename (anti path traversal)
  const parts = raw.split(/[\\/]/);
  const base = (parts[parts.length - 1] || '').trim();
  return base;
}



