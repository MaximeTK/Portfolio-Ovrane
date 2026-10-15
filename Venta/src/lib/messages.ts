/**
 * Textes de l'interface, au même endroit pour les relire et les corriger d'un coup d'œil.
 */
import type { IllusionAccueil } from '@/features/chat/types';

/** Seul message d'erreur montré au visiteur quand le backend ou le relai échoue. */
export const INDISPONIBLE = 'Ovrane ne répond pas pour le moment. Réessayez dans un instant.';

export const CHAT_UI = {
  youLabel: 'Vous',
  assistantLabel: 'Ovrane',
  noMessagesYet: 'Aucun message pour le moment…',
  viewingOldMessages: "Vous consultez d'anciens messages",
  backToLatest: 'Revenir aux messages les plus récents',
  today: "Aujourd'hui",
  yesterday: 'Hier',
  applyRequestFallback: "D'accord, j'applique votre demande.",
  thinking: 'Ovrane réfléchit…',
  messagingHint: "Cliquez sur l'œil au centre pour ouvrir la messagerie",
  retry: 'Réessayer',
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
