'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useUIStore } from '@/lib/uiStore';
import { useBackgroundStore, urlPhoto } from './backgroundStore';
import { baseDe, lancerFond } from './fondVivant';

const FONDU = '2500ms cubic-bezier(0.4, 0, 0.2, 1)';

export function Background({ children }: { children: React.ReactNode }) {
  const currentPalette = useBackgroundStore((state) => state.currentPalette);
  const fond = useBackgroundStore((state) => state.fond);
  const toileRef = useRef<HTMLCanvasElement>(null);
  const photo = fond.startsWith('photo:') ? fond.slice(6) : null;
  // Photos posées : la nouvelle se fond sur l'ancienne, retirée ensuite
  const [posees, setPosees] = useState<string[]>(photo ? [photo] : []);
  if (photo && posees.at(-1) !== photo) setPosees([...posees.filter((p) => p !== photo), photo]);

  const vivant = fond === 'organique' || fond === 'bokeh';
  // Fond vivant : suit la palette, dort ou ralentit, ses bokeh naissent au réveil
  useEffect(() => {
    const toile = toileRef.current;
    if (!toile) return;
    const lire = () => useBackgroundStore.getState().fond;
    return lancerFond(toile, () => useBackgroundStore.getState().currentPalette, () => lire() === 'organique' || lire() === 'bokeh',
      () => useUIStore.getState().page !== null, () => useUIStore.getState().appState === 'awake', () => lire() === 'organique');
  }, []);

  // Couleurs du fond pour le verre et le dégradé, au rythme du fondu
  const couleurs = {
    '--fond-haut': currentPalette.topColor,
    '--fond-bas': currentPalette.bottomColor,
    '--lumiere': currentPalette.lumiere,
    transition: `--fond-haut ${FONDU}, --fond-bas ${FONDU}, --lumiere ${FONDU}`,
  } as React.CSSProperties;

  return (
    <>
      <div className="fixed inset-0 min-h-screen pointer-events-none z-0" style={{ background: baseDe(currentPalette), ...couleurs }}>
        {/* Dégradé d'avant la Bande 16, sous le fond vivant et les photos */}
        <div className={`fond-degrade${currentPalette.arc ? ' arc' : ''}`} />
        <canvas ref={toileRef} className="fond-vivant" data-eteint={!vivant || undefined} aria-hidden="true" />
        {posees.map((p) => (
          <Image key={p} src={urlPhoto(p)} alt="" fill sizes="100vw" className="fond-photo" data-eteint={!photo || undefined}
            onLoad={(e) => { e.currentTarget.dataset.charge = ''; }}
            onTransitionEnd={() => setPosees((l) => (photo === p ? [p] : photo ? l : []))} />
        ))}
        <div className="fond-voile" data-eteint={!photo || undefined} />
      </div>

      <div className="relative z-10" style={couleurs}>
        {children}
      </div>
    </>
  );
}
