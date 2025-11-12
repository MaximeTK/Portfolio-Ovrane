'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GlassmorphismeWindow from './GlassmorphismeWindow';
import { useUIStore } from '@/lib/state/uiStore';

const markdownPlugins = [remarkGfm];

export function TextWindow() {
  const { textWindow, hideTextWindow, setTextWindowPosition } = useUIStore();

  if (!textWindow.visible || !textWindow.content) {
    return null;
  }

  return (
    <GlassmorphismeWindow
      title={textWindow.title ?? 'Réponse'}
      x={textWindow.x}
      y={textWindow.y}
      onClose={hideTextWindow}
      onMove={setTextWindowPosition}
    >
      <div className="text-window-markdown">
        <ReactMarkdown remarkPlugins={markdownPlugins}>
          {textWindow.content}
        </ReactMarkdown>
      </div>
    </GlassmorphismeWindow>
  );
}

