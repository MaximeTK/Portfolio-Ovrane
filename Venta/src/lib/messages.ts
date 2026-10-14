/**
 * Centralisation des textes (UI + erreurs) côté frontend
 * Objectif: faciliter la maintenance et éviter les chaînes dispersées.
 */
import type { IllusionAccueil } from './chat/types';

export const CHAT_UI = {
  youLabel: 'Vous',
  assistantLabel: 'Ovrane',
  noMessagesYet: 'Aucun message pour le moment...',
  viewingOldMessages: "Tu consultes d'anciens messages",
  backToLatest: 'Revenir aux messages les plus récents',
  today: "Aujourd'hui",
  yesterday: 'Hier',
  applyRequestFallback: "D'accord, j'applique ta demande.",
  // Accueil du recruteur venu par un lien d'Illusion ; vide si ni poste ni entreprise
  recruiterWelcome: ({ entreprise, poste, langue }: IllusionAccueil) => {
    const e = String(entreprise ?? '').trim();
    const p = String(poste ?? '').trim();
    if (!e && !p) return '';
    if (langue === 'en') {
      return `Welcome! You are viewing Maxime's application${p ? ` for the ${p} position` : ''}${e ? ` at ${e}` : ''}. I can walk you through his background and projects: how can I help you?`;
    }
    return `Bienvenue ! Vous découvrez la candidature de Maxime${p ? ` au poste « ${p} »` : ''}${e ? ` chez ${e}` : ''}. Je vous présente son parcours et ses projets : en quoi puis-je vous aider ?`;
  },
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
  jetonMissing: 'Aucun jeton de candidature',
} as const;


