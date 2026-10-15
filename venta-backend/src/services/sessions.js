/**
 * Sessions opaques : le navigateur garde le jeton en cookie, la base n'en garde que l'empreinte
 */
import crypto from 'crypto';
import { Session } from '../models/Session.js';

const DUREE = 30 * 24 * 3600 * 1000;
const UN_JOUR = 24 * 3600 * 1000;

const empreinte = (jeton) => crypto.createHash('sha256').update(jeton).digest('hex');
// 32 octets en base64url
const estJeton = (jeton) => typeof jeton === 'string' && /^[A-Za-z0-9_-]{43}$/.test(jeton);

export async function creerSession(utilisateur) {
  const jeton = crypto.randomBytes(32).toString('base64url');
  const maintenant = new Date();
  const expireLe = new Date(maintenant.getTime() + DUREE);
  await Session.create({ _id: empreinte(jeton), utilisateur, creeLe: maintenant, vuLe: maintenant, expireLe });
  return { jeton, expireLe };
}

// Session valide du jeton, prolongée au plus une fois par jour à l'usage ; null sinon
export async function lireSession(jeton) {
  if (!estJeton(jeton)) return null;
  const maintenant = new Date();
  const session = await Session.findOne({ _id: empreinte(jeton), expireLe: { $gt: maintenant } }).lean();
  if (session && maintenant - session.vuLe > UN_JOUR) {
    await Session.updateOne({ _id: session._id }, { $set: { vuLe: maintenant, expireLe: new Date(maintenant.getTime() + DUREE) } });
  }
  return session;
}

export async function revoquerSession(jeton) {
  if (estJeton(jeton)) await Session.deleteOne({ _id: empreinte(jeton) });
}
