import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Message } from '@/lib/chat/types';
import { MessageBubble } from './MessageBubble';
import { ImageGallery } from './ImageGallery';
import { useBackgroundStore } from '@/lib/state/backgroundStore';

interface MessagingViewProps {
  messages: Message[];
  visible: boolean;
  onLoadHistory?: () => Promise<void>;
  hasMoreMessages?: boolean;
  scrollTrigger?: number;
}

function formatDateDivider(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return `Aujourd'hui`;
  } else if (date.toDateString() === yesterday.toDateString()) {
    return `Hier`;
  } else {
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  }
}

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeStr = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (date.toDateString() === now.toDateString()) {
    return timeStr;
  } else if (date.toDateString() === yesterday.toDateString()) {
    return `Hier ${timeStr}`;
  } else {
    const dateStr = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return `${dateStr} ${timeStr}`;
  }
}

export function MessagingView({ messages, visible, onLoadHistory, hasMoreMessages = true, scrollTrigger = 0 }: MessagingViewProps) {
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const isFirstLoadRef = useRef(true);
  
  const currentPalette = useBackgroundStore((state) => state.currentPalette);
  
  const [galleryState, setGalleryState] = useState<{
    isOpen: boolean;
    initialIndex: number;
    images: string[];
  }>({
    isOpen: false,
    initialIndex: 0,
    images: []
  });

  const extractAllImages = useCallback((msgs: Message[]): string[] => {
    const images: string[] = [];
    const mdRegex = /!\[.*?\]\((.*?)\)/g;
    const htmlRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/g;

    msgs.forEach(msg => {
      let match;
      // Copie du contenu pour éviter les problèmes de regex stateful si nécessaire
      const content = msg.content || '';
      
      while ((match = mdRegex.exec(content)) !== null) {
        if (match[1]) images.push(match[1]);
      }
      
      while ((match = htmlRegex.exec(content)) !== null) {
        if (match[1]) images.push(match[1]);
      }
    });
    return images;
  }, []);

  const handleImageClick = (src: string, messageImages: string[]) => {
    // Si des images sont fournies par le message, on les utilise
    // Sinon on garde le comportement de fallback (bien que MessageBubble devrait maintenant toujours fournir la liste)
    const images = messageImages && messageImages.length > 0 ? messageImages : [src];
    const index = images.findIndex(img => img === src);
    
    setGalleryState({
      isOpen: true,
      images: images,
      initialIndex: index !== -1 ? index : 0
    });
  };

  useEffect(() => {
    if (scrollTrigger > 0) {
      scrollToBottom();
    }
  }, [scrollTrigger]);

  useEffect(() => {
    if (visible && messages.length > 0) {
      if (isFirstLoadRef.current) {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          isFirstLoadRef.current = false;
        }
      } else if (shouldScrollToBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, visible]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShouldScrollToBottom(true);
  };

  useEffect(() => {
    if (!visible) {
      isFirstLoadRef.current = true;
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const handleGlobalWheel = (e: WheelEvent) => {
      // Si l'élément cible est déjà dans le conteneur scrollable (ou est le conteneur lui-même),
      // le navigateur gère le scroll nativement, donc on ne fait rien pour éviter le double scroll.
      if (scrollContainerRef.current && scrollContainerRef.current.contains(e.target as Node)) {
        return;
      }
      
      // Si on est en dehors du conteneur (ex: sur les côtés vides), on redirige le scroll
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop += e.deltaY;
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleGlobalWheel);
  }, [visible]);

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceFromBottom < 200;
    
    setShouldScrollToBottom(isAtBottom);

    if (scrollTop < 50 && onLoadHistory && !isLoadingHistory && hasMoreMessages) {
      setIsLoadingHistory(true);
      const oldHeight = scrollHeight;
      const oldScrollTop = scrollTop;
      
      await onLoadHistory();
      
      if (scrollContainerRef.current) {
        const newHeight = scrollContainerRef.current.scrollHeight;
        const heightAdded = newHeight - oldHeight;
        if (heightAdded > 0) {
           scrollContainerRef.current.scrollTop = heightAdded + oldScrollTop;
        }
      }
      setIsLoadingHistory(false);
    }
  };

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-10 h-[85vh] flex flex-col pb-32 px-4 max-w-5xl mx-auto transition-all duration-500 ease-in-out ${
        visible 
          ? 'opacity-100 pointer-events-auto translate-y-0' 
          : 'opacity-0 pointer-events-none translate-y-8'
      }`}
    >
      {/* Indicateur de lecture d'anciens messages */}
      <div 
        className={`fixed bottom-32 right-0 left-0 z-20 flex justify-center pointer-events-none transition-all duration-300 ease-in-out ${
          !shouldScrollToBottom && messages.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="bg-black/50 backdrop-blur-md text-gray-200 px-4 py-2.5 rounded-r-full rounded-l-full shadow-2xl flex items-center gap-4 pointer-events-auto border border-gray-700/50 hover:bg-black/50 transition-colors">
          <span className="text-sm font-medium">Tu consultes d'anciens messages</span>
          <button 
            onClick={scrollToBottom}
            className="text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 border border-white/10 shadow-lg hover:brightness-110"
            style={{ backgroundColor: currentPalette.topColor }}
          >
            <span>Revenir aux messages les plus récents</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto mt-4 space-y-4 pr-2 custom-scrollbar"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent, black 40px, black calc(100% - 40px), transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 40px, black calc(100% - 40px), transparent)'
        }}
      >
        <div className="pt-8 pb-8">
          {isLoadingHistory && (
            <div className="w-full py-2 flex justify-center">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}

          {messages.length === 0 && !isLoadingHistory && (
            <div className="h-full flex items-center justify-center text-gray-500 italic animate-in fade-in zoom-in duration-500">
              Aucun message pour le moment...
            </div>
          )}
          
          {messages.map((msg, index) => {
            const showDateDivider = index === 0 || 
              new Date(msg.timestamp).toDateString() !== new Date(messages[index - 1].timestamp).toDateString();
            
            return (
              <MessageBubble
                key={msg.id || index}
                content={msg.content}
                role={msg.role}
                timestamp={msg.timestamp}
                showDateDivider={showDateDivider}
                formatDateDivider={formatDateDivider}
                formatMessageTime={formatMessageTime}
                onImageClick={handleImageClick}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Lightbox / Gallery */}
      {galleryState.isOpen && (
        <ImageGallery 
          images={galleryState.images}
          initialIndex={galleryState.initialIndex}
          onClose={() => setGalleryState(prev => ({ ...prev, isOpen: false }))}
        />
      )}
      
      <style jsx global>{`
        .image-grid-layout .chat-image-wrapper {
          aspect-ratio: 1 / 1 !important;
          position: relative !important;
          overflow: hidden !important;
          display: block !important;
        }
        .image-grid-layout .chat-image-wrapper img {
          position: absolute !important;
          inset: 0 !important;
          height: 100% !important;
          width: 100% !important;
          object-fit: cover !important;
          max-height: none !important;
        }
      `}</style>
    </div>
  );
}
