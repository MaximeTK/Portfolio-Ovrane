'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '@/app/globals.css';
import { useUIStore } from '@/lib/state/uiStore';

interface WindowProps {
  id?: string;
  title: string;
  x: number;
  y: number;
  children?: React.ReactNode;
  content?: string; // Pour le markdown
  isMarkdown?: boolean;
  onClose: () => void;
  onMove: (x: number, y: number) => void;
  zIndex?: number;
  onFocus?: () => void;
}

/**
 * Composant unifié pour toutes les fenêtres flottantes (Glassmorphisme).
 * Gère à la fois le contenu React direct et le Markdown.
 */
export default function Window({ 
  id,
  title, 
  x, 
  y, 
  children,
  content,
  isMarkdown = false,
  onClose, 
  onMove,
  zIndex = 50,
  onFocus
}: WindowProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [windowWidth, setWindowWidth] = useState<string>('fit-content');
  const [minWidth, setMinWidth] = useState<string>('300px');
  
  const windowRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [windowId] = useState(() => id || `window-${Math.random().toString(36).substr(2, 9)}`);

  // Focus
  const handleMouseDown = () => onFocus?.();

  // Contraintes de taille (glass.html logic)
  const baseMaxSize = 31; // ~31vh
  const minMaxSize = 31;  
  const maxMaxSize = 50;  
  const minZoom = minMaxSize / baseMaxSize;
  const maxZoom = maxMaxSize / baseMaxSize;

  // Initialisation position
  useEffect(() => {
    if (windowRef.current && !isInitialized) {
      const rect = windowRef.current.getBoundingClientRect();
      windowRef.current.style.left = rect.left + 'px';
      windowRef.current.style.top = rect.top + 'px';
      windowRef.current.style.transform = 'none';
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Calcul largeur min
  useEffect(() => {
    const buttonAreaWidth = 200;
    const minTitleWidth = Math.max(150, title.length * 8);
    const calculatedMinWidth = Math.max(300, minTitleWidth + buttonAreaWidth);
    setMinWidth(`${calculatedMinWidth}px`);
  }, [title]);

  // Zoom Image
  useEffect(() => {
    if (!imageRef.current) return;

    const applyZoom = () => {
      if (!imageRef.current) return;
      const img = imageRef.current;
      const isPortrait = img.naturalHeight > img.naturalWidth;
      const newSizeVh = baseMaxSize * zoomLevel;

      img.style.maxWidth = '';
      img.style.maxHeight = '';
      if (isPortrait) {
        img.style.width = `${newSizeVh}vh`;
        img.style.height = 'auto';
      } else {
        img.style.height = `${newSizeVh}vh`;
        img.style.width = 'auto';
      }
    };

    if (imageRef.current.complete) {
      applyZoom();
    } else {
      imageRef.current.addEventListener('load', applyZoom);
    }
  }, [zoomLevel]);

  // Drag & Drop
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startPosRef.current.x;
      const deltaY = e.clientY - startPosRef.current.y;
      
      const newX = initialPosRef.current.x + deltaX;
      const newY = initialPosRef.current.y + deltaY;
      
      if (windowRef.current) {
        windowRef.current.style.left = newX + 'px';
        windowRef.current.style.top = newY + 'px';
      }
      onMove(newX, newY);
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onMove]);

  const handleTitlebarMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('glass-morphisme-btn-window')) return;
    
    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect();
      startPosRef.current = { x: e.clientX, y: e.clientY };
      initialPosRef.current = { x: rect.left, y: rect.top };
      setIsInitialized(true);
    }
    
    setIsDragging(true);
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.min(prev + 0.1, maxZoom));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.max(prev - 0.1, minZoom));
  };

  const handleMinimize = () => {
    const wasMinimized = isMinimized;
    setIsMinimized(!isMinimized);
    
    if (!wasMinimized && windowRef.current) {
      setWindowWidth(windowRef.current.offsetWidth + 'px');
    } else {
      setWindowWidth('fit-content');
    }
  };

  return (
    <section 
      className={`glass-morphisme ${isMinimized ? 'minimized' : ''}`}
      ref={windowRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={windowId}
      onMouseDownCapture={handleMouseDown}
      style={{
        left: isInitialized ? x + 'px' : undefined,
        top: isInitialized ? y + 'px' : undefined,
        width: windowWidth,
        minWidth: minWidth,
        cursor: isDragging ? 'grabbing' : 'default',
        maxWidth: '90vw',
        maxHeight: '90vh',
        position: 'fixed',
        height: 'fit-content',
        zIndex: zIndex
      }}
    >
      <div 
        className="glass-morphisme-background"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '16px',
          backdropFilter: 'blur(60px) saturate(200%)',
          WebkitBackdropFilter: 'blur(60px) saturate(200%)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          pointerEvents: 'none' as const
        }}
      ></div>
      <div className="glass-morphisme-content">
        <header 
          className="glass-morphisme-titlebar"
          style={{ cursor: isDragging ? 'grabbing' : 'move' }}
          onMouseDown={handleTitlebarMouseDown}
        >
          <div 
            id={windowId}
            style={{ 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              maxWidth: 'calc(100% - 220px)',
              flex: '1 1 auto',
              paddingRight: '12px'
            }}
          >
            {title}
          </div>
          <div className="glass-morphisme-titlebar-buttons">
            <div className="glass-morphisme-btn-window" aria-label="Réduire taille" onClick={handleZoomOut}>−</div>
            <div className="glass-morphisme-btn-window" aria-label="Agrandir taille" onClick={handleZoomIn}>+</div>
            <div className="glass-morphisme-btn-window" aria-label="Réduire" onClick={handleMinimize}>
              {isMinimized ? '−' : '_'}
            </div>
            <div className="glass-morphisme-btn-window" aria-label="Fermer" onClick={onClose}>✕</div>
          </div>
        </header>
        <div className="glass-morphisme-content-area" ref={contentRef}>
          {isMarkdown ? (
            <div className="text-window-markdown">
               <ReactMarkdown remarkPlugins={[remarkGfm]}>
                 {content || ''}
               </ReactMarkdown>
            </div>
          ) : (
            attachImageRef(children, imageRef as React.RefObject<HTMLImageElement>)
          )}
        </div>
      </div>
    </section>
  );
}

