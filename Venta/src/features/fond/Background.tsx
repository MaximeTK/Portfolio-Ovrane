'use client';

import { useEffect, useState } from 'react';
import { useBackgroundStore } from './backgroundStore';

export function Background({ children }: { children: React.ReactNode }) {
  const currentPalette = useBackgroundStore((state) => state.currentPalette);

  // Fondu croisé : la nouvelle palette apparaît par-dessus l'active, puis la remplace
  const [activePalette, setActivePalette] = useState(currentPalette);
  const [nextPalette, setNextPalette] = useState<typeof currentPalette | null>(null);

  useEffect(() => {
    if (currentPalette.id === activePalette.id) return;
    setNextPalette(currentPalette);
    const timer = setTimeout(() => {
      setActivePalette(currentPalette);
      setNextPalette(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, [currentPalette, activePalette.id]);

  return (
    <>
      <div className="fixed inset-0 min-h-screen pointer-events-none z-0">
        <div
          className="absolute inset-0 transition-colors duration-[2500ms]"
          style={{ background: `linear-gradient(180deg, ${activePalette.topColor} 0%, ${activePalette.bottomColor} 100%)` }}
        />
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

      <div className="relative z-10">{children}</div>
    </>
  );
}
