/** Appareil déjà connecté du compte : dispense de la limite par identifiant */
import { egal, signataire } from '../http.js';

const DUREE_APPAREIL = 365 * 24 * 3600 * 1000;

// Rien n'est gardé en base, la signature suffit
const signer = signataire('appareil');

// Signée avec le haché du mot de passe : un nouveau mot de passe l'annule
export function marquerAppareil(id, passwordHash, maintenant = Date.now()) {
  const charge = `${id}.${maintenant + DUREE_APPAREIL}`;
  return { jeton: `${charge}.${signer(`${charge}.${passwordHash}`)}`, expireLe: new Date(maintenant + DUREE_APPAREIL).toISOString() };
}

// La marque vaut-elle pour ce compte et son mot de passe, sans être échue ?
export function appareilDe(jeton, compte, maintenant = Date.now()) {
  if (typeof jeton !== 'string' || jeton.length > 200 || !compte?.id) return false;
  const [id, echeance, signature, ...reste] = jeton.split('.');
  return !reste.length && Boolean(signature) && id === compte.id && Number(echeance) > maintenant
    && egal(signature, signer(`${id}.${echeance}.${compte.passwordHash}`));
}
