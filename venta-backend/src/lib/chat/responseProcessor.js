/**
 * Traitement des réponses générées
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractCommands } from '../serverHelpers.js';
import { addConversation, saveUserPreference } from '../userMemory.js';
import { getRequestContext, CreateUserProfile } from '../ragHelpers.js';
import { CONSOLE_LOGS, EMOJIS, MISC_MESSAGES } from '../messages.js';
import { normalizeAssetParamToFilename } from '../validators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function stripDiacritics(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeTokens(value) {
  return stripDiacritics(String(value ?? '').toLowerCase())
    .replace(/[^a-z0-9_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function isPaletteIdLine(line) {
  const invalidStarts = ['LISTE', '⚠️', 'RÈGLES', 'EXEMPLES', 'Si l', '-', 'PALETTES'];
  return (
    line &&
    !line.includes(':') &&
    !invalidStarts.some((s) => line.startsWith(s)) &&
    line.length < 20
  );
}

let cachedPaletteIds = null;
function getKnownPaletteIds() {
  if (cachedPaletteIds) return cachedPaletteIds;
  try {
    const colorsPath = path.join(__dirname, '..', '..', '..', 'rag', 'colors.txt');
    if (!fs.existsSync(colorsPath)) {
      cachedPaletteIds = [];
      return cachedPaletteIds;
    }
    const content = fs.readFileSync(colorsPath, 'utf8');
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const ids = lines.filter(isPaletteIdLine);
    cachedPaletteIds = ids;
    return cachedPaletteIds;
  } catch {
    cachedPaletteIds = [];
    return cachedPaletteIds;
  }
}

function extractPaletteIdFromText(text) {
  const ids = getKnownPaletteIds();
  if (!ids.length) return null;

  const tokens = normalizeTokens(text);
  if (!tokens.length) return null;

  // Préparer les candidats (tokens) et privilégier les IDs multi-mots (ex: gris_ciel)
  const candidates = ids
    .map((id) => {
      const parts = normalizeTokens(String(id).replace(/_/g, ' '));
      return { id, parts };
    })
    .filter((c) => c.parts.length > 0)
    .sort((a, b) => b.parts.length - a.parts.length);

  for (const cand of candidates) {
    const { parts } = cand;
    for (let i = 0; i <= tokens.length - parts.length; i += 1) {
      let ok = true;
      for (let j = 0; j < parts.length; j += 1) {
        if (tokens[i + j] !== parts[j]) {
          ok = false;
          break;
        }
      }
      if (ok) return cand.id;
    }
  }
  return null;
}

function isBackgroundIntent(text) {
  const t = stripDiacritics(String(text ?? '').toLowerCase());
  return (
    t.includes('/setbackground') ||
    t.includes('background') ||
    t.includes('arriere-plan') ||
    t.includes('arrière-plan') ||
    t.includes('fond') ||
    t.includes('theme') ||
    t.includes('thème')
  );
}

function getLastBackgroundCommand(commands) {
  if (!Array.isArray(commands)) return null;
  for (let i = commands.length - 1; i >= 0; i -= 1) {
    const c = commands[i];
    if (String(c?.command || '').toLowerCase() === 'setbackground') {
      const param = String(c?.parameter || '').trim();
      if (param) return param;
    }
  }
  return null;
}

/**
 * Applique les commandes backend (CreateUserProfile, ...)
 */
async function handleBackendCommands(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return;
  }

  for (const command of commands) {
    if (!command || !command.command) {
      continue;
    }

    if (command.command !== 'CreateUserProfile') {
      continue;
    }

    let payload = {};
    if (command.parameter) {
      try {
        payload = typeof command.parameter === 'string'
          ? JSON.parse(command.parameter)
          : command.parameter;
      } catch (error) {
        payload = { name: String(command.parameter).trim() };
      }
    }

    const name = payload?.name ? String(payload.name).trim() : null;
    if (!name) {
      console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.backend} Commande CreateUserProfile ignorée: nom manquant`);
      continue;
    }

    const currentContext = getRequestContext();
    const currentProfile = currentContext?.userProfile;

    const alreadyMatches = currentProfile?.name
      ? currentProfile.name.toLowerCase().trim() === name.toLowerCase()
      : false;

    if (alreadyMatches && !currentProfile?.isTemporary) {
      continue;
    }

    const reason = payload?.reason || 'création automatique après commande IA';

    try {
      await CreateUserProfile({ name, reason });
    } catch (error) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} Erreur lors de la création automatique du profil:`, error.message);
    }
  }
}

async function handlePendingUserCreationFallback() {
  const context = getRequestContext();
  const pending = context?.pendingUserCreation;

  if (!pending || !pending.name) {
    return;
  }

  const name = String(pending.name).trim();
  if (!name) {
    context.pendingUserCreation = null;
    return;
  }

  const currentProfile = context.userProfile;
  const alreadyMatches = currentProfile?.name
    ? currentProfile.name.toLowerCase().trim() === name.toLowerCase()
    : false;

  if (alreadyMatches && !currentProfile?.isTemporary) {
    context.pendingUserCreation = null;
    return;
  }

  const reason = pending.reason || 'création automatique (fallback)';

  try {
    await CreateUserProfile({ name, reason });
  } catch (error) {
    console.error(`${EMOJIS.error} ${CONSOLE_LOGS.backend} Erreur fallback création profil:`, error.message);
  } finally {
    if (context) {
      context.pendingUserCreation = null;
    }
  }
}

/**
 * Traite la réponse générée et génère le TTS en parallèle
 */
