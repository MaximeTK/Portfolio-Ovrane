import React, { useEffect, useRef, useState } from 'react';
import { Message } from '@/lib/chat/types';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessagingViewProps {
  messages: Message[];
  visible: boolean;
  onLoadHistory?: () => Promise<void>;
  hasMoreMessages?: boolean;
  /** Compteur incrémenté pour forcer le scroll en bas (ex: envoi d'un message) */
  scrollTrigger?: number;
}

// Fonction utilitaire pour formater la date
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

// Fonction pour formater l'heure du message selon les règles demandées
function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeStr = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Si c'est aujourd'hui : juste l'heure
  if (date.toDateString() === now.toDateString()) {
    return timeStr;
  } 
  // Si c'est hier : "Hier HH:MM"
  else if (date.toDateString() === yesterday.toDateString()) {
    return `Hier ${timeStr}`;
  } 
  // Sinon (plus vieux) : "DD/MM/YYYY HH:MM"
  else {
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
  // Ref pour le premier scroll instantané
  const isFirstLoadRef = useRef(true);
  
  // État pour la lightbox d'image
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Scroll forcé lors d'un trigger manuel (ex: envoi de message)
  useEffect(() => {
    if (scrollTrigger > 0) {
      scrollToBottom();
    }
  }, [scrollTrigger]);

  // Scroll to bottom au chargement initial ou nouveau message
  useEffect(() => {
    if (visible && messages.length > 0) {
      // Si c'est le tout premier affichage (ou réouverture), on force le scroll instantané en bas
      if (isFirstLoadRef.current) {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          isFirstLoadRef.current = false;
        }
      } 
      // Sinon on utilise le smooth scroll standard si on est déjà en bas
      else if (shouldScrollToBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, visible]); // shouldScrollToBottom retiré pour éviter le "bump" lors du scroll manuel

  // Fonction pour remonter tout en bas
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShouldScrollToBottom(true);
  };

  // Reset le flag de premier chargement si la fenêtre devient invisible
  useEffect(() => {
    if (!visible) {
      isFirstLoadRef.current = true;
    }
  }, [visible]);

  // Détecter si on est en bas pour activer l'auto-scroll
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Seuil de détection (200px = environ 25% d'un écran standard)
    // Si on est à moins de 200px du bas, on considère qu'on est en bas
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceFromBottom < 200;
    
    setShouldScrollToBottom(isAtBottom);

    // Chargement historique en haut
    if (scrollTop === 0 && onLoadHistory && !isLoadingHistory && hasMoreMessages) {
      setIsLoadingHistory(true);
      // Sauvegarder la hauteur avant chargement pour restaurer la position
      const oldHeight = scrollHeight;
      
      await onLoadHistory();
      
      // Restaurer la position de scroll
      if (scrollContainerRef.current) {
        const newHeight = scrollContainerRef.current.scrollHeight;
        scrollContainerRef.current.scrollTop = newHeight - oldHeight;
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

      {/* Zone de chat */}
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
          // Logique pour les séparateurs de date
          const showDateDivider = index === 0 || 
            new Date(msg.timestamp).toDateString() !== new Date(messages[index - 1].timestamp).toDateString();
          
          return (
            <React.Fragment key={msg.id || index}>
              {showDateDivider && (
                <div className="flex items-center justify-center my-6 opacity-60">
                  <div className="h-[1px] bg-gray-600 w-1/4 mr-4"></div>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {formatDateDivider(msg.timestamp)}
                  </span>
                  <div className="h-[1px] bg-gray-600 w-1/4 ml-4"></div>
                </div>
              )}
              
              <div
                className={`flex w-full mb-1 group ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* En-tête du message avec nom et heure */}
                  <div className={`flex items-baseline gap-2 mb-1 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-sm font-bold text-gray-200">
                      {msg.role === 'user' ? 'Vous' : 'Hopa'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {showDateDivider ? (
                         // Si c'est le premier message du bloc date, on peut afficher la date complète ou juste l'heure si on veut être redondant
                         // Mais Discord affiche juste l'heure à côté du pseudo
                         formatMessageTime(msg.timestamp)
                      ) : (
                         formatMessageTime(msg.timestamp)
                      )}
                    </span>
                  </div>

                  <div
                    className="px-4 py-3 rounded-2xl text-sm md:text-base prose prose-invert break-words break-all whitespace-pre-wrap prose-p:my-1 prose-pre:my-2 prose-pre:bg-black/30 transition-opacity duration-200"
                    style={{
                      boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.15)',
                      // User: fond clair transparent (comme fenêtres)
                      // Assistant: fond plus sombre
                      background: msg.role === 'user' 
                        ? 'rgba(255, 255, 255, 0.1)' 
                        : 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      // Ajustement des coins arrondis
                      borderTopRightRadius: msg.role === 'user' ? '0.25rem' : '1rem',
                      borderTopLeftRadius: msg.role === 'assistant' ? '0.25rem' : '1rem',
                      borderBottomRightRadius: '1rem',
                      borderBottomLeftRadius: '1rem',
                    }}
                  >
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Gestion des images pour qu'elles restent dans la bulle et soient cliquables
                        img: ({node, ...props}) => (
                          <span 
                            className="block my-2 rounded-lg overflow-hidden cursor-zoom-in hover:brightness-90 transition-all"
                            onClick={() => setSelectedImage(props.src || null)}
                          >
                            <img {...props} className="max-w-full h-auto" alt={props.alt || ''} />
                          </span>
                        ),
                        // Gestion du code avec coloration syntaxique
                        code: ({node, className, children, ...props}) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match;
                          
                          if (isInline) {
                            return (
                              <code className="bg-black/30 px-1.5 py-0.5 rounded text-sm font-mono border border-white/10 text-red-300" {...props}>
                                {children}
                              </code>
                            );
                          }

                          return (
                            <div className="relative group my-4 rounded-lg overflow-hidden border border-white/10 shadow-lg">
                              {/* Barre de titre du code (optionnel mais sympa pour le look IDE) */}
                              <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-white/5">
                                <span className="text-xs text-gray-400 font-mono">{match[1].toUpperCase()}</span>
                              </div>
                              
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                className="!bg-[#1e1e1e] !p-4 !m-0 !rounded-none text-sm custom-scrollbar"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            </div>
                          );
                        },
                        // Liens
                        a: ({node, ...props}) => (
                          <a {...props} className="text-blue-300 hover:text-blue-200 underline decoration-blue-300/50 hover:decoration-blue-200" target="_blank" rel="noopener noreferrer" />
                        ),
                        // Paragraphes
                        p: ({node, ...props}) => (
                          <p {...props} className="break-words whitespace-pre-wrap mb-2 last:mb-0 leading-relaxed" />
                        )
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Lightbox pour images */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh]">
            <button 
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors p-2"
              onClick={() => setSelectedImage(null)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <img 
              src={selectedImage} 
              alt="Agrandissement" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

