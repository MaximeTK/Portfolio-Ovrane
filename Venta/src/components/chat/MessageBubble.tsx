import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessageBubbleProps {
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  showDateDivider?: boolean;
  formatDateDivider?: (ts: number) => string;
  formatMessageTime?: (ts: number) => string;
  onImageClick?: (src: string, allImagesInMessage: string[]) => void;
}

export function MessageBubble({ 
  content, 
  role, 
  timestamp, 
  showDateDivider, 
  formatDateDivider, 
  formatMessageTime,
  onImageClick 
}: MessageBubbleProps) {
  
  // Extraction de toutes les images du message courant pour la navigation de la galerie
  const extractImagesFromContent = (text: string): string[] => {
    const images: string[] = [];
    const mdRegex = /!\[.*?\]\((.*?)\)/g;
    const htmlRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/g;
    
    let match;
    const contentCopy = text || '';
    
    while ((match = mdRegex.exec(contentCopy)) !== null) {
      if (match[1]) images.push(match[1]);
    }
    
    while ((match = htmlRegex.exec(contentCopy)) !== null) {
      if (match[1]) images.push(match[1]);
    }
    
    return images;
  };

  const messageImages = React.useMemo(() => extractImagesFromContent(content), [content]);

  return (
    <>
      {showDateDivider && formatDateDivider && (
        <div className="flex items-center justify-center my-6 opacity-60">
          <div className="h-[1px] bg-gray-600 w-1/4 mr-4"></div>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {formatDateDivider(timestamp)}
          </span>
          <div className="h-[1px] bg-gray-600 w-1/4 ml-4"></div>
        </div>
      )}
      
      <div
        className={`flex w-full mb-1 group ${
          role === 'user' ? 'justify-end' : 'justify-start'
        }`}
      >
        <div className={`flex flex-col max-w-[80%] ${role === 'user' ? 'items-end' : 'items-start'}`}>
          {/* En-tête du message */}
          <div className={`flex items-baseline gap-2 mb-1 px-1 ${role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-sm font-bold text-gray-200">
              {role === 'user' ? 'Vous' : 'Ovrane'}
            </span>
            <span className="text-[10px] text-gray-400">
              {formatMessageTime ? formatMessageTime(timestamp) : new Date(timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div
            className="px-4 py-3 rounded-2xl text-sm md:text-base prose prose-invert break-words whitespace-pre-wrap prose-p:my-1 prose-pre:my-2 prose-pre:bg-black/30 transition-opacity duration-200"
            style={{
              boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.15)',
              background: role === 'user' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              borderTopRightRadius: role === 'user' ? '0.25rem' : '1rem',
              borderTopLeftRadius: role === 'assistant' ? '0.25rem' : '1rem',
              borderBottomRightRadius: '1rem',
              borderBottomLeftRadius: '1rem',
            }}
          >
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                div: ({node, className, children, ...props}) => {
                  if (className === 'image-grid') {
                     // Utilise la logique de grille existante (à extraire idéalement dans ImageGrid aussi, 
                     // mais pour l'instant inline ici pour compatibilité avec ReactMarkdown components)
                    return <ImageGrid>{children}</ImageGrid>;
                  }
                  return <div className={className} {...props}>{children}</div>;
                },
                img: ({node, className, style, ...props}) => {
                  const src = props.src || '';
                  return (
                    <span 
                      className={`chat-image-wrapper block relative rounded-lg overflow-hidden cursor-zoom-in hover:brightness-90 transition-all border border-white/10 bg-black/20 w-fit ${className || ''}`}
                      onClick={() => onImageClick?.(String(src), messageImages)}
                      style={{ ...style, maxHeight: '500px', width: 'auto', maxWidth: '100%' }}
                    >
                      <img 
                        {...props} 
                        src={src}
                        className={`h-auto w-auto max-w-full ${className?.includes('aspect-square') ? 'object-cover' : 'object-contain'}`}
                        style={{ height: 'auto', width: 'auto', maxHeight: '500px' }}
                        alt={props.alt || ''} 
                        loading="lazy"
                      />
                    </span>
                  );
                },
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
                  
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { ref, ...rest } = props as any;

                  return (
                    <div className="relative group my-4 rounded-lg overflow-hidden border border-white/10 shadow-lg">
                      <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-white/5">
                        <span className="text-xs text-gray-400 font-mono">{match?.[1].toUpperCase()}</span>
                      </div>
                      
                      <SyntaxHighlighter
                        style={vscDarkPlus as any}
                        language={match?.[1]}
                        PreTag="div"
                        className="!bg-[#1e1e1e] !p-4 !m-0 !rounded-none text-sm custom-scrollbar"
                        {...rest}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  );
                },
                a: ({node, ...props}) => (
                  <a {...props} className="text-blue-300 hover:text-blue-200 underline decoration-blue-300/50 hover:decoration-blue-200" target="_blank" rel="noopener noreferrer" />
                ),
                p: ({node, ...props}) => (
                  <p {...props} className="break-words whitespace-pre-wrap mb-2 last:mb-0 leading-relaxed" />
                )
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </>
  );
}

// Sous-composant pour la grille d'images (logique extraite)
function ImageGrid({ children }: { children: React.ReactNode }) {
  const validChildren = React.Children.toArray(children).filter((child) => React.isValidElement(child));
  const count = validChildren.length;

  if (count === 0) return null;

  // Si une seule image, on la retourne telle quelle avec une largeur minimale garantie
  if (count === 1) {
    return <div className="my-2 w-full max-w-md min-w-[240px] md:min-w-[320px]">{children}</div>;
  }

  // Configuration de la grille
  // Mobile : 2 colonnes minimum pour éviter les images minuscules
  // Desktop : 3 colonnes max
  let gridCols = 'grid-cols-2';
  if (count >= 3) gridCols = 'grid-cols-2 md:grid-cols-3';

  const maxImages = 9;
  const hasOverflow = count > maxImages;
  const displayItems = validChildren.slice(0, maxImages);
  const remainingCount = count - maxImages;

  return (
    <div className={`grid ${gridCols} gap-2 my-2 w-full max-w-full min-w-[240px] md:min-w-[400px] image-grid-layout`}>
      {displayItems.map((child, index) => {
        let styledChild = child;
        if (React.isValidElement(child)) {
           const childElement = child as React.ReactElement<{ className?: string; style?: React.CSSProperties }>;
           styledChild = React.cloneElement(childElement, {
              className: `${childElement.props.className || ''} !aspect-square !relative !block !object-cover !w-full !h-full`,
              style: { 
                ...childElement.props.style, 
                width: '100%',
                height: '100%',
                aspectRatio: '1/1',
                maxWidth: '100%'
              }
            });
        }

        if (hasOverflow && index === maxImages - 1) {
          return (
            <div key={index} className="relative group/overlay w-full h-full aspect-square">
              {styledChild}
              <div 
                className="absolute inset-0 bg-gray-900/60 flex items-center justify-center rounded-lg backdrop-blur-[2px] transition-colors cursor-pointer hover:bg-gray-900/70 z-10"
                onClick={(e) => {
                  // Déclencher manuellement le clic sur l'image sous-jacente
                  const imgWrapper = e.currentTarget.previousElementSibling as HTMLElement;
                  if (imgWrapper) {
                    imgWrapper.click();
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

