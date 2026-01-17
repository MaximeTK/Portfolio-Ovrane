import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ImageGalleryProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

export function ImageGallery({ images, initialIndex, onClose }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoaded, setIsLoaded] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Min dist pour le swipe
  const minSwipeDistance = 50;

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsLoaded(true);
    setDragOffset(0);
  }, [initialIndex]);

  const goToNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setDragOffset(0);
  }, [images.length]);

  const goToPrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setDragOffset(0);
  }, [images.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); // Reset
    setTouchStart(e.targetTouches[0].clientX);
    setDragOffset(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentTouch = e.targetTouches[0].clientX;
    setTouchEnd(currentTouch);
    setDragOffset(currentTouch - touchStart);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setDragOffset(0);
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    } else {
      // Rebond si pas assez swipé
      setDragOffset(0);
    }
  };

  const getImageName = (url: string) => {
    try {
      // Décoder l'URL (pour les %20 etc)
      const decoded = decodeURIComponent(url);
      // Récupérer le nom de fichier
      const filename = decoded.split('/').pop() || '';
      // Enlever l'extension
      return filename.replace(/\.[^/.]+$/, "");
    } catch (_e) {
      return '';
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, onClose]);

  const getSlideStyle = (offset: number) => ({
    // Espacement augmenté entre les slides (100% + 20px de gap) pour éviter qu'ils ne soient visibles sur les bords
    transform: `translateX(calc(${offset * 100}% + ${offset * 40}px + ${dragOffset}px))`,
    transition: dragOffset === 0 ? 'transform 0.3s ease-out' : 'none',
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const renderSlide = (index: number, positionOffset: number) => {
    // Gestion du wrapping cyclique des index
    // Si index < 0, on va à la fin. Si index >= length, on va au début.
    // L'index passé ici peut être hors bornes (ex: -1 ou length), on le normalise.
    let normalizedIndex = index;
    if (normalizedIndex < 0) normalizedIndex = images.length - 1;
    if (normalizedIndex >= images.length) normalizedIndex = 0;

    const imgUrl = images[normalizedIndex];
    const isCurrent = positionOffset === 0;

    return (
      <div 
        key={`${normalizedIndex}-${positionOffset}`}
        style={getSlideStyle(positionOffset)}
        className="group px-2 md:px-0"
      >
         <div className="relative max-w-full max-h-full flex items-center justify-center w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={imgUrl} 
              alt={`Image ${normalizedIndex + 1}`} 
              className="relative max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10 select-none"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />

            {/* Actions rapides sur l'image (seulement sur l'image centrale pour éviter duplication visuelle lors du slide) */}
            {isCurrent && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-auto">
                <a 
                  href={imgUrl} 
                  download 
                  className="bg-black/60 hover:bg-black/80 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-sm font-medium border border-white/10 flex items-center gap-2 transition-colors shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Télécharger
                </a>
              </div>
            )}
         </div>
      </div>
    );
  };

  if (!images.length) return null;

  return createPortal(
    <div 
      className={`fixed inset-0 z-[200] bg-black/25 backdrop-blur-xl flex flex-col items-center justify-between transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      {/* Bouton Fermer */}
      <button 
        className="absolute top-6 right-6 z-[110] group bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white rounded-full p-3 transition-all duration-200 transform hover:scale-110 hover:rotate-90"
        onClick={onClose}
        aria-label="Fermer"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      {/* Zone Image Principale */}
      <div 
        className="relative flex-1 w-full flex flex-col items-center justify-center p-4 md:p-12"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Nom de l'image */}
        <div className="mb-4 z-[120] animate-in fade-in slide-in-from-top-4 duration-500 delay-150 absolute top-4 md:top-8 pointer-events-none">
           <span className="inline-block bg-black/40 backdrop-blur-md px-6 py-2 rounded-full text-white/90 font-medium text-sm md:text-base border border-white/10 shadow-lg">
             {getImageName(images[currentIndex])}
           </span>
        </div>

        {/* Flèches de navigation (masquées sur mobile) */}
        {images.length > 1 && (
          <>
            <button 
              className="hidden md:flex absolute left-4 md:left-8 z-[110] bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-full p-4 transition-all hover:scale-110 disabled:opacity-30"
              onClick={goToPrev}
              aria-label="Image précédente"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button 
              className="hidden md:flex absolute right-4 md:right-8 z-[110] bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-full p-4 transition-all hover:scale-110 disabled:opacity-30"
              onClick={goToNext}
              aria-label="Image suivante"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </>
        )}

        {/* Fond lumineux fixe au centre (ne bouge pas avec les slides) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

        {/* Container des slides */}
        <div 
          className="relative w-full h-full"
        >
          {/* Si une seule image, on l'affiche simplement */}
          {images.length === 1 ? (
             renderSlide(0, 0)
          ) : (
            <>
              {/* Image Précédente */}
              {renderSlide(currentIndex - 1, -1)}
              {/* Image Courante */}
              {renderSlide(currentIndex, 0)}
              {/* Image Suivante */}
              {renderSlide(currentIndex + 1, 1)}
            </>
          )}
        </div>
      </div>

      {/* Barre de vignettes en bas */}
      <div 
        className="w-full bg-black/40 backdrop-blur-md border-t border-white/5 p-6 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white/40 text-xs font-medium uppercase tracking-[0.2em]">
          {currentIndex + 1} / {images.length}
        </div>
        
        <div className="flex gap-3 overflow-x-auto max-w-full px-4 py-2 custom-scrollbar">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all duration-300 ${
                idx === currentIndex 
                  ? 'ring-2 ring-white scale-110 z-10' 
                  : 'opacity-40 hover:opacity-100 scale-100 ring-1 ring-white/10'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={`Miniature ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

