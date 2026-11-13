'use client';

import { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUIStore, type Fenetre } from '@/lib/uiStore';
import { estImageSite, sansExtension, urlAsset } from '@/lib/images';
import { ICONES, TRAIT } from '@/features/illusion/elements/icones';

// Zoom de 1 à 50/31 : une image passe de 31 à 50 vh sur son petit côté
const MAX_ZOOM = 50 / 31;

// Un bouton de la barre de fenêtre
function BoutonFenetre(props: React.ComponentProps<'button'>) {
  return <button type="button" className="glass-morphisme-btn-window" {...props} />;
}

/** Fenêtre en verre : Markdown ou image, déplaçable, zoomable, repliable */
const Window = memo(function Window({ fenetre, sortie, fermer }: { fenetre: Fenetre; sortie: boolean; fermer: (id: string) => void }) {
  const { moveWindow, focusWindow } = useUIStore.getState();
  const titleId = useId();
  const [isMinimized, setIsMinimized] = useState(false);
  // Ouverture d'Illusion : une ligne au centre s'élargit puis s'ouvre en hauteur
  const [entree, setEntree] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setEntree(false), 520);
    return () => clearTimeout(timer);
  }, []);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState('fit-content');
  const windowRef = useRef<HTMLElement>(null);
  // Décalage curseur/coin pendant le glissé ; null hors glissé
  const grabRef = useRef<{ dx: number; dy: number } | null>(null);
  const title = fenetre.kind === 'image' ? `Image: ${fenetre.content}` : 'Réponse';
  // Assez large pour le titre et les quatre boutons
  const minWidth = Math.max(150, title.length * 8) + 200;
  // Un glissé ne réanalyse rien ; un texte en flux cède la main à l'écran
  const texte = useDeferredValue(fenetre.content);
  const rendu = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Seules les images du site s'affichent dans une réponse
          img: ({ src, alt }) =>
            estImageSite(src) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt ?? ''} />
            ) : null,
        }}
      >
        {texte}
      </ReactMarkdown>
    ),
    [texte],
  );

  // Pointer Events : souris, tactile, stylet ; la capture garde le glissé
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = windowRef.current?.getBoundingClientRect();
    if (!rect) return;
    grabRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const grab = grabRef.current;
    const el = windowRef.current;
    if (!grab || !el) return;
    // Bornes : la fenêtre ne peut pas sortir de l'écran
    const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
    moveWindow(fenetre.id, clamp(e.clientX - grab.dx, window.innerWidth - el.offsetWidth), clamp(e.clientY - grab.dy, window.innerHeight - el.offsetHeight));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    grabRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Repliée, la fenêtre garde sa largeur pour que la barre de titre ne saute pas
  const handleMinimize = () => {
    setWidth(!isMinimized && windowRef.current ? `${windowRef.current.offsetWidth}px` : 'fit-content');
    setIsMinimized(!isMinimized);
  };

  return (
    <section
      ref={windowRef}
      role="dialog"
      aria-labelledby={titleId}
      className={`glass-morphisme ${isMinimized ? 'minimized' : ''}${sortie ? ' ov-ferme' : entree ? ' ov-ouvre' : ''}`}
      onPointerDownCapture={() => focusWindow(fenetre.id)}
      style={{ left: fenetre.x, top: fenetre.y, width, minWidth, zIndex: fenetre.zIndex, '--zoom': zoom } as React.CSSProperties}
    >
      <div className="glass-morphisme-background verre-flottant">
        <span className="verre-flottant-halos" aria-hidden="true" />
      </div>
      <span className="ouv-ligne" aria-hidden="true" />
      <span className="ouv-ligne" aria-hidden="true" />
      <div className="glass-morphisme-content">
        <header
          className="glass-morphisme-titlebar cursor-move touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div id={titleId} className="max-w-[calc(100%-220px)] flex-auto truncate pr-3">
            {title}
          </div>
          <div className="glass-morphisme-titlebar-buttons">
            {/* Icônes en trait carré d'Illusion ; le chevron se retourne au repli */}
            <BoutonFenetre aria-label="Réduire la taille" onClick={() => setZoom((z) => Math.max(1, z - 0.1))}>
              <svg {...TRAIT}><path d="M5 12h14" /></svg>
            </BoutonFenetre>
            <BoutonFenetre aria-label="Agrandir" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))}>{ICONES.plus}</BoutonFenetre>
            <BoutonFenetre aria-label={isMinimized ? 'Déplier' : 'Replier'} onClick={handleMinimize}>
              <svg {...TRAIT} className="chevron-f"><path d="m6 15 6-6 6 6" /></svg>
            </BoutonFenetre>
            <BoutonFenetre aria-label="Fermer la fenêtre" onClick={() => fermer(fenetre.id)}>{ICONES.croix_dock}</BoutonFenetre>
          </div>
        </header>
        <div className="glass-morphisme-content-area">
          {fenetre.kind === 'image' ? (
            <Image
              src={urlAsset(fenetre.content)}
              alt={sansExtension(fenetre.content)}
              width={0}
              height={0}
              sizes="640px"
              // Portrait : c'est la largeur qui suit le zoom, sinon la hauteur
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalHeight > img.naturalWidth) img.dataset.portrait = '';
              }}
            />
          ) : (
            <div className="text-window-markdown">{rendu}</div>
          )}
        </div>
      </div>
    </section>
  );
});

/** Fenêtres du tableau de bord ; Échap ferme celle du dessus. */
export function WindowsManager() {
  const windows = useUIStore((state) => state.windows);
  const closeWindow = useUIStore((state) => state.closeWindow);
  const [sorties, setSorties] = useState<string[]>([]);

  // La fenêtre se referme comme elle s'est ouverte, puis quitte le magasin
  const fermer = useCallback(
    (id: string) => {
      setSorties((s) => (s.includes(id) ? s : [...s, id]));
      setTimeout(() => {
        closeWindow(id);
        setSorties((s) => s.filter((x) => x !== id));
      }, 500);
    },
    [closeWindow],
  );

  useEffect(() => {
    const restantes = windows.filter((w) => !sorties.includes(w.id));
    if (!restantes.length) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      fermer(restantes.reduce((haut, w) => (w.zIndex > haut.zIndex ? w : haut)).id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [windows, sorties, fermer]);

  return (
    <>
      {windows.map((w) => (
        <Window key={w.id} fenetre={w} sortie={sorties.includes(w.id)} fermer={fermer} />
      ))}
    </>
  );
}
