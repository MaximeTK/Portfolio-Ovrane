import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import { CHAT_UI } from '@/lib/messages';
import { Verre } from '@/features/site/ProjectPage';
import type { Command, Message } from './types';

// Leurs alias suivent : js, ts, py, sh…
Object.entries({ bash, css, javascript, json, python, tsx, typescript }).forEach(([nom, langage]) => SyntaxHighlighter.registerLanguage(nom, langage));

// HTML du modèle : schéma par défaut, et la seule classe image-grid sur les div
const SANITIZE_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  attributes: { ...defaultSchema.attributes, div: [['className', 'image-grid']] },
};

const MAX_IMAGES = 9;

// Images du message, Markdown, HTML ou commandes ShowPicture : seulement celles de /assets/
function messageImages(content: string, commands: Command[] = []): string[] {
  const sources = [
    ...Array.from(content.matchAll(/!\[[^\]]*\]\(([^)]+)\)|<img\s[^>]*src=["']([^"']+)["']/g), (m) => m[1] ?? m[2]),
    ...commands.filter((c) => /^show(picture|image)$/i.test(c.command)).map((c) => `/assets/${encodeURIComponent(c.parameter)}`),
  ];
  return [...new Set(sources.filter((src) => src.startsWith('/assets/') && !src.includes('..')))];
}

interface MessageBubbleProps {
  message: Message;
  time: string;
  dateDivider?: string;
  onImageClick: (images: string[], index: number) => void;
  onImageLoad: () => void;
}

export function MessageBubble({ message, time, dateDivider, onImageClick, onImageLoad }: MessageBubbleProps) {
  const { role, content } = message;
  const isUser = role === 'user';
  const images = messageImages(content, message.commands);
  const enGrille = images.length > 1;
  const Bulle = isUser ? 'div' : Verre;

  return (
    <>
      {dateDivider && (
        <div className="flex items-center justify-center my-6">
          <div className="h-px bg-gray-600 w-1/4 mr-4" />
          <span className="text-xs font-medium text-white/60 uppercase tracking-wider">{dateDivider}</span>
          <div className="h-px bg-gray-600 w-1/4 ml-4" />
        </div>
      )}

      <div className={`flex w-full mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`flex items-baseline gap-2 mb-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-sm font-bold text-gray-200">{isUser ? CHAT_UI.youLabel : CHAT_UI.assistantLabel}</span>
            <span className="text-[10px] text-white/60">{time}</span>
          </div>

          <Bulle
            className={`markdown px-4 py-3 text-sm md:text-base text-white break-words whitespace-pre-wrap ${
              // Le visiteur flotte sur la teinte réglable ; l'IA prend le verre du Figma, coin d'attache gardé
              isUser
                ? 'bg-(--verre) shadow-[0_2px_8px_0_rgba(0,0,0,0.15)] rounded-2xl rounded-tr-sm'
                : '[--verre-rayon:4px_25px_25px_25px]'
            }`}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA]]}
              components={{
                // Les images rejoignent la grille sous le texte
                img: () => null,
                code: ({ className, children }) => {
                  const langage = /language-(\w+)/.exec(className || '')?.[1];
                  if (!langage) {
                    return <code className="bg-black/30 px-1.5 py-0.5 rounded text-sm font-mono border border-white/10 text-red-300">{children}</code>;
                  }
                  return (
                    <div className="relative my-4 rounded-lg overflow-hidden border border-white/10 shadow-lg">
                      <div className="px-4 py-2 bg-[#1e1e1e] border-b border-white/5 text-xs text-gray-400 font-mono">{langage.toUpperCase()}</div>
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={langage}
                        PreTag="div"
                        className="!bg-[#1e1e1e] !p-4 !m-0 !rounded-none text-sm custom-scrollbar"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  );
                },
                a: ({ node: _node, ...props }) => (
                  <a {...props} className="text-blue-300 hover:text-blue-200 underline decoration-blue-300/50 hover:decoration-blue-200" target="_blank" rel="noopener noreferrer" />
                ),
                p: ({ node: _node, ...props }) => <p {...props} className="break-words whitespace-pre-wrap mb-2 last:mb-0 leading-relaxed" />,
              }}
            >
              {content}
            </ReactMarkdown>

            {images.length > 0 && (
              <div
                className={
                  enGrille
                    ? `grid gap-2 my-2 w-full min-w-[240px] md:min-w-[400px] ${images.length >= 3 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`
                    : 'my-2 w-full max-w-md min-w-[240px] md:min-w-[320px]'
                }
              >
                {images.slice(0, MAX_IMAGES).map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => onImageClick(images, i)}
                    aria-label="Agrandir l'image"
                    className={`relative block overflow-hidden rounded-lg border border-white/10 bg-black/20 cursor-zoom-in transition-all hover:brightness-90 ${enGrille ? 'aspect-square w-full' : 'w-fit max-w-full'}`}
                  >
                    {enGrille ? (
                      <Image src={src} alt="" fill sizes="(min-width: 768px) 150px, 40vw" className="object-cover" onLoad={onImageLoad} onError={onImageLoad} />
                    ) : (
                      <Image
                        src={src}
                        alt=""
                        width={0}
                        height={0}
                        sizes="(min-width: 768px) 448px, 80vw"
                        className="h-auto w-auto max-w-full max-h-[500px] object-contain"
                        onLoad={onImageLoad}
                        onError={onImageLoad}
                      />
                    )}
                    {i === MAX_IMAGES - 1 && images.length > MAX_IMAGES && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-900/60 backdrop-blur-[2px] text-lg font-bold text-white drop-shadow-md">
                        +{images.length - MAX_IMAGES}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Bulle>
        </div>
      </div>
    </>
  );
}