export async function processResponse(response, userId, userProfile, prompt, isEphemeral = false) {
  const { rawResponse, ragCoverage, ragSources } = response;
  let { commands, cleanResponse } = extractCommands(rawResponse);

  // Nettoyage proactif des images Markdown si une commande ShowPicture est présente
  // Cela évite le double affichage (TextWindow + ImageWindow) dans le Dashboard
  if (commands && commands.length > 0) {
    const imageCommands = commands.filter(c => c.command.toLowerCase() === 'showpicture' || c.command.toLowerCase() === 'showimage');
    
    imageCommands.forEach(cmd => {
      const filename = normalizeAssetParamToFilename(cmd?.parameter);
      if (!filename) return;

      const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const encodedFilename = encodeURIComponent(filename);
      
      // Regex pour trouver ![alt](...filename...) et le supprimer
      // On cherche les variantes avec /assets/ ou sans
      // et avec encodage %20 ou espaces
      const pathVariants = `(${escapedFilename}|${encodedFilename})`;
      const markdownImageRegex = new RegExp(`!\\[[^\\]]*\\]\\([^)]*${pathVariants}[^)]*\\)`, 'gi');
      
      cleanResponse = cleanResponse.replace(markdownImageRegex, '');
    });
  }

  // Sauvegarde de l'état avant les commandes
  const wasTemporary = userProfile.isTemporary;
  const previousUserId = userId;

  await handleBackendCommands(commands);
  await handlePendingUserCreationFallback();
  
  let finalReply = cleanResponse;
  if ((!finalReply || finalReply.trim() === '') && commands.length > 0) {
    finalReply = MISC_MESSAGES.defaultResponse;
  }

  // Fallback robustesse: si l'utilisateur demande un changement de fond, mais que l'IA a oublié la commande,
  // on injecte automatiquement /SetBackground <id> quand l'ID est identifiable.
  const hasBackgroundCommand = Array.isArray(commands)
    && commands.some((c) => String(c?.command || '').toLowerCase() === 'setbackground');
  if (!hasBackgroundCommand && isBackgroundIntent(prompt)) {
    const paletteId = extractPaletteIdFromText(prompt) || extractPaletteIdFromText(finalReply);
    if (paletteId) {
      commands = Array.isArray(commands) ? commands : [];
      commands.push({ command: 'SetBackground', parameter: paletteId });
      console.log(`${EMOJIS.info} ${CONSOLE_LOGS.backend} Injection commande SetBackground: ${paletteId}`);
    }
  }
  
  // Vérification post-commandes
  const updatedContext = getRequestContext();
  let hasSwitchedUser = false;
  
  if (updatedContext && updatedContext.userProfile) {
    userId = updatedContext.userId;
    userProfile = updatedContext.userProfile;
    
    if (userProfile.name) {
      console.log(`${EMOJIS.success} ${CONSOLE_LOGS.backend} Profil actif: ${userProfile.name}`);
    }
    
    // Détection du switch : Si on était temporaire et qu'on ne l'est plus
    // OU si l'ID a changé
    if ((wasTemporary && !userProfile.isTemporary) || (previousUserId !== userId)) {
      hasSwitchedUser = true;
    }
  }
  
  // LOGIQUE DE REMPLACEMENT DU MESSAGE (TTS + TEXTE)
  // Si on a changé d'utilisateur, on force un message de bienvenue standardisé
  // pour que le TTS corresponde exactement à l'affichage frontend (IntroSequence.tsx)
  if (hasSwitchedUser && userProfile.name) {
    if (userProfile.visitCount > 1) {
      console.log(`✨ [AUTO-REPLY] Utilisateur récurrent détecté (${userProfile.name}), remplacement de la réponse.`);
      finalReply = MISC_MESSAGES.welcomeBack(userProfile.name);
    } else {
      console.log(`✨ [AUTO-REPLY] Nouvel utilisateur détecté (${userProfile.name}), remplacement de la réponse.`);
      finalReply = MISC_MESSAGES.welcomeNew(userProfile.name);
    }
  }
  
  // Persister le fond côté backend pour que l'IA ait un état fiable au prochain prompt (FOND ACTUEL)
  // (en complément de la sauvegarde côté frontend).
  const bgId = getLastBackgroundCommand(commands);
  if (bgId) {
    try {
      await saveUserPreference(userId, 'backgroundColor', bgId);
    } catch (error) {
      console.warn(`${EMOJIS.warning} ${CONSOLE_LOGS.backend} Impossible de sauvegarder backgroundColor:`, error?.message || error);
    }
  }
  
  if (!isEphemeral) {
    const safeCommands = Array.isArray(commands)
      ? commands
          .filter((c) => c && c.command)
          .map((c) => {
            const cmd = String(c.command || '').trim();
            const param = String(c.parameter || '').trim();
            const raw = param ? `/${cmd} ${param}` : `/${cmd}`;
            return { command: cmd, parameter: param, raw };
          })
      : [];

    const commandsFull = safeCommands.map((c) => c.raw).filter(Boolean);

    addConversation(userId, prompt, finalReply, {
      commands: safeCommands,
      commandsFull,
    });
  }
  
  return {
    reply: finalReply,
    commands: commands,
    rawResponse: rawResponse,
    userProfile: {
      name: userProfile.name,
      visitCount: userProfile.visitCount,
      isNewUser: userProfile.visitCount === 1,
      isTemporary: userProfile.isTemporary
    },
    activeUserId: userId,
    rag: { coverage: ragCoverage, sources: ragSources, enabled: true },
  };
}
