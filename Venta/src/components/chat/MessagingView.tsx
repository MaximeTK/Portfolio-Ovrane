import React, { useEffect, useRef, useState } from 'react';
import { Message } from '@/lib/chat/types';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
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
    // On utilise un seuil (ex: 50px) plutôt que 0 strict pour faciliter le déclenchement sur mobile/touch
    if (scrollTop < 50 && onLoadHistory && !isLoadingHistory && hasMoreMessages) {
      console.log('📜 [MessagingView] Trigger chargement historique (scrollTop < 50)');
      setIsLoadingHistory(true);
      // Sauvegarder la hauteur avant chargement pour restaurer la position
      const oldHeight = scrollHeight;
      const oldScrollTop = scrollTop; // On garde aussi l'offset actuel
      
      await onLoadHistory();
      
      // Restaurer la position de scroll
      if (scrollContainerRef.current) {
        // On calcule le delta de hauteur ajouté
        const newHeight = scrollContainerRef.current.scrollHeight;
        const heightAdded = newHeight - oldHeight;
        
        // Si du contenu a été ajouté, on ajuste le scroll pour maintenir la position relative
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
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        // Gestion des divs pour la grille d'images
                        div: ({node, className, children, ...props}) => {
                          if (className === 'image-grid') {
                            // On filtre pour ne compter que les éléments React valides (ignorer les sauts de ligne/texte vide)
                            const validChildren = React.Children.toArray(children).filter(
                              (child) => React.isValidElement(child)
                            );
                            const count = validChildren.length;
                            
                            // If only one image, render normally (no grid layout, no square enforcement)
                            if (count <= 1) {
                                return <div className="my-2 w-full max-w-md" {...props}>{children}</div>;
                            }

                            // Calcul dynamique des colonnes : on reste sur la logique de structure mais on va contraindre la taille
                            let gridCols = 'grid-cols-1';
                            if (count === 2) gridCols = 'grid-cols-2';
                            if (count >= 3) gridCols = 'grid-cols-3';
                            
                            // Limitation à 9 images max
                            const maxImages = 9;
                            const hasOverflow = count > maxImages;
                            const displayItems = validChildren.slice(0, maxImages);
                            const remainingCount = count - maxImages;

                            return (
                              <div className={`grid ${gridCols} gap-2 my-2 w-fit image-grid-layout`} {...props}>
                                {displayItems.map((child, index) => {
                                  // On clone l'élément pour forcer les styles carrés et la taille fixe de 10vh
                                  let styledChild = child;
                                  
                                  if (React.isValidElement(child)) {
                                     const childElement = child as React.ReactElement<any>;
                                     styledChild = React.cloneElement(childElement, {
                                        className: `${childElement.props.className || ''} !aspect-square !relative !block !object-cover`,
                                        style: { 
                                          ...childElement.props.style, 
                                          width: '25vh', 
                                          height: '25vh',
                                          aspectRatio: '1/1'
                                        }
                                      });
                                  }

                                  // Si c'est la dernière image visible ET qu'il y a du surplus
                                  if (hasOverflow && index === maxImages - 1) {
                                    return (
                                      <div key={index} className="relative group/overlay" style={{ width: '10vh', height: '10vh' }}>
                                        {styledChild}
                                        <div 
                                          className="absolute inset-0 bg-gray-900/60 flex items-center justify-center rounded-lg backdrop-blur-[2px] transition-colors cursor-pointer hover:bg-gray-900/70 z-10"
                                          onClick={(e) => {
                                            const img = e.currentTarget.parentElement?.querySelector('img');
                                            if (img) {
                                                const src = img.getAttribute('src');
                                                if (src) setSelectedImage(src);
                                            }
                                          }}
                                        >
                                          <span className="text-white font-bold text-lg drop-shadow-md">+{remainingCount}</span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return <React.Fragment key={index}>{styledChild}</React.Fragment>;
                                })}
                              </div>
                            );
                          }
                          return <div className={className} {...props}>{children}</div>;
                        },
                        // Gestion des images pour qu'elles restent dans la bulle et soient cliquables
                        img: ({node, className, style, ...props}) => {
                          const src = props.src || '';
                          return (
                            <span 
                              className={`chat-image-wrapper block relative rounded-lg overflow-hidden cursor-zoom-in hover:brightness-90 transition-all border border-white/10 bg-black/20 w-full ${className || ''}`}
                              onClick={() => setSelectedImage(src)}
                              style={style}
                            >
                              <img 
                                {...props} 
                                src={src}
                                className={`w-full h-full ${className?.includes('aspect-square') ? 'object-cover' : 'object-contain'}`}
                                style={{ maxHeight: className?.includes('aspect-square') ? 'none' : '400px' }}
                                alt={props.alt || ''} 
                                loading="lazy"
                              />
                            </span>
                          );
                        },
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
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          {/* Overlay Interface Style (Pico Inspired) */}
          <div 
            className="relative w-full h-full flex items-center justify-center p-4 md:p-12"
            onClick={(e) => {
               // Si on clique sur le fond (pas sur l'image), on ferme
               if (e.target === e.currentTarget) setSelectedImage(null);
            }}
          >
            {/* Bouton Fermer */}
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

            {/* Conteneur Image avec Effet Glow */}
            <div className="relative max-w-full max-h-full flex items-center justify-center group" onClick={(e) => e.stopPropagation()}>
               {/* Glow effect behind image */}
               <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-2xl opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>
               
               <img 
                 src={selectedImage} 
                 alt="Agrandissement" 
                 className="relative max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-white/10"
               />

               {/* Toolbar optionnelle en bas (télécharger, etc.) */}
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
    </div>
  );
}

<style jsx global>{`
  /* On force le ratio carré et le positionnement absolu pour les images DANS la grille */
  .image-grid-layout .chat-image-wrapper {
    aspect-ratio: 1 / 1 !important;
    position: relative !important;
    overflow: hidden !important;
    display: block !important;
    /* On laisse la width/height être gérée par le JS inline pour la taille fixe en vh */
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

