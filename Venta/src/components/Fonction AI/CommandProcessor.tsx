'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Image from 'next/image';
import Window from '../ui/GlassmorphismeWindow';
import { useUIStore } from '@/lib/state/uiStore';
import { useBackgroundStore } from '@/lib/state/backgroundStore';
import { Command } from '@/lib/chat/types';

type BaseWindow = {
  id: string;
  title: string;
  x: number;
  y: number;
  zIndex?: number;
};

type ImageWindow = BaseWindow & {
  type: 'image';
  content: {
    src: string;
    alt: string;
    width: number;
    height: number;
    onError?: () => void;
  };
};

type CodeWindow = BaseWindow & {
  type: 'code';
  content: {
    language: string;
    code: string;
  };
};

type GenericWindow = BaseWindow & {
  type: 'generic';
  content: {
    text: string;
    timestamp?: string;
  };
};

type WindowData = ImageWindow | CodeWindow | GenericWindow;

type CommandProcessorProps = {
  commands: Command[];
  onCommandsProcessed: () => void;
  currentUserId?: string | null;
};

// === STYLES ===
const CODE_WRAPPER_STYLE = { padding: '18px' };
const CODE_INFO_STYLE = { marginBottom: '8px', fontSize: '14px' };
const CODE_BLOCK_STYLE = {
  background: '#000',
  padding: '12px',
  borderRadius: '4px',
  overflowX: 'auto',
  fontSize: '14px',
};

// === CONSTANTS & HELPERS ===
const OFFSET = 50;
const BASE_IMAGE_SIZE = 512;

function buildId(prefix: string, index: number) {
  const random = Math.random().toString(36).slice(2, 11);
  return `${prefix}-${Date.now()}-${random}-${index}`;
}

function safeEncodeAssetName(value: string) {
  const raw = String(value || '');
  try {
    return encodeURIComponent(decodeURIComponent(raw));
  } catch {
    return encodeURIComponent(raw);
  }
}

