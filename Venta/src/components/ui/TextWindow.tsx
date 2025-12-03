'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GlassmorphismeWindow from './GlassmorphismeWindow';
import { useUIStore } from '@/lib/state/uiStore';

const markdownPlugins = [remarkGfm];

export function TextWindow() {
  const { textWindows, closeTextWindow, setTextWindowPosition, bringTextWindowToFront } = useUIStore();

  if (!textWindows || textWindows.length === 0) {
    return null;
  }

  return (
    <>
      {textWindows.map((window) => (
        <GlassmorphismeWindow
          key={window.id}
          title={window.title ?? 'Réponse'}
          x={window.x}
          y={window.y}
          zIndex={window.zIndex}
          onClose={() => closeTextWindow(window.id)}
          onMove={(x, y) => setTextWindowPosition(window.id, x, y)}
          onFocus={() => bringTextWindowToFront(window.id)}
        >
          <div className="text-window-markdown">
            <ReactMarkdown remarkPlugins={markdownPlugins}>
              {window.content ?? ''}
            </ReactMarkdown>
          </div>
        </GlassmorphismeWindow>
      ))}
    </>
  );
}

