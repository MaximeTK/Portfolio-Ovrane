/**
 * Composant pour gérer le highlight visuel des sections
 */
'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/lib/state/uiStore';

export function SectionHighlight() {
  const highlightedId = useUIStore((state) => state.highlightedId);
  
  useEffect(() => {
    if (!highlightedId) return;
    
    const element = document.getElementById(highlightedId);
    
    if (!element) {
      console.warn(`Élément avec id "${highlightedId}" introuvable`);
      return;
    }
    
    // Ajouter la classe de highlight
    element.classList.add('section-highlighted');
    element.setAttribute('data-highlighted', 'true');
    
    // Annoncer pour les lecteurs d'écran
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `Section ${highlightedId} mise en évidence`;
    document.body.appendChild(announcement);
    
    // Retirer la classe et l'annonce au démontage
    return () => {
      element.classList.remove('section-highlighted');
      element.removeAttribute('data-highlighted');
      announcement.remove();
    };
  }, [highlightedId]);
  
  return null; // Ce composant ne rend rien visuellement
}
