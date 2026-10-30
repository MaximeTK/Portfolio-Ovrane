/**
 * Conservation : rien n'est gardé au-delà de 90 jours sans activité (visite du site, clic d'un lien suivi, mail reçu par Illusion)
 */
import { User } from '../models/User.js';
import { RedirectLog } from '../models/RedirectLog.js';
import { IllusionCandidature } from '../models/IllusionCandidature.js';
import { config } from '../config.js';

// Activité d'une candidature, partagée avec Illusion qui la monte aussi à chaque mail reçu
export function noterActivite(jeton, maintenant = new Date()) {
  return IllusionCandidature.updateOne({ jeton }, { $max: { activite_le: maintenant } });
}

export async function purger(maintenant = Date.now()) {
  const limite = new Date(maintenant - config.conservationJours * 86_400_000);
  const visiteurs = await User.deleteMany({ email: { $exists: false }, lastVisit: { $lt: limite } });
  // Un compte inactif garde ses identifiants, pas ce qu'il a dit ni d'où il venait
  const comptes = await User.updateMany({ email: { $exists: true }, lastVisit: { $lt: limite } }, { $set: { conversations: [], visitedLinks: [], ipHashes: [] } });
  // Les empreintes d'IP ne sont plus collectées : celles d'avant s'effacent partout, actifs compris
  await User.updateMany({ 'ipHashes.0': { $exists: true } }, { $set: { ipHashes: [] } });
  // Ni l'IP ni le navigateur des clics : ceux d'avant s'effacent aussi (hors du schéma, d'où strict: false)
  await RedirectLog.updateMany({ $or: [{ ip: { $exists: true } }, { userAgent: { $exists: true } }] }, { $unset: { ip: '', userAgent: '' } }, { strict: false });
  // Les clics d'une candidature vivent tant qu'elle est active ; ceux sans candidature n'ont que leur propre date
  const jetons = await RedirectLog.distinct('jeton', { jeton: { $exists: true } });
  const actifs = new Set(await IllusionCandidature.distinct('jeton', {
    jeton: { $in: jetons },
    $or: [{ activite_le: { $gte: limite } }, { envoyee_le: { $gte: limite } }],
  }));
  const clics = await RedirectLog.deleteMany({ $or: [
    { jeton: { $exists: false }, timestamp: { $lt: limite } },
    { jeton: { $in: jetons.filter((jeton) => !actifs.has(jeton)) } },
  ] });
  return { visiteursSupprimes: visiteurs.deletedCount, comptesAlleges: comptes.modifiedCount, clicsSupprimes: clics.deletedCount };
}

// L'ancien index TTL des clics (un an, durée fixe) cède la place à la purge par activité, puis la purge passe
export async function conserver() {
  const ttl = (await RedirectLog.collection.indexes()).find((index) => index.expireAfterSeconds !== undefined);
  if (ttl) await RedirectLog.collection.dropIndex(ttl.name);
  return purger();
}
