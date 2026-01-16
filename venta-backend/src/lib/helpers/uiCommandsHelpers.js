/**
 * Tools UI: convertit des intentions d'actions (image, fond, fenêtres) en commandes frontend.
 * IMPORTANT: Ces outils ne doivent pas modifier le texte de réponse, ils ajoutent uniquement des commandes
 * dans le contexte de requête afin que le frontend exécute l'action.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRequestContext } from './contextHelpers.js';
import { isValidAssetFilename, normalizeAssetParamToFilename } from '../validators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_TXT_PATH = path.join(__dirname, '..', '..', '..', 'rag', 'assets.txt');

let cachedKnownAssets = null;
function getKnownAssetFilenames() {
  if (cachedKnownAssets) return cachedKnownAssets;
  try {
    if (!fs.existsSync(ASSETS_TXT_PATH)) {
      cachedKnownAssets = new Set();
      return cachedKnownAssets;
    }
    const content = fs.readFileSync(ASSETS_TXT_PATH, 'utf8');
    const lines = content.split(/\r?\n/);
    const set = new Set();
    for (const line of lines) {
      const trimmed = String(line || '').trim();
      // On ne prend que les noms de fichiers image valides (pas de PDF, pas de chemins, etc.)
      if (isValidAssetFilename(trimmed)) set.add(trimmed);
    }
    cachedKnownAssets = set;
    return cachedKnownAssets;
  } catch {
    cachedKnownAssets = new Set();
    return cachedKnownAssets;
  }
}

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

export async function uiShowPicture({ filename, filenames }) {
  // Support multi-images: { filenames: [...] } (préféré) + compat { filename: "..." }
  const requested = Array.isArray(filenames) && filenames.length > 0
    ? filenames
    : (typeof filename === 'string' && filename.trim() ? [filename] : []);

  if (requested.length === 0) {
    return {
      success: false,
      message:
        'Paramètres invalides. Utilise uiShowPicture({ filenames: ["A.png", "B.png"] }) ' +
        'ou (compat) uiShowPicture({ filename: "A.png" }).',
    };
  }

  const known = getKnownAssetFilenames();
  let pushed = 0;
  const normalizedList = [];

  for (const raw of requested) {
    const normalized = normalizeAssetParamToFilename(raw);
    if (!normalized || !isValidAssetFilename(normalized)) {
      return {
        success: false,
        message:
          `filename invalide: "${String(raw)}" (doit être un nom exact de fichier image existant, ex: "CV.png"). ` +
          'N’utilise jamais de PDF. Si tu n’es pas sûr, appelle getAvailableAssets().',
      };
    }

    // Si on a une liste d'assets, on force l'appartenance (anti-hallucination)
    if (known.size > 0 && !known.has(normalized)) {
      return {
        success: false,
        message:
          `Asset inconnu: "${normalized}". ` +
          `Ne l'invente pas. Appelle getAvailableAssets() et utilise un filename EXACT de la liste.`,
      };
    }

    normalizedList.push(normalized);
  }

  // Éviter doublons (ex: même image demandée deux fois)
  const deduped = Array.from(new Set(normalizedList));
  for (const normalized of deduped) {
    const r = pushUiCommand('ShowPicture', normalized);
    if (!r.success) return r;
    pushed += 1;
  }

  return {
    success: true,
    message: pushed === 1
      ? `Image demandée: ${deduped[0]}`
      : `Images demandées (${pushed}): ${deduped.join(', ')}`
  };
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


