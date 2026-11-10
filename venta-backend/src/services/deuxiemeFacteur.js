/** Second facteur TOTP (RFC 6238) : secret chiffré, code servi une fois */
import crypto from 'crypto';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { oublierComptes } from './sessions.js';
import { egal } from '../http.js';
import { config } from '../config.js';

const PAS = 30_000;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Clé tirée du secret partagé avec Illusion, qui pourra vérifier le même code
const cle = () => crypto.createHmac('sha256', config.illusion.secret).update('ovrane:deuxieme-facteur').digest();

function chiffrer(octets) {
  const iv = crypto.randomBytes(12);
  const chiffreur = crypto.createCipheriv('aes-256-gcm', cle(), iv);
  const chiffre = Buffer.concat([chiffreur.update(octets), chiffreur.final()]);
  return [iv, chiffreur.getAuthTag(), chiffre].map((partie) => partie.toString('base64url')).join('.');
}

function dechiffrer(texte) {
  const [iv, tag, chiffre] = String(texte).split('.').map((partie) => Buffer.from(partie, 'base64url'));
  const dechiffreur = crypto.createDecipheriv('aes-256-gcm', cle(), iv);
  dechiffreur.setAuthTag(tag);
  return Buffer.concat([dechiffreur.update(chiffre), dechiffreur.final()]);
}

// Code à six chiffres d'un pas de 30 s (HOTP, RFC 4226)
export function codeTotp(secret, pas) {
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(pas));
  const hmac = crypto.createHmac('sha1', secret).update(compteur).digest();
  return String((hmac.readUInt32BE(hmac[19] & 0xf) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

// Pas du code reçu, à un pas près de l'horloge ; null s'il ne vaut rien
function pasDuCode(secretChiffre, code, maintenant) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  let secret;
  try {
    secret = dechiffrer(secretChiffre);
  } catch {
    return null;
  }
  const pas = Math.floor(maintenant / PAS);
  return [pas - 1, pas, pas + 1].find((essai) => egal(codeTotp(secret, essai), code)) ?? null;
}

// Code bon et jamais servi : son pas est consommé d'un seul geste en base
export async function codeValide(compte, code, maintenant = Date.now()) {
  const pas = pasDuCode(compte.deuxiemeFacteur?.secret, code, maintenant);
  if (pas === null) return false;
  const { matchedCount } = await User.updateOne(
    { id: compte.id, 'deuxiemeFacteur.dernierPas': { $lt: pas } },
    { $set: { 'deuxiemeFacteur.dernierPas': pas } },
  );
  return matchedCount === 1;
}

// Nouveau secret en attente, l'actif reste valable ; null sans compte
export async function preparerDeuxiemeFacteur(email) {
  if (!config.illusion.secret) throw new Error('ILLUSION_SERVICE_SECRET absent : secret impossible à chiffrer.');
  const secret = crypto.randomBytes(20);
  const { matchedCount } = await User.updateOne({ email }, { $set: { 'deuxiemeFacteur.attente': chiffrer(secret) } });
  if (!matchedCount) return null;
  let bits = '';
  for (const octet of secret) bits += octet.toString(2).padStart(8, '0');
  const base32 = bits.match(/.{5}/g).map((groupe) => BASE32[parseInt(groupe, 2)]).join('');
  return { secret: base32, uri: `otpauth://totp/Ovrane:${encodeURIComponent(email)}?secret=${base32}&issuer=Ovrane` };
}

// Un code bon active le secret en attente et ferme les sessions du compte
export async function activerDeuxiemeFacteur(email, code, maintenant = Date.now()) {
  const compte = await User.findOne({ email }, { _id: 0, id: 1, deuxiemeFacteur: 1 }).lean();
  const attente = compte?.deuxiemeFacteur?.attente;
  const pas = attente ? pasDuCode(attente, code, maintenant) : null;
  if (pas === null) return false;
  await User.updateOne({ id: compte.id }, { $set: {
    'deuxiemeFacteur.secret': attente, 'deuxiemeFacteur.attente': null, 'deuxiemeFacteur.dernierPas': pas, 'deuxiemeFacteur.activeLe': new Date(maintenant),
  } });
  await Session.deleteMany({ utilisateur: compte.id });
  oublierComptes();
  return true;
}
