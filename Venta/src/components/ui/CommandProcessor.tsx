'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import GlassmorphismeWindow from './GlassmorphismeWindow';
import type { WindowData } from './commandTypes';
import { processCommand } from './commandHandlers';

type Command = {
  command: string;
  parameter: string;
};

type CommandProcessorProps = {
  commands: Command[];
  onCommandsProcessed: () => void;
  currentUserId?: string | null;
};

const CODE_WRAPPER_STYLE = { padding: '18px' };
const CODE_INFO_STYLE = { marginBottom: '8px', fontSize: '14px' };
const CODE_BLOCK_STYLE = {
  background: '#000',
  padding: '12px',
  borderRadius: '4px',
  overflowX: 'auto',
  fontSize: '14px',
};

import { useUIStore } from '@/lib/state/uiStore';

export default function CommandProcessor({
  commands,
  onCommandsProcessed,
  currentUserId,
}: CommandProcessorProps) {
  const [windows, setWindows] = useState<WindowData[]>([]);
  const incrementMaxZIndex = useUIStore((state) => state.incrementMaxZIndex);
  const maxZIndex = useUIStore((state) => state.maxZIndex);
  
  // Historique des commandes pour ne pas retraiter les anciennes (sauf si nouvelle référence)
  const processedCommandsRef = useRef<Set<string>>(new Set());
  
  // Référence vers le dernier tableau de commandes traité
  // Permet d'éviter de retraiter les commandes si le composant re-render mais que les commandes n'ont pas changé
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
      
      // Pour éviter d'appeler incrementMaxZIndex pendant le rendu ou de manière synchrone directe
      // qui causerait un update d'état dans un autre composant pendant le render de celui-ci
      // on prépare les fenêtres mais on assignera le zIndex final via un effet ou une action différée
      // ICI: Comme processCommands est appelé dans un useEffect, c'est safe d'appeler des setters
      
      // Utilisation de setTimeout pour sortir du cycle de rendu et éviter l'erreur
      // "Cannot update a component while rendering a different component"
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
    // (Pour SetBackground, on accepte de le refaire même si c'est la même commande, tant que c'est un nouveau tableau)
    if (!isBackgroundCommand && processedCommandsRef.current.has(commandKey)) {
      lastProcessedCommandsRef.current = commands; // On marque comme vu
      return;
    }
    
    // On ajoute à l'historique
    if (!processedCommandsRef.current.has(commandKey)) {
      processedCommandsRef.current.add(commandKey);
    }
    
    // On traite les commandes
    processCommands(commands);
    
    // On met à jour la référence pour empêcher le re-traitement au prochain render
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
    // Cela évite l'erreur "Cannot update a component while rendering a different component"
    setTimeout(() => {
      // On calcule le nouveau Z-Index EN DEHORS du setState car c'est un effet de bord (mise à jour du store)
      // Les fonctions de mise à jour d'état (comme celle passée à setWindows) doivent être pures.
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
        <GlassmorphismeWindow
          key={window.id}
          title={window.title}
          x={window.x}
          y={window.y}
          zIndex={window.zIndex}
          onClose={() => closeWindow(window.id)}
          onMove={(nextX, nextY) => updateWindowPosition(window.id, nextX, nextY)}
          onFocus={() => bringWindowToFront(window.id)}
        >
          {renderWindowContent(window)}
        </GlassmorphismeWindow>
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
