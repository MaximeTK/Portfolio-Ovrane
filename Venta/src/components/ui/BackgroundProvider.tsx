'use client';

import { useEffect, useState } from 'react';
import { useBackgroundStore } from '@/lib/state/backgroundStore';

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const currentPalette = useBackgroundStore((state) => state.currentPalette);
  
  // Système de fondu croisé pour transitions douces entre dégradés
  const [previousPalette, setPreviousPalette] = useState(currentPalette);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  
  useEffect(() => {
    if (currentPalette.id !== previousPalette.id) {
      // Au premier chargement, pas de transition
      if (isFirstLoad) {
        setPreviousPalette(currentPalette);
        setIsFirstLoad(false);
        return;
      }
      
      // Pour les changements suivants, faire une transition douce
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setPreviousPalette(currentPalette);
        setIsTransitioning(false);
      }, 2500); // Durée de la transition
      return () => clearTimeout(timer);
    }
  }, [currentPalette, previousPalette.id, isFirstLoad]);

  return (
    <>
      {/* Système de double couche pour transition douce entre dégradés */}
      <div className="fixed inset-0 min-h-screen">
        {/* Couche de fond (ancienne palette) */}
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${previousPalette.topColor} 0%, ${previousPalette.bottomColor} 100%)`
          }}
        />
        
        {/* Couche de dessus (nouvelle palette) avec transition d'opacité */}
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${currentPalette.topColor} 0%, ${currentPalette.bottomColor} 100%)`,
            opacity: isTransitioning ? 1 : 0,
            transition: 'opacity 2.5s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      </div>
      
      {/* Contenu par-dessus les couches de fond */}
      <div className="relative z-10">
        {children}
      </div>
    </>
  );
}