function extractImageFilename(param: string) {
  const raw = String(param || '').trim();
  if (!raw) return '';

  // Si une URL est passée directement, on la refuse ici (dashboard attend des assets locaux)
  // et on ne crée pas de fenêtre image.
  if (/^https?:\/\//i.test(raw) || /^\/assets\//i.test(raw)) {
    return '';
  }

  let cleaned = raw
    .replace(/^[\"'`“”«»]+/, '')
    .replace(/[\"'`“”«»]+$/, '')
    .trim();

  // basename only
  cleaned = cleaned.split(/[\\/]/).pop()?.trim() || cleaned;

  const fileMatch = cleaned.match(
    /([a-zA-Z0-9 _.\-()]+?\.(?:png|jpe?g|gif|webp|svg))(?![a-zA-Z0-9_])/i,
  );

  return fileMatch ? fileMatch[1].trim() : '';
}

// === HANDLERS (Logique interne) ===

function createImageWindow(imageName: string, index: number): WindowData {
  const id = buildId('image', index);
  return {
    id,
    type: 'image',
    content: {
      src: `/assets/${safeEncodeAssetName(imageName)}`,
      alt: `Image ${imageName}`,
      width: BASE_IMAGE_SIZE,
      height: BASE_IMAGE_SIZE,
      onError: () => console.error(`❌ Image introuvable: ${imageName}`),
    },
    title: `Image: ${imageName}`,
    x: 100 + index * OFFSET,
    y: 100 + index * OFFSET,
  };
}

function createCodeWindow(language: string, index: number): WindowData {
  const id = buildId('code', index);
  const code = [
    `// Exemple de code ${language}`,
    `console.log('Hello from ${language}!');`,
  ].join('\n');
  return {
    id,
    type: 'code',
    content: { language, code },
    title: `Code: ${language}`,
    x: 200 + index * OFFSET,
    y: 150 + index * OFFSET,
  };
}

function createGenericWindow(title: string, index: number): WindowData {
  const id = buildId('window', index);
  return {
    id,
    type: 'generic',
    content: {
      text: `Fenêtre: ${title}`,
      timestamp: new Date().toLocaleTimeString(),
    },
    title,
    x: 300 + index * OFFSET,
    y: 200 + index * OFFSET,
  };
}

function processCommand(
  command: string,
  parameter: string,
  index: number,
  userId?: string | null,
): WindowData | null {
  switch (command.toLowerCase()) {
    case 'showpicture':
    case 'showimage': {
      const filename = extractImageFilename(parameter);
      if (!filename) {
        console.warn(`Commande image ignorée (paramètre invalide): ${parameter}`);
        return null;
      }
      return createImageWindow(filename, index);
    }
    case 'showcode':
      return createCodeWindow(parameter, index);
    case 'openwindow':
      return createGenericWindow(parameter, index);
    case 'setbackground':
      // Commande spéciale : change le background sans créer de fenêtre
      useBackgroundStore.getState().setBackground(parameter, true, userId || undefined);
      console.log(`🎨 Background changé vers: ${parameter}${userId ? ` pour l'utilisateur ${userId}` : ''}`);
      return null;
    default:
      console.warn(`Commande inconnue: ${command}`);
      return null;
  }
}

// === COMPONENT ===

export default function CommandProcessor({
  commands,
  onCommandsProcessed,
  currentUserId,
}: CommandProcessorProps) {
  const [windows, setWindows] = useState<WindowData[]>([]);
  const incrementMaxZIndex = useUIStore((state) => state.incrementMaxZIndex);
  
  // Historique des commandes pour ne pas retraiter les anciennes (sauf si nouvelle référence)
  const processedCommandsRef = useRef<Set<string>>(new Set());
  
  // Référence vers le dernier tableau de commandes traité
  const lastProcessedCommandsRef = useRef<Command[] | null>(null);

  // Fermer toutes les fenêtres quand l'utilisateur change
  useEffect(() => {
    if (currentUserId) {
      console.log(`🧹 [CommandProcessor] Changement utilisateur (${currentUserId}), fermeture des fenêtres.`);
      setWindows([]);
    }
  }, [currentUserId]);

  const trimHistory = useCallback(() => {
    const entries = Array.from(processedCommandsRef.current);
    processedCommandsRef.current = new Set(entries.slice(-20));
  }, []);

  const processCommands = useCallback(
    (pending: Command[]) => {
      const newWindows: WindowData[] = [];
      
      // Utilisation de setTimeout pour sortir du cycle de rendu et éviter l'erreur
      setTimeout(() => {
        pending.forEach((cmd, index) => {
          console.log(`⚙️ [CommandProcessor] Traitement commande: ${cmd.command} -> ${cmd.parameter}`);
          
          const win = processCommand(
            cmd.command,
            cmd.parameter,
            index,
            currentUserId,
          );
          if (win) {
            // Assigner le z-index global de manière safe
            win.zIndex = incrementMaxZIndex();
            newWindows.push(win);
          }
        });
        if (newWindows.length) {
          setWindows((prev) => [...prev, ...newWindows]);
        }
        onCommandsProcessed();
      }, 0);
    },
    [currentUserId, onCommandsProcessed, incrementMaxZIndex],
  );

  useEffect(() => {
    // Sécurité anti-boucle : Si on a déjà traité exactement ce tableau (même référence), on arrête tout de suite.
    if (commands === lastProcessedCommandsRef.current) {
      return;
    }
    
    if (!commands.length) {
      lastProcessedCommandsRef.current = commands;
      return;
    }

    // Clé unique basée sur le contenu JSON pour l'historique global
    const commandKey = JSON.stringify(commands);
    
    // Détection si c'est une commande de background
    const isBackgroundCommand = commands.some(c => c.command.toLowerCase() === 'setbackground');
    
    // Si ce n'est PAS un changement de fond et qu'on a déjà vu cette commande exacte dans l'historique, on ignore.
    if (!isBackgroundCommand && processedCommandsRef.current.has(commandKey)) {
      lastProcessedCommandsRef.current = commands;
      return;
    }

    // On ajoute à l'historique (sauf si background qui peut être répété)
    if (!isBackgroundCommand) {
      processedCommandsRef.current.add(commandKey);
    }
    
    processCommands(commands);
    lastProcessedCommandsRef.current = commands;
    
    if (processedCommandsRef.current.size > 20) {
      trimHistory();
    }
  }, [commands, processCommands, trimHistory]);

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((window) => window.id !== id));
  }, []);

  const updateWindowPosition = useCallback((id: string, x: number, y: number) => {
    setWindows((prev) =>
      prev.map((window) => (window.id === id ? { ...window, x, y } : window)),
    );
  }, []);

  const bringWindowToFront = useCallback((id: string) => {
    // Utilisation de setTimeout pour sortir du cycle de rendu React actuel
    setTimeout(() => {
      const newZIndex = incrementMaxZIndex();

      setWindows((prev) => {
        const win = prev.find((w) => w.id === id);
        if (!win) return prev;
        
        return prev.map((w) => (w.id === id ? { ...w, zIndex: newZIndex } : w));
      });
    }, 0);
  }, [incrementMaxZIndex]);

  const renderedWindows = useMemo(
    () =>
      windows.map((window) => (
        <Window
          key={window.id}
          id={window.id}
          title={window.title}
          x={window.x}
          y={window.y}
          zIndex={window.zIndex}
          onClose={() => closeWindow(window.id)}
          onMove={(nextX, nextY) => updateWindowPosition(window.id, nextX, nextY)}
          onFocus={() => bringWindowToFront(window.id)}
        >
          {renderWindowContent(window)}
        </Window>
      )),
    [windows, closeWindow, updateWindowPosition, bringWindowToFront],
  );

  return <>{renderedWindows}</>;
}

function renderWindowContent(window: WindowData) {
  if (window.type === 'image') {
    const { src, alt, width, height, onError } = window.content;
    return (
      <Image
        data-glass-image
        src={src}
        alt={alt}
        width={width}
        height={height}
        onError={onError}
        className="h-auto w-full object-contain"
      />
    );
  }
  if (window.type === 'code') {
    return (
      <div style={CODE_WRAPPER_STYLE}>
        <p style={CODE_INFO_STYLE}>Langage: {window.content.language}</p>
        <pre style={CODE_BLOCK_STYLE}>
          <code>{window.content.code}</code>
        </pre>
      </div>
    );
  }
  return <p>{window.content.text}</p>;
}
