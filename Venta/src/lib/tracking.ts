/**
 * Gestion du tracking des liens d'arrivée
 */

/**
 * Envoie le lien au serveur
 */
export async function sendTrackingLink(userId: string, link: string) {
  try {
    console.log(`🚀 [TRACKING LIB] Envoi de ${link} pour ${userId}...`);
    const response = await fetch('/api/tracking/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, link })
    });
    
    const data = await response.json();
    console.log(`✅ [TRACKING LIB] Réponse serveur:`, data);
    return true;
  } catch (error) {
    console.error('❌ [TRACKING LIB] Erreur envoi tracking:', error);
    return false;
  }
}
