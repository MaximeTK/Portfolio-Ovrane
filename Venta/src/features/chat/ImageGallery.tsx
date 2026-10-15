import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface ImageGalleryProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

const MIN_SWIPE_DISTANCE = 50;

// Nom lisible d'une image : fichier décodé, sans extension
function getImageName(url: string) {
  try {
    return decodeURIComponent(url.split('/').pop() ?? '').replace(/\.[^/.]+$/, '');
  } catch {
    return '';
  }
}

export function ImageGallery({ images, initialIndex, onClose }: ImageGalleryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Fenêtre modale native : le fond devient inerte et Échap la ferme ; le focus va sur « Fermer », puis revient à la vignette
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => opener?.focus();
  }, []);

  const goTo = (delta: number) => {
    setCurrentIndex((i) => (i + delta + images.length) % images.length);
    setDragOffset(0);
  };

  const onTouchEnd = () => {
    if (touchStart !== null && Math.abs(dragOffset) > MIN_SWIPE_DISTANCE) goTo(dragOffset < 0 ? 1 : -1);
    else setDragOffset(0);
    setTouchStart(null);
  };

  // Image courante au centre, voisines de part et d'autre, espacées de 40 px pour ne pas déborder
  const renderSlide = (offset: -1 | 0 | 1) => {
    const index = (currentIndex + offset + images.length) % images.length;
    const src = images[index];
    return (
      <div
        key={`${index}-${offset}`}
        className="group absolute inset-0 flex items-center justify-center px-2 md:px-0"
        style={{
          transform: `translateX(calc(${offset * 100}% + ${offset * 40}px + ${dragOffset}px))`,
          transition: dragOffset === 0 ? 'transform 0.3s ease-out' : 'none',
        }}
      >
        <div className="relative flex h-full w-full items-center justify-center">
          <Image
            src={src}
            alt={getImageName(src)}
            width={0}
            height={0}
            sizes="100vw"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className="relative h-auto w-auto max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-white/10 select-none"
          />
          {offset === 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <a
                href={src}
                download
                className="bg-black/60 hover:bg-black/80 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-sm font-medium border border-white/10 flex items-center gap-2 transition-colors shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
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

  return (
    <dialog
      ref={dialogRef}
      aria-label="Galerie d'images"
      onCancel={onClose}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') goTo(1);
        if (e.key === 'ArrowLeft') goTo(-1);
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden border-0 bg-black/25 p-0 text-white backdrop-blur-xl backdrop:bg-transparent"
    >
      <div className="flex h-full w-full flex-col items-center justify-between">
        <button
          ref={closeRef}
          type="button"
          className="absolute top-6 right-6 z-[110] bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white rounded-full p-3 transition-all duration-200 transform hover:scale-110 hover:rotate-90"
          onClick={onClose}
          aria-label="Fermer"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div
          className="relative flex-1 w-full flex flex-col items-center justify-center p-4 md:p-12"
          onTouchStart={(e) => {
            setTouchStart(e.targetTouches[0].clientX);
            setDragOffset(0);
          }}
          onTouchMove={(e) => touchStart !== null && setDragOffset(e.targetTouches[0].clientX - touchStart)}
          onTouchEnd={onTouchEnd}
        >
          <div className="mb-4 z-[120] absolute top-4 md:top-8 pointer-events-none">
            <span className="inline-block bg-black/40 backdrop-blur-md px-6 py-2 rounded-full text-white/90 font-medium text-sm md:text-base border border-white/10 shadow-lg">
              {getImageName(images[currentIndex])}
            </span>
          </div>

          {/* Flèches, masquées sur mobile où l'on glisse */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                className="hidden md:flex absolute left-4 md:left-8 z-[110] bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-full p-4 transition-all hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(-1);
                }}
                aria-label="Image précédente"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                className="hidden md:flex absolute right-4 md:right-8 z-[110] bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-full p-4 transition-all hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(1);
                }}
                aria-label="Image suivante"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </>
          )}

          {/* Halo fixe au centre, immobile pendant le défilement */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

          <div className="relative w-full h-full">
            {images.length === 1 ? renderSlide(0) : [renderSlide(-1), renderSlide(0), renderSlide(1)]}
          </div>
        </div>

        <div className="w-full bg-black/40 backdrop-blur-md border-t border-white/5 p-6 flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
          <div className="text-white/60 text-xs font-medium uppercase tracking-[0.2em]">
            {currentIndex + 1} / {images.length}
          </div>
          <div className="flex gap-3 overflow-x-auto max-w-full px-4 py-2 custom-scrollbar">
            {images.map((img, idx) => (
              <button
                key={img}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Image ${idx + 1} : ${getImageName(img)}`}
                aria-current={idx === currentIndex}
                className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all duration-300 ${
                  idx === currentIndex ? 'ring-2 ring-white scale-110 z-10' : 'opacity-60 hover:opacity-100 scale-100 ring-1 ring-white/10'
                }`}
              >
                <Image src={img} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </dialog>
  );
}
