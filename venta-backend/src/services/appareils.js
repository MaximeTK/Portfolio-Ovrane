/** Appareil déjà connecté du compte : dispense de la limite par identifiant */
import { egal, signataire } from '../http.js';

const DUREE_APPAREIL = 365 * 24 * 3600 * 1000;

// Rien n'est gardé en base, la signature suffit
const signer = signataire('appareil');

export function marquerAppareil(id, maintenant = Date.now()) {
  const charge = `${id}.${maintenant + DUREE_APPAREIL}`;
  return { jeton: `${charge}.${signer(charge)}`, expireLe: new Date(maintenant + DUREE_APPAREIL).toISOString() };
}

// La marque vaut-elle pour ce compte, et n'est-elle pas échue ?
export function appareilDe(jeton, id, maintenant = Date.now()) {
  if (typeof jeton !== 'string' || jeton.length > 200 || !id) return false;
  const [compte, echeance, signature, ...reste] = jeton.split('.');
  return !reste.length && Boolean(signature) && compte === id && Number(echeance) > maintenant
    && egal(signature, signer(`${compte}.${echeance}`));
}
