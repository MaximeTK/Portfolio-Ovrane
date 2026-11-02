/** Signature des textes dits par le serveur, jamais un texte libre */
import { egal, signataire } from '../http.js';

// Une réponse du modèle tient en dessous ; au-delà, pas un texte du serveur
const MAX_SOURCE = 20_000;

// Lettres et chiffres seulement : le découpage en passages n'en change aucun
const canon = (texte) => String(texte).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

const signer = signataire('voix');
export const signerVoix = (texte) => signer(canon(texte));

// Le passage vient-il d'un texte que le serveur a produit et signé ?
export function voixPermise(passage, source, signature) {
  if (typeof source !== 'string' || typeof signature !== 'string' || !source || source.length > MAX_SOURCE) return false;
  if (!egal(signature, signerVoix(source))) return false;
  const morceau = canon(passage);
  return morceau.length > 0 && canon(source).includes(morceau);
}
