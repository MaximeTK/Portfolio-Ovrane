/** Sessions opaques : jeton en cookie, seule l'empreinte en base */
import crypto from 'crypto';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';

const DUREE = 30 * 24 * 3600 * 1000;
const UN_JOUR = 24 * 3600 * 1000;
// Au-delà, même utilisée chaque jour, la session se rouvre par connexion
const DUREE_MAX = 180 * UN_JOUR;
const MEMOIRE_DUREE = 15 * 1000;
const MEMOIRE_MAX = 1000;
// Empreinte → lecture en cours ou compte vérifié, pour le relais qui sonde
const memoire = new Map();

export const empreinte = (jeton) => crypto.createHash('sha256').update(jeton).digest('hex');
// 32 octets en base64url, comme les jetons de réinitialisation
export const estJeton = (jeton) => typeof jeton === 'string' && /^[A-Za-z0-9_-]{43}$/.test(jeton);

export const nouveauJeton = () => crypto.randomBytes(32).toString('base64url');

export async function creerSession(utilisateur) {
  const jeton = nouveauJeton();
  const maintenant = new Date();
  const expireLe = new Date(maintenant.getTime() + DUREE);
  await Session.create({ _id: empreinte(jeton), utilisateur, creeLe: maintenant, vuLe: maintenant, expireLe });
  return { jeton, expireLe };
}

// Session valide du jeton, prolongée au plus une fois par jour ; null sinon
export async function lireSession(jeton) {
  if (!estJeton(jeton)) return null;
  const maintenant = new Date();
  const session = await Session.findOne({ _id: empreinte(jeton), expireLe: { $gt: maintenant }, creeLe: { $gt: new Date(maintenant - DUREE_MAX) } }).lean();
  if (session && maintenant - session.vuLe > UN_JOUR) {
    await Session.updateOne({ _id: session._id }, { $set: { vuLe: maintenant, expireLe: new Date(maintenant.getTime() + DUREE) } });
  }
  return session;
}

export const oublierComptes = () => memoire.clear();

export async function revoquerSession(jeton) {
  if (estJeton(jeton)) await Session.deleteOne({ _id: empreinte(jeton) });
  oublierComptes();
}

async function lireCompte(jeton) {
  const session = await lireSession(jeton);
  const user = session && await User.findOne({ id: session.utilisateur }, { _id: 0, email: 1, emailVerifieLe: 1, 'deuxiemeFacteur.activeLe': 1 }).lean();
  return { session, user };
}

// Session et compte du relais ; refus et pannes sont relus à chaque appel
export function compteDeSession(jeton) {
  if (!estJeton(jeton)) return { session: null };
  const cle = empreinte(jeton);
  const connu = memoire.get(cle);
  if (connu?.expire > Date.now()) return connu.lecture;
  memoire.delete(cle);
  if (memoire.size >= MEMOIRE_MAX) memoire.delete(memoire.keys().next().value);
  const entree = { lecture: lireCompte(jeton), expire: Date.now() + MEMOIRE_DUREE };
  memoire.set(cle, entree);
  const oublier = () => {
    if (memoire.get(cle) === entree) memoire.delete(cle);
  };
  entree.lecture.then(({ user }) => {
    if (!user?.email || !user.emailVerifieLe) oublier();
  }, oublier);
  return entree.lecture;
}
