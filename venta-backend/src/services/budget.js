/** Plafond de dépense du jour : au-delà, veille jusqu'au lendemain */
import { Budget } from '../models/Budget.js';
import { config } from '../config.js';
import * as log from '../log.js';

const jour = (maintenant) => maintenant.toISOString().slice(0, 10);

/** Compte un appel payant (chat, tts) ; plafond 0 ou base HS : passe */
export async function consommer(type, maintenant = new Date()) {
  const plafond = config.budget[type] || 0;
  if (plafond <= 0) return true;
  try {
    const dans48h = new Date(maintenant.getTime() + 48 * 3600 * 1000);
    const doc = await Budget.findOneAndUpdate(
      { _id: jour(maintenant) },
      { $inc: { [type]: 1 }, $set: { expireLe: dans48h } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    const atteint = (doc?.[type] ?? 1) > plafond;
    if (atteint) log.warn(`[BUDGET] Plafond ${type} atteint pour ${jour(maintenant)} (${doc?.[type]}/${plafond})`);
    return !atteint;
  } catch (error) {
    log.error('[BUDGET] Compteur indisponible, appel laissé passer :', error.message);
    return true;
  }
}
