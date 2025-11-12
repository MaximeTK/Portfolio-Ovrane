/**
 * Traitement des réponses générées
 */
import { extractCommands } from '../serverHelpers.js';
import { addConversation } from '../userMemory.js';
import { getRequestContext, CreateUserProfile } from '../ragHelpers.js';
import { CONSOLE_LOGS, EMOJIS, MISC_MESSAGES } from '../messages.js';
import { generateTTS } from '../tts/ttsGenerator.js';

/**
 * Convertit un ArrayBuffer en base64
 */
function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
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
export async function processResponse(response, userId, userProfile, prompt) {
  const { rawResponse, ragCoverage, ragSources } = response;
  const { commands, cleanResponse } = extractCommands(rawResponse);

  await handleBackendCommands(commands);
  await handlePendingUserCreationFallback();
  
  let finalReply = cleanResponse;
  if ((!finalReply || finalReply.trim() === '') && commands.length > 0) {
    finalReply = MISC_MESSAGES.defaultResponse;
  }
  
  const updatedContext = getRequestContext();
  if (updatedContext && updatedContext.userProfile) {
    userId = updatedContext.userId;
    userProfile = updatedContext.userProfile;
    if (userProfile.name) {
      console.log(`${EMOJIS.success} ${CONSOLE_LOGS.backend} Profil mis à jour par l'IA: ${userProfile.name}`);
    }
  }
  
  addConversation(userId, prompt, finalReply, { commands });
  
  // Générer le TTS en parallèle (ne bloque pas la réponse)
  let ttsData = null;
  if (finalReply && finalReply.trim() !== '') {
    try {
      const ttsResult = await generateTTS(finalReply);
      if (ttsResult && !ttsResult.useClientTTS && ttsResult.buffer) {
        const mimeType = ttsResult.mimeType || 'audio/mpeg';
        // Convertir l'audio en base64 pour l'inclure dans la réponse JSON
        ttsData = {
          audio: arrayBufferToBase64(ttsResult.buffer),
          provider: ttsResult.provider || 'unknown',
          format: mimeType
        };
      } else {
        // Fallback côté client
        ttsData = { useClientTTS: true };
      }
    } catch (error) {
      console.error(`${EMOJIS.error} ${CONSOLE_LOGS.tts} Erreur génération TTS:`, error.message);
      ttsData = { useClientTTS: true };
    }
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
    tts: ttsData
  };
}

