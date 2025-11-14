'use client';

import React, { useState, useEffect, useRef } from 'react';
import '@/app/globals.css';

interface GlassmorphismeWindowProps {
  title: string;
  x: number;
  y: number;
  children: React.ReactNode;
  onClose: () => void;
  onMove: (x: number, y: number) => void;
}

export default function GlassmorphismeWindow({ 
  title, 
  x, 
  y, 
  children, 
  onClose, 
  onMove 
}: GlassmorphismeWindowProps) {
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
  const [windowId] = useState(() => `window-${Math.random().toString(36).substr(2, 9)}`);

  // Contraintes identiques à glass.html
  const baseMaxSize = 31; // base ~31vh
  const minMaxSize = 31;  // minimum ~31vh
  const maxMaxSize = 50;  // maximum ~50vh
  const minZoom = minMaxSize / baseMaxSize;
  const maxZoom = maxMaxSize / baseMaxSize;

  useEffect(() => {
    if (windowRef.current && !isInitialized) {
      const rect = windowRef.current.getBoundingClientRect();
      windowRef.current.style.left = rect.left + 'px';
      windowRef.current.style.top = rect.top + 'px';
      windowRef.current.style.transform = 'none';
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Calculer la largeur minimale en fonction de la longueur du titre
  useEffect(() => {
    // Largeur des boutons (4 boutons * 28px + 3 gaps * 8px = 136px) + padding (18px * 2 = 36px) = 172px
    // Marge de sécurité supplémentaire pour le titre
    const buttonAreaWidth = 200; // Zone réservée pour les boutons
    const minTitleWidth = Math.max(150, title.length * 8); // Environ 8px par caractère
    const calculatedMinWidth = Math.max(300, minTitleWidth + buttonAreaWidth);
    setMinWidth(`${calculatedMinWidth}px`);
  }, [title]);

  useEffect(() => {
    if (!imageRef.current) return;

    const applyZoom = () => {
      if (!imageRef.current) return;
      const img = imageRef.current;
      const isPortrait = img.naturalHeight > img.naturalWidth;
      const newSizeVh = baseMaxSize * zoomLevel; // en vh

      // Pour permettre l'agrandissement même au-delà de la taille native,
      // on utilise width/height (et non max-*) afin de forcer la taille rendue.
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

    const handleMouseUp = () => {
      setIsDragging(false);
    };

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
        zIndex: 50
      }}
    >
      <div 
        className="glass-morphisme-background"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '16px',
          //background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
          backdropFilter: 'blur(60px) saturate(200%)',
          WebkitBackdropFilter: 'blur(60px) saturate(200%)',
          //boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
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
          {attachImageRef(children, imageRef)}
        </div>
      </div>
    </section>
  );
}

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
    if (!child.props['data-glass-image']) return child;
    return React.cloneElement(child as ImageLikeElement, {
      ref: imageRef,
    });
  });
}

