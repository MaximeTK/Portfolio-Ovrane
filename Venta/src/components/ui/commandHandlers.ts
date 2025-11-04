/**
 * Handlers pour les commandes - max 5 fonctions, max 20 lignes
 */
import { useBackgroundStore } from '@/lib/state/backgroundStore';

interface WindowData {
  id: string;
  type: string;
  content: any;
  title: string;
  x: number;
  y: number;
}

/**
 * Crée une fenêtre pour afficher une image
 */
export function createImageWindow(imageName: string, index: number): WindowData {
  const uniqueId = `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`;
  
  return {
    id: uniqueId,
    type: 'image',
    content: {
      src: `/assets/${imageName}`,
      alt: `Image ${imageName}`,
      onError: () => {
        console.error(`❌ Image non trouvée: ${imageName}`);
      }
    },
    title: `Image: ${imageName}`,
    x: 100 + (index * 50),
    y: 100 + (index * 50)
  };
}

/**
 * Crée une fenêtre pour afficher du code
 */
export function createCodeWindow(language: string, index: number): WindowData {
  const uniqueId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`;
  
  return {
    id: uniqueId,
    type: 'code',
    content: {
      language: language,
      code: `// Exemple de code ${language}\n//console.log("Hello from ${language}!");`
    },
    title: `Code: ${language}`,
    x: 200 + (index * 50),
    y: 150 + (index * 50)
  };
}

/**
 * Crée une fenêtre générique
 */
export function createGenericWindow(title: string, index: number): WindowData {
  const uniqueId = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`;
  
  return {
    id: uniqueId,
    type: 'generic',
    content: {
      text: `Fenêtre: ${title}`,
      timestamp: new Date().toLocaleTimeString()
    },
    title: title,
    x: 300 + (index * 50),
    y: 200 + (index * 50)
  };
}

/**
 * Traite une commande et retourne la fenêtre associée ou null si c'est une action
 */
export function processCommand(command: string, parameter: string, index: number, userId?: string | null): WindowData | null {
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

