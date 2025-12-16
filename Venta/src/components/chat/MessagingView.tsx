import React, { useEffect, useRef, useState } from 'react';
import { Message } from '@/lib/chat/types';
import { MessageBubble } from './MessageBubble';

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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
  }, [messages, visible, shouldScrollToBottom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShouldScrollToBottom(true);
  };

  useEffect(() => {
    if (!visible) {
      isFirstLoadRef.current = true;
    }
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
        <div className="bg-gray-900/90 backdrop-blur-md text-gray-200 px-4 py-2.5 rounded-r-full rounded-l-full shadow-2xl flex items-center gap-4 pointer-events-auto border border-gray-700/50 hover:bg-gray-900 transition-colors">
          <span className="text-sm font-medium">Tu consultes d'anciens messages</span>
          <button 
            onClick={scrollToBottom}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
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
                onImageClick={setSelectedImage}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative w-full h-full flex items-center justify-center p-4 md:p-12"
            onClick={(e) => {
               if (e.target === e.currentTarget) setSelectedImage(null);
            }}
          >
            <button 
              className="absolute top-6 right-6 z-50 group bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white rounded-full p-3 transition-all duration-200 transform hover:scale-110 hover:rotate-90"
              onClick={() => setSelectedImage(null)}
              aria-label="Fermer"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div className="relative max-w-full max-h-full flex items-center justify-center group" onClick={(e) => e.stopPropagation()}>
               <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-2xl opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>
               
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img 
                 src={selectedImage} 
                 alt="Agrandissement" 
                 className="relative max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-white/10"
               />

               <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
                  <a 
                    href={selectedImage} 
                    download 
                    className="bg-black/50 hover:bg-black/70 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium border border-white/10 flex items-center gap-2 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Télécharger
                  </a>
               </div>
            </div>
          </div>
        </div>
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
