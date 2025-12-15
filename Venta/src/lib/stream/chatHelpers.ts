/**
 * Helpers pour le chat - max 5 fonctions, max 20 lignes
 */
import { Message } from '../chat/types';

/**
 * Crée un message
 */
export function createMessage(role: 'user' | 'assistant', content: string, timestamp?: number): Message {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    content,
    timestamp: timestamp || Date.now(),
  };
}

/**
 * Parse la réponse JSON
 */
export async function parseResponse(response: Response) {
  if (!response.ok) {
    let errorMessage = `Erreur API: ${response.status}`;
    
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
          errorMessage = `Le serveur n'est pas accessible (erreur ${response.status}). Vérifiez que le backend est démarré sur le port 3001.`;
        } else {
          errorMessage = text.substring(0, 200); // Limiter la longueur
        }
      }
    } catch (parseErr) {
      console.error('❌ [FRONTEND] Impossible de parser la réponse:', parseErr);
      if (response.status === 503) {
        errorMessage = 'Le backend n\'est pas accessible. Vérifiez qu\'il est démarré sur le port 3001.';
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
      `Réponse invalide (${response.status}).`
        + ' Le backend retourne du HTML: '
        + snippet,
    );
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  if (!data.reply && data.reply !== '') {
    throw new Error('Réponse du serveur invalide: pas de reply');
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
  if (activeUserId && activeUserId !== currentUserId) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('venta_userId', activeUserId);
    }
    return activeUserId;
  } else if (activeUserId && !currentUserId) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('venta_userId', activeUserId);
    }
    return activeUserId;
  }
  return currentUserId;
}

