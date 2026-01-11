/**
 * Tools UI: convertit des intentions d'actions (image, fond, fenêtres) en commandes frontend.
 * IMPORTANT: Ces outils ne doivent pas modifier le texte de réponse, ils ajoutent uniquement des commandes
 * dans le contexte de requête afin que le frontend exécute l'action.
 */
import { getRequestContext } from './contextHelpers.js';
import { normalizeAssetParamToFilename } from '../validators.js';

function ensureUiCommandsArray(ctx) {
  if (!ctx) return null;
  if (!Array.isArray(ctx.uiCommands)) ctx.uiCommands = [];
  return ctx.uiCommands;
}

function pushUiCommand(command, parameter) {
  const ctx = getRequestContext();
  const list = ensureUiCommandsArray(ctx);
  if (!list) {
    return { success: false, message: 'Contexte de requête indisponible' };
  }
  const cmd = String(command || '').trim();
  const param = String(parameter || '').trim();
  if (!cmd) {
    return { success: false, message: 'Commande invalide' };
  }
  list.push({ command: cmd, parameter: param });
  return { success: true };
}

export async function uiShowPicture({ filename }) {
  const normalized = normalizeAssetParamToFilename(filename);
  if (!normalized) {
    return { success: false, message: 'filename invalide (doit être un nom de fichier image)' };
  }
  const r = pushUiCommand('ShowPicture', normalized);
  return r.success
    ? { success: true, message: `Image demandée: ${normalized}` }
    : r;
}

export async function uiSetBackground({ paletteId }) {
  const id = String(paletteId || '').trim();
  if (!id) {
    return { success: false, message: 'paletteId manquant' };
  }
  const r = pushUiCommand('SetBackground', id);
  return r.success
    ? { success: true, message: `Fond demandé: ${id}` }
    : r;
}

export async function uiShowCode({ language }) {
  const lang = String(language || '').trim();
  if (!lang) {
    return { success: false, message: 'language manquant' };
  }
  const r = pushUiCommand('ShowCode', lang);
  return r.success
    ? { success: true, message: `Fenêtre code demandée: ${lang}` }
    : r;
}

export async function uiOpenWindow({ title }) {
  const t = String(title || '').trim();
  if (!t) {
    return { success: false, message: 'title manquant' };
  }
  const r = pushUiCommand('OpenWindow', t);
  return r.success
    ? { success: true, message: `Fenêtre demandée: ${t}` }
    : r;
}


