/** Mot de passe oublié : lien unique de 30 min, la base garde l'empreinte */
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { Reinitialisation } from '../models/Reinitialisation.js';
import { empreinte, estJeton, nouveauJeton, oublierComptes } from './sessions.js';
import { envoyerMail } from './mails.js';
import { config } from '../config.js';
import { MAILS } from '../messages.js';
import * as log from '../log.js';

const DUREE_LIEN = 30 * 60 * 1000;

// Envoie le lien au compte s'il existe ; seul le dernier reste valable
export async function demanderReinitialisation(email) {
  const compte = await User.findOne({ email }, { _id: 0, id: 1, name: 1, email: 1 }).lean();
  if (!compte) return false;
  if (!config.siteUrl) {
    log.error('[MAIL] SITE_URL absent : lien de réinitialisation non envoyé');
    return false;
  }
  await Reinitialisation.deleteMany({ utilisateur: compte.id });
  const jeton = nouveauJeton();
  const maintenant = new Date();
  await Reinitialisation.create({ _id: empreinte(jeton), utilisateur: compte.id, creeLe: maintenant, expireLe: new Date(maintenant.getTime() + DUREE_LIEN) });
  // Dans le fragment : le jeton n'atteint jamais un serveur ni ses journaux
  return envoyerMail(compte.email, MAILS.reinitialisation(compte.name, `${config.siteUrl}/connexion#reinit=${jeton}`));
}

// Change le mot de passe, consomme le lien, ferme les sessions du compte
export async function reinitialiser(jeton, motDePasse) {
  if (!estJeton(jeton)) return false;
  const demande = await Reinitialisation.findOneAndDelete({ _id: empreinte(jeton), expireLe: { $gt: new Date() } }).lean();
  if (!demande) return false;
  const passwordHash = await bcrypt.hash(motDePasse, 12);
  // Invalide aussi les sessions signées d'Illusion, qui partage les comptes
  const compte = await User.findOneAndUpdate(
    { id: demande.utilisateur },
    // Un lien reçu prouve l'adresse : il vaut aussi vérification
    { $set: { passwordHash, motDePasseChangeLe: new Date(), emailVerifieLe: new Date() } },
    { projection: { _id: 0, name: 1, email: 1 } },
  ).lean();
  if (!compte) return false;
  await Session.deleteMany({ utilisateur: demande.utilisateur });
  oublierComptes();
  envoyerMail(compte.email, MAILS.motDePasseChange(compte.name));
  return true;
}
