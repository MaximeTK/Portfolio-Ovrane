/**
 * Plafond de dépense du jour : un visiteur anonyme ne coûte rien tant que le modèle et la voix restent sous ces plafonds,
 * tous visiteurs confondus. Au-delà, le service se met en veille jusqu'au lendemain plutôt que de brûler les crédits.
 */
import { Budget } from '../models/Budget.js';
import { config } from '../config.js';
import * as log from '../log.js';

const jour = (maintenant) => maintenant.toISOString().slice(0, 10);

/**
 * Compte un appel payant de ce type (« chat » ou « tts ») pour aujourd'hui et dit s'il reste sous le plafond.
 * Plafond à 0 : aucune limite, rien n'est écrit. Base injoignable : on laisse passer (le plafond ne doit pas couper le service).
 */
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
