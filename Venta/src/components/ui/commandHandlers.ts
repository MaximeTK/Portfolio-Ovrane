/**
 * Handlers pour les commandes - max 5 fonctions, max 20 lignes
 */
import { useBackgroundStore } from '@/lib/state/backgroundStore';
import type { WindowData } from './commandTypes';

const OFFSET = 50;
const BASE_IMAGE_SIZE = 512;

function buildId(prefix: string, index: number) {
  const random = Math.random().toString(36).slice(2, 11);
  return `${prefix}-${Date.now()}-${random}-${index}`;
}

/**
 * Crée une fenêtre pour afficher une image
 */
export function createImageWindow(
  imageName: string,
  index: number,
): WindowData {
  const id = buildId('image', index);
  return {
    id,
    type: 'image',
    content: {
      src: `/assets/${imageName}`,
      alt: `Image ${imageName}`,
      width: BASE_IMAGE_SIZE,
      height: BASE_IMAGE_SIZE,
      onError: () => {
        console.error(`❌ Image introuvable: ${imageName}`);
      },
    },
    title: `Image: ${imageName}`,
    x: 100 + index * OFFSET,
    y: 100 + index * OFFSET,
  };
}

/**
 * Crée une fenêtre pour afficher du code
 */
export function createCodeWindow(
  language: string,
  index: number,
): WindowData {
  const id = buildId('code', index);
  const code = [
    `// Exemple de code ${language}`,
    `console.log('Hello from ${language}!');`,
  ].join('\n');
  return {
    id,
    type: 'code',
    content: { language, code },
    title: `Code: ${language}`,
    x: 200 + index * OFFSET,
    y: 150 + index * OFFSET,
  };
}

/**
 * Crée une fenêtre générique
 */
export function createGenericWindow(
  title: string,
  index: number,
): WindowData {
  const id = buildId('window', index);
  return {
    id,
    type: 'generic',
    content: {
      text: `Fenêtre: ${title}`,
      timestamp: new Date().toLocaleTimeString(),
    },
    title,
    x: 300 + index * OFFSET,
    y: 200 + index * OFFSET,
  };
}

/**
 * Traite une commande et retourne la fenêtre associée ou null si c'est une action
 */
export function processCommand(
  command: string,
  parameter: string,
  index: number,
  userId?: string | null,
): WindowData | null {
  switch (command.toLowerCase()) {
    case 'showpicture':
      return createImageWindow(parameter, index);
    case 'showcode':
      return createCodeWindow(parameter, index);
    case 'openwindow':
      return createGenericWindow(parameter, index);
    case 'setbackground':
      // Commande spéciale : change le background sans créer de fenêtre
      // Passer l'userId pour s'assurer que la préférence est sauvegardée avec le bon profil
      useBackgroundStore.getState().setBackground(parameter, true, userId || undefined);
      console.log(`🎨 Background changé vers: ${parameter}${userId ? ` pour l'utilisateur ${userId}` : ''}`);
      return null;
    default:
      console.warn(`Commande inconnue: ${command}`);
      return null;
  }
}