// Helpers
type ImageLikeElement = React.ReactElement<
  React.ImgHTMLAttributes<HTMLImageElement> & {
    'data-glass-image'?: boolean;
  }
>;

function attachImageRef(
  children: React.ReactNode,
  imageRef: React.RefObject<HTMLImageElement>,
) {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    const props = child.props as Record<string, unknown>;
    if (!props['data-glass-image']) return child;
    // On utilise any pour contourner la limitation de cloneElement avec ref sur des types génériques
    // C'est safe ici car on a vérifié que c'est un ReactElement valide
    return React.cloneElement(child as any, {
      ref: imageRef,
    });
  });
}

// Composant Helper pour afficher la liste des fenêtres de texte (ex-TextWindow)
export function TextWindowsManager() {
  const { textWindows, closeTextWindow, setTextWindowPosition, bringTextWindowToFront } = useUIStore();

  if (!textWindows || textWindows.length === 0) {
    return null;
  }

  return (
    <>
      {textWindows.map((window) => (
        <Window
          key={window.id}
          id={window.id}
          title={window.title ?? 'Réponse'}
          x={window.x}
          y={window.y}
          zIndex={window.zIndex}
          isMarkdown={true}
          content={window.content}
          onClose={() => closeTextWindow(window.id)}
          onMove={(x, y) => setTextWindowPosition(window.id, x, y)}
          onFocus={() => bringTextWindowToFront(window.id)}
        />
      ))}
    </>
  );
}
