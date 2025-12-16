'use client';

import { useEffect, useState } from 'react';
import { useBackgroundStore } from '@/lib/state/backgroundStore';

export function Background({ children }: { children: React.ReactNode }) {
  const currentPalette = useBackgroundStore((state) => state.currentPalette);
  
  // Système de fondu croisé pour transitions douces entre dégradés
  const [activePalette, setActivePalette] = useState(currentPalette);
  const [nextPalette, setNextPalette] = useState<typeof currentPalette | null>(null);
  
  useEffect(() => {
    // Si la palette change et qu'elle est différente de celle active
    if (currentPalette.id !== activePalette.id) {
      console.log(`🎨 [BackgroundProvider] Transition de ${activePalette.name} vers ${currentPalette.name}`);
      
      // On définit la prochaine palette (ce qui va déclencher l'apparition de la couche supérieure)
      setNextPalette(currentPalette);
      
      // Après la transition (2.5s), on met à jour la palette active et on retire la "prochaine"
      // pour préparer le prochain changement
      const timer = setTimeout(() => {
        setActivePalette(currentPalette);
        setNextPalette(null);
        console.log(`🎨 [BackgroundProvider] Transition terminée, palette active: ${currentPalette.name}`);
      }, 2500);
      
      return () => clearTimeout(timer);
    }
  }, [currentPalette, activePalette.id, activePalette.name]);

  return (
    <>
      {/* Système de double couche pour transition douce entre dégradés */}
      <div className="fixed inset-0 min-h-screen pointer-events-none z-0">
        {/* Couche de BASE (Palette Active) - Toujours visible */}
        <div 
          className="absolute inset-0 transition-colors duration-[2500ms]"
          style={{
            background: `linear-gradient(180deg, ${activePalette.topColor} 0%, ${activePalette.bottomColor} 100%)`
          }}
        />
        
        {/* Couche de TRANSITION (Nouvelle Palette) - Apparaît en fondu par dessus */}
        <div 
          className="absolute inset-0 transition-opacity duration-[2500ms] ease-in-out"
          style={{
            background: nextPalette 
              ? `linear-gradient(180deg, ${nextPalette.topColor} 0%, ${nextPalette.bottomColor} 100%)`
              : 'transparent',
            opacity: nextPalette ? 1 : 0,
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
