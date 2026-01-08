/**
 * Helpers pour le chat - max 5 fonctions, max 20 lignes
 */
import { Message, Command } from '../chat/types';
import { FRONTEND_ERRORS } from '../messages';
import { isValidUserId, setStoredUserId } from '../userId';

/**
 * Crée un message
 */
export function createMessage(role: 'user' | 'assistant', content: string, timestamp?: number, commands?: Command[]): Message {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    content,
    timestamp: timestamp || Date.now(),
    commands,
  };
}

/**
 * Parse la réponse JSON
 */
export async function parseResponse(response: Response) {
  if (!response.ok) {
    let errorMessage = FRONTEND_ERRORS.apiError(response.status);
    
    // Vérifier le Content-Type avant de parser
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    
    try {
      if (isJson) {
        const errorData = await response.json();
        if (errorData.details) {
          errorMessage = `${errorData.error || errorMessage}\n${errorData.details}`;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } else {
        // Si ce n'est pas du JSON, lire le texte (probablement HTML)
        const text = await response.text();
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          errorMessage = FRONTEND_ERRORS.backendNotAccessible;
        } else {
          errorMessage = text.substring(0, 200); // Limiter la longueur
        }
      }
    } catch (parseErr) {
      console.error('❌ [FRONTEND] Impossible de parser la réponse:', parseErr);
      if (response.status === 503) {
        errorMessage = FRONTEND_ERRORS.backendNotAccessible;
      }
    }
    throw new Error(errorMessage);
  }

  // Vérifier que la réponse est bien du JSON
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const clonedResponse = response.clone();
    const snippet = (await clonedResponse.text()).slice(0, 200);
    throw new Error(
      FRONTEND_ERRORS.invalidResponseHtml(response.status, snippet),
    );
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  if (!data.reply && data.reply !== '') {
    throw new Error(FRONTEND_ERRORS.invalidReplyMissing);
  }
  if (data.reply === '') {
    console.warn('⚠️ [FRONTEND] Reply est une chaîne vide');
  }
  
  return data;
}

/**
 * Met à jour l'userId dans localStorage
 */
export function updateStoredUserId(activeUserId: string, currentUserId: string | null) {
  if (!isValidUserId(activeUserId)) {
    return currentUserId;
  }

  const shouldUpdate = (activeUserId && activeUserId !== currentUserId) || (activeUserId && !currentUserId);

  if (shouldUpdate) {
    console.log(`🔄 [CHAT HELPERS] Update userId: ${currentUserId} -> ${activeUserId}`);
    if (typeof window !== 'undefined') {
      setStoredUserId(activeUserId);
    }
    return activeUserId;
  }
  return currentUserId;
}

