'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function CommandProcessor({
  commands,
  onCommandsProcessed,
  currentUserId,
}: CommandProcessorProps) {
  const [windows, setWindows] = useState<WindowData[]>([]);
  const processedCommandsRef = React.useRef<Set<string>>(new Set());

  const trimHistory = useCallback(() => {
    const entries = Array.from(processedCommandsRef.current);
    processedCommandsRef.current = new Set(entries.slice(-5));
  }, []);

  const processCommands = useCallback(
    (pending: Command[]) => {
      const newWindows: WindowData[] = [];
      pending.forEach((cmd, index) => {
        const win = processCommand(
          cmd.command,
          cmd.parameter,
          index,
          currentUserId,
        );
        if (win) newWindows.push(win);
      });
      if (newWindows.length) {
        setWindows((prev) => [...prev, ...newWindows]);
      }
      onCommandsProcessed();
    },
    [currentUserId, onCommandsProcessed],
  );

  useEffect(() => {
    if (!commands.length) return;
    const commandKey = JSON.stringify(commands);
    if (processedCommandsRef.current.has(commandKey)) return;
    processedCommandsRef.current.add(commandKey);
    processCommands(commands);
    if (processedCommandsRef.current.size > 10) {
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

  const renderedWindows = useMemo(
    () =>
      windows.map((window) => (
        <GlassmorphismeWindow
          key={window.id}
          title={window.title}
          x={window.x}
          y={window.y}
          onClose={() => closeWindow(window.id)}
          onMove={(nextX, nextY) => updateWindowPosition(window.id, nextX, nextY)}
        >
          {renderWindowContent(window)}
        </GlassmorphismeWindow>
      )),
    [windows, closeWindow, updateWindowPosition],
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
