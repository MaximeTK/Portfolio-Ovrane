/**
 * Preuve de travail avant la création d'un visiteur : une fraction de seconde pour un navigateur, un coût par profil
 * pour un robot qui en crée en masse. Sans service tiers ni donnée personnelle : rien d'autre qu'un calcul.
 */
import crypto from 'crypto';
import { Defi } from '../models/Defi.js';
import { egal } from '../http.js';
import { config } from '../config.js';

export const DUREE_DEFI = 5 * 60 * 1000;

// Dérivée du secret de service : le défi se vérifie sans rien garder avant sa résolution
const cle = () => crypto.createHmac('sha256', config.serviceSecret).update('ovrane:defi').digest();
const signer = (charge) => crypto.createHmac('sha256', cle()).update(charge).digest('base64url');

// Bits à zéro en tête d'une empreinte
export function zerosEnTete(octets) {
  let bits = 0;
  for (const octet of octets) {
    if (octet) return bits + Math.clz32(octet) - 24;
    bits += 8;
  }
  return bits;
}

// Sel aléatoire, échéance et difficulté, signés : trouver un nombre dont le SHA-256 de « défi:nombre » commence par assez de zéros
export function nouveauDefi(maintenant = Date.now()) {
  const { difficulte } = config.defi;
  const charge = `${crypto.randomBytes(16).toString('base64url')}.${maintenant + DUREE_DEFI}.${difficulte}`;
  return { defi: `${charge}.${signer(charge)}`, difficulte };
}

// Signé ici, encore valable, résolu, et présenté pour la première fois
export async function defiResolu(defi, solution, maintenant = Date.now()) {
  if (typeof defi !== 'string' || defi.length > 200 || typeof solution !== 'string' || !/^\d{1,15}$/.test(solution)) return false;
  const [sel, echeance, difficulte, signature, ...reste] = defi.split('.');
  if (!signature || reste.length || !egal(signature, signer(`${sel}.${echeance}.${difficulte}`))) return false;
  if (!(Number(echeance) > maintenant) || !(Number(difficulte) >= config.defi.difficulte)) return false;
  if (zerosEnTete(crypto.createHash('sha256').update(`${defi}:${solution}`).digest()) < Number(difficulte)) return false;
  try {
    const vu = await Defi.findOneAndUpdate(
      { _id: sel },
      { $inc: { usages: 1 }, $set: { expireLe: new Date(Number(echeance)) } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    return vu?.usages === 1;
  } catch (error) {
    // Deux présentations simultanées du même défi : une seule l'emporte
    if (error.code === 11000) return false;
    throw error;
  }
}
