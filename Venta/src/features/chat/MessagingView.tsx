import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Message } from './types';
import { MessageBubble } from './MessageBubble';
import { useBackgroundStore } from '@/features/fond/backgroundStore';
import { CHAT_UI } from '@/lib/messages';

const ImageGallery = dynamic(() => import('./ImageGallery').then((m) => m.ImageGallery));

interface MessagingViewProps {
  messages: Message[];
  visible: boolean;
  onLoadHistory: () => Promise<void>;
  hasMoreMessages: boolean;
  scrollTrigger: number;
}

const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function hier() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date;
}

function formatDateDivider(timestamp: number): string {
  const date = new Date(timestamp);
  if (memeJour(date, new Date())) return CHAT_UI.today;
  if (memeJour(date, hier())) return CHAT_UI.yesterday;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (memeJour(date, new Date())) return heure;
  if (memeJour(date, hier())) return `${CHAT_UI.yesterday} ${heure}`;
  return `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${heure}`;
}

export function MessagingView({ messages, visible, onLoadHistory, hasMoreMessages, scrollTrigger }: MessagingViewProps) {
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const [gallery, setGallery] = useState<{ images: string[]; index: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isFirstLoadRef = useRef(true);
  const stickRafRef = useRef<number | null>(null);
  const currentPalette = useBackgroundStore((state) => state.currentPalette);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShouldScrollToBottom(true);
  }, []);

  // Chaque envoi ramène en bas de la conversation
  useEffect(() => {
    if (scrollTrigger > 0) scrollToBottom();
  }, [scrollTrigger, scrollToBottom]);

  // Une image chargée allonge la liste : on reste en bas si on y était
  const stickToBottomIfNeeded = useCallback(() => {
    if (!visible || !shouldScrollToBottom || stickRafRef.current !== null) return;
    stickRafRef.current = requestAnimationFrame(() => {
      stickRafRef.current = null;
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    });
  }, [visible, shouldScrollToBottom]);

  useEffect(() => () => {
    if (stickRafRef.current !== null) cancelAnimationFrame(stickRafRef.current);
  }, []);

  // À l'ouverture, directement en bas sans défilement visible ; ensuite, en douceur
  useEffect(() => {
    if (!visible) {
      isFirstLoadRef.current = true;
      return;
    }
    if (!messages.length) return;
    if (isFirstLoadRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      isFirstLoadRef.current = false;
    } else if (shouldScrollToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, visible, shouldScrollToBottom]);

  // La molette hors de la liste, sur les côtés vides, fait quand même défiler la conversation
  useEffect(() => {
    if (!visible) return;
    const handleGlobalWheel = (e: WheelEvent) => {
      const liste = scrollContainerRef.current;
      if (liste && !liste.contains(e.target as Node)) liste.scrollTop += e.deltaY;
    };
    window.addEventListener('wheel', handleGlobalWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleGlobalWheel);
  }, [visible]);

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setShouldScrollToBottom(scrollHeight - scrollTop - clientHeight < 200);

    // Près du haut : on charge les messages précédents et on garde la position de lecture
    if (scrollTop < 50 && !isLoadingHistory && hasMoreMessages) {
      setIsLoadingHistory(true);
      await onLoadHistory();
      const liste = scrollContainerRef.current;
      const ajout = liste ? liste.scrollHeight - scrollHeight : 0;
      if (liste && ajout > 0) liste.scrollTop = ajout + scrollTop;
      setIsLoadingHistory(false);
    }
  };

  const pastilleVisible = !shouldScrollToBottom && messages.length > 0;

  return (
    <div
      inert={!visible}
      className={`fixed bottom-0 left-0 right-0 z-10 h-[85vh] flex flex-col pb-32 px-4 max-w-5xl mx-auto transition-all duration-500 ease-in-out ${
        // Ouverte, sans translation : le fond que le verre des bulles recopie reste fixe à l'écran
        visible ? 'opacity-100 pointer-events-auto translate-none starting:opacity-0 starting:translate-y-8' : 'opacity-0 pointer-events-none translate-y-8'
      }`}
    >
      {/* Pastille de lecture d'anciens messages */}
      <div
        inert={!pastilleVisible}
        className={`fixed bottom-32 right-0 left-0 z-20 flex justify-center pointer-events-none transition-all duration-300 ease-in-out ${
          pastilleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="bg-black/50 backdrop-blur-md text-gray-200 px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-4 pointer-events-auto border border-gray-700/50 mx-[25px] max-w-[calc(100vw-50px)]">
          <span className="text-sm font-medium">{CHAT_UI.viewingOldMessages}</span>
          <button
            type="button"
            onClick={scrollToBottom}
            className="text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 border border-white/10 shadow-lg hover:brightness-110"
            style={{ backgroundColor: currentPalette.topColor }}
          >
            <span>{CHAT_UI.backToLatest}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
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
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 40px, black calc(100% - 40px), transparent)',
        }}
      >
        <div className="pt-8 pb-8">
          {isLoadingHistory && (
            <div className="w-full py-2 flex justify-center">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          )}

          {messages.length === 0 && !isLoadingHistory && (
            <div className="h-full flex items-center justify-center text-white/60 italic">{CHAT_UI.noMessagesYet}</div>
          )}

          {messages.map((msg, index) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              time={formatMessageTime(msg.timestamp)}
              dateDivider={
                index === 0 || !memeJour(new Date(msg.timestamp), new Date(messages[index - 1].timestamp))
                  ? formatDateDivider(msg.timestamp)
                  : undefined
              }
              onImageClick={(images, i) => setGallery({ images, index: i })}
              onImageLoad={stickToBottomIfNeeded}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {gallery && <ImageGallery images={gallery.images} initialIndex={gallery.index} onClose={() => setGallery(null)} />}
    </div>
  );
}
