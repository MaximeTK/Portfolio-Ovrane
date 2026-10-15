'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUIStore, type Fenetre } from '@/lib/uiStore';

// Zoom de 1 à 50/31 : une image passe de 31 à 50 vh sur son petit côté
const MAX_ZOOM = 50 / 31;

/** Fenêtre flottante en verre : réponse en Markdown ou image, déplaçable, zoomable, repliable. */
function Window({ fenetre }: { fenetre: Fenetre }) {
  const { closeWindow, moveWindow, focusWindow } = useUIStore.getState();
  const titleId = useId();
  const [isMinimized, setIsMinimized] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState('fit-content');
  const windowRef = useRef<HTMLElement>(null);
  // Décalage curseur/coin pendant le glissé ; null hors glissé
  const grabRef = useRef<{ dx: number; dy: number } | null>(null);
  const title = fenetre.kind === 'image' ? `Image: ${fenetre.content}` : 'Réponse';
  // Assez large pour le titre et les quatre boutons
  const minWidth = Math.max(300, Math.max(150, title.length * 8) + 200);

  // Pointer Events : souris, tactile et stylet ; la capture garde le glissé sur la barre de titre
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
      className={`glass-morphisme ${isMinimized ? 'minimized' : ''}`}
      onPointerDownCapture={() => focusWindow(fenetre.id)}
      style={{ left: fenetre.x, top: fenetre.y, width, minWidth, zIndex: fenetre.zIndex, '--zoom': zoom } as React.CSSProperties}
    >
      <div className="glass-morphisme-background" />
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
            <button type="button" className="glass-morphisme-btn-window" aria-label="Réduire la taille" onClick={() => setZoom((z) => Math.max(1, z - 0.1))}>−</button>
            <button type="button" className="glass-morphisme-btn-window" aria-label="Agrandir" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))}>+</button>
            <button type="button" className="glass-morphisme-btn-window" aria-label={isMinimized ? 'Déplier' : 'Replier'} onClick={handleMinimize}>
              {isMinimized ? '−' : '_'}
            </button>
            <button type="button" className="glass-morphisme-btn-window" aria-label="Fermer la fenêtre" onClick={() => closeWindow(fenetre.id)}>✕</button>
          </div>
        </header>
        <div className="glass-morphisme-content-area">
          {fenetre.kind === 'image' ? (
            <Image
              src={`/assets/${encodeURIComponent(fenetre.content)}`}
              alt={fenetre.content.replace(/\.[^.]+$/, '')}
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
            <div className="text-window-markdown">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Seules les images du site s'affichent dans une réponse
                  img: ({ src, alt }) =>
                    typeof src === 'string' && src.startsWith('/assets/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={alt ?? ''} />
                    ) : null,
                }}
              >
                {fenetre.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Fenêtres du tableau de bord ; Échap ferme celle du dessus. */
export function WindowsManager() {
  const windows = useUIStore((state) => state.windows);
  const closeWindow = useUIStore((state) => state.closeWindow);

  useEffect(() => {
    if (!windows.length) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      closeWindow(windows.reduce((haut, w) => (w.zIndex > haut.zIndex ? w : haut)).id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [windows, closeWindow]);

  return (
    <>
      {windows.map((w) => (
        <Window key={w.id} fenetre={w} />
      ))}
    </>
  );
}
