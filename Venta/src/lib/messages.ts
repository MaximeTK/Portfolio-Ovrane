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
      const who = e ? `You're from ${e}, I presume${p ? `, here about the ${p} position` : ''}.` : `You're here about the ${p} position, I presume.`;
      return `Oh, welcome! ${who} I'm Ovrane, and I'll be guiding you through this portfolio.`;
    }
    const qui = e ? `Vous êtes de chez ${e}, je présume${p ? `, pour le poste « ${p} »` : ''}.` : `Vous venez pour le poste « ${p} », je présume.`;
    return `Oh, bienvenue ! ${qui} Je suis Ovrane, et je suis chargée de vous accompagner sur ce portfolio.`;
  },
} as const;
