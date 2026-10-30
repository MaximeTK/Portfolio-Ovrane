/**
 * Marque d'un appareil où un compte s'est déjà connecté : elle ne connecte personne, elle dispense seulement ce compte de
 * la limite par identifiant, qu'un tiers pourrait sinon épuiser depuis plusieurs IP pour bloquer son titulaire
 */
import crypto from 'crypto';
import { egal } from '../http.js';
import { config } from '../config.js';

export const DUREE_APPAREIL = 365 * 24 * 3600 * 1000;

// Dérivée du secret de service : rien n'est gardé en base, la signature suffit
const cle = () => crypto.createHmac('sha256', config.serviceSecret).update('ovrane:appareil').digest();
const signer = (charge) => crypto.createHmac('sha256', cle()).update(charge).digest('base64url');

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
