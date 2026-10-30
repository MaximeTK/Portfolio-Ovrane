/**
 * Textes de l'interface, au même endroit pour les relire et les corriger d'un coup d'œil.
 */
/** Seul message d'erreur montré au visiteur quand le backend ou le relai échoue. */
export const INDISPONIBLE = 'Ovrane ne répond pas pour le moment. Réessayez dans un instant.';

export const CHAT_UI = {
  youLabel: 'Vous',
  // Chaque réponse se signe comme une IA : le visiteur le sait dès le premier message (AI Act, art. 50)
  assistantLabel: 'Ovrane · IA',
  noMessagesYet: 'Aucun message pour le moment…',
  viewingOldMessages: "Vous consultez d'anciens messages",
  backToLatest: 'Revenir aux messages les plus récents',
  today: "Aujourd'hui",
  yesterday: 'Hier',
  applyRequestFallback: "D'accord, j'applique votre demande.",
  thinking: 'Ovrane réfléchit…',
  messagingHint: "Cliquez sur l'œil au centre pour ouvrir la messagerie",
  retry: 'Réessayer',
} as const;
