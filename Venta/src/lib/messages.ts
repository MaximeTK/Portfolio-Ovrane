/**
 * Centralisation des textes (UI + erreurs) côté frontend
 * Objectif: faciliter la maintenance et éviter les chaînes dispersées.
 */

export const CHAT_UI = {
  youLabel: 'Vous',
  assistantLabel: 'Ovrane',
  noMessagesYet: 'Aucun message pour le moment...',
  viewingOldMessages: "Tu consultes d'anciens messages",
  backToLatest: 'Revenir aux messages les plus récents',
  today: "Aujourd'hui",
  yesterday: 'Hier',
  applyRequestFallback: "D'accord, j'applique ta demande.",
} as const;

export const FRONTEND_ERRORS = {
  unknown: 'Erreur inconnue',
  apiError: (status: number) => `Erreur API: ${status}`,
  backendNotAccessible:
    "Le backend n'est pas accessible. Vérifiez qu'il est démarré sur le port 3001.",
  invalidReplyMissing: 'Réponse du serveur invalide: pas de reply',
  invalidResponseHtml: (status: number, snippet: string) =>
    `Réponse invalide (${status}). Le backend retourne du HTML: ${snippet}`,
} as const;

export const API_ERRORS = {
  badRequest: 'Requête invalide',
  promptRequired: 'Prompt requis',
  backendUnreachable: 'Impossible de contacter le backend',
  internalServerError: 'Erreur interne du serveur',
  userIdRequired: 'userId requis',
} as const;


