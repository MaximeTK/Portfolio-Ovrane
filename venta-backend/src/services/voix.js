/**
 * Signature des textes que le serveur fait dire : la voix ne lit qu'un passage d'un texte signé ici, jamais un texte libre
 */
import crypto from 'crypto';
import { config } from '../config.js';

// Une réponse du modèle tient bien en dessous ; au-delà, ce n'est pas un texte du serveur
export const MAX_SOURCE = 20_000;

// Dérivée du secret de service, que le navigateur ne voit jamais
const cle = () => crypto.createHmac('sha256', config.serviceSecret).update('ovrane:voix').digest();

// Lettres et chiffres seulement : le découpage en passages du navigateur n'en change aucun
const canon = (texte) => String(texte).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export const signerVoix = (texte) => crypto.createHmac('sha256', cle()).update(canon(texte)).digest('base64url');

// Le passage vient-il d'un texte que le serveur a produit et signé ?
export function voixPermise(passage, source, signature) {
  if (typeof source !== 'string' || typeof signature !== 'string' || !source || source.length > MAX_SOURCE) return false;
  const attendue = Buffer.from(signerVoix(source));
  const recue = Buffer.from(signature);
  if (attendue.length !== recue.length || !crypto.timingSafeEqual(attendue, recue)) return false;
  const morceau = canon(passage);
  return morceau.length > 0 && canon(source).includes(morceau);
}
