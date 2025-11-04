/**
 * Overlay pour afficher des images en plein écran
 */
'use client';

import { useEffect, useRef } from 'react';
import { useUIStore } from '@/lib/state/uiStore';

export function ImageOverlay() {
  const { imageOverlay, hideImage } = useUIStore();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Gérer la fermeture avec ESC
  useEffect(() => {
    if (!imageOverlay.visible) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideImage();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    
    // Focus sur le bouton de fermeture à l'ouverture
    closeButtonRef.current?.focus();
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [imageOverlay.visible, hideImage]);
  
  // Bloquer le scroll du body quand l'overlay est ouvert
  useEffect(() => {
    if (imageOverlay.visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [imageOverlay.visible]);
  
  if (!imageOverlay.visible || !imageOverlay.assetId) {
    return null;
  }
  
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      hideImage();
    }
  };
  
  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu de l'image"
    >
      <div className="relative max-w-[90vw] max-h-[90vh] bg-white/5 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Bouton de fermeture */}
        <button
          ref={closeButtonRef}
          onClick={hideImage}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full border border-white/20 text-white text-xl cursor-pointer transition-colors z-10"
          aria-label="Fermer l'image"
        >
          ×
        </button>
        
        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/assets/${imageOverlay.assetId}.png`}
          alt={imageOverlay.alt || 'Image'}
          className="max-w-full max-h-[90vh] object-contain"
          onError={(e) => {
            // Fallback en cas d'erreur de chargement
            const target = e.target as HTMLImageElement;
            target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23333" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999" font-size="16"%3EImage non disponible%3C/text%3E%3C/svg%3E';
          }}
        />
      </div>
    </div>
  );
}
