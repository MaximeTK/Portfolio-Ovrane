/** Rien n'est gardé au-delà de 90 jours sans activité */
import { User } from '../models/User.js';
import { RedirectLog } from '../models/RedirectLog.js';
import { IllusionCandidature } from '../models/IllusionCandidature.js';
import { config } from '../config.js';

// Activité d'une candidature, aussi montée par Illusion à chaque mail reçu
export function noterActivite(jeton, maintenant = new Date()) {
  return IllusionCandidature.updateOne({ jeton }, { $max: { activite_le: maintenant } });
}

export async function purger(maintenant = Date.now()) {
  const limite = new Date(maintenant - config.conservationJours * 86_400_000);
  const visiteurs = await User.deleteMany({ email: { $exists: false }, lastVisit: { $lt: limite } });
  // Un compte inactif garde ses identifiants, pas ses échanges ni son origine
  const comptes = await User.updateMany({ email: { $exists: true }, lastVisit: { $lt: limite } }, { $set: { conversations: [], visitedLinks: [], ipHashes: [] } });
  // Les empreintes d'IP ne sont plus collectées : celles d'avant s'effacent
  await User.updateMany({ 'ipHashes.0': { $exists: true } }, { $set: { ipHashes: [] } });
  // Ni IP ni navigateur des clics : ceux d'avant s'effacent (strict: false)
  await RedirectLog.updateMany({ $or: [{ ip: { $exists: true } }, { userAgent: { $exists: true } }] }, { $unset: { ip: '', userAgent: '' } }, { strict: false });
  // Clics gardés tant que la candidature est active, sinon leur propre date
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

// L'ancien index TTL des clics cède la place à la purge par activité
export async function conserver() {
  const ttl = (await RedirectLog.collection.indexes()).find((index) => index.expireAfterSeconds !== undefined);
  if (ttl) await RedirectLog.collection.dropIndex(ttl.name);
  return purger();
}
