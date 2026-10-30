/**
 * Vérification de l'adresse e-mail d'un compte : un lien à usage unique, valable 24 heures, envoyé par e-mail.
 * Illusion connaît ses comptes par leur adresse : seul un compte dont l'adresse est prouvée peut l'ouvrir.
 */
import crypto from 'crypto';
import { User } from '../models/User.js';
import { Verification } from '../models/Verification.js';
import { empreinte, estJeton } from './sessions.js';
import { envoyerMail } from './mails.js';
import { config } from '../config.js';
import { MAILS } from '../messages.js';
import * as log from '../log.js';

export const DUREE_LIEN = 24 * 3600 * 1000;

// Envoie le lien à l'adresse du compte ; seul le dernier lien demandé reste valable
export async function demanderVerification({ id, name, email }) {
  if (!email) return false;
  if (!config.siteUrl) {
    log.error('[MAIL] SITE_URL absent : lien de vérification non envoyé');
    return false;
  }
  await Verification.deleteMany({ utilisateur: id });
  const jeton = crypto.randomBytes(32).toString('base64url');
  const maintenant = new Date();
  await Verification.create({ _id: empreinte(jeton), utilisateur: id, email, creeLe: maintenant, expireLe: new Date(maintenant.getTime() + DUREE_LIEN) });
  // Dans le fragment : le jeton n'atteint jamais un serveur ni ses journaux
  return envoyerMail(email, MAILS.verification(name, `${config.siteUrl}/connexion#verif=${jeton}`));
}

// Consomme le lien et marque l'adresse vérifiée, si elle est toujours celle du compte
export async function verifier(jeton) {
  if (!estJeton(jeton)) return false;
  const demande = await Verification.findOneAndDelete({ _id: empreinte(jeton), expireLe: { $gt: new Date() } }).lean();
  if (!demande) return false;
  const { matchedCount } = await User.updateOne({ id: demande.utilisateur, email: demande.email }, { $set: { emailVerifieLe: new Date() } });
  return matchedCount > 0;
}
