'use client';

import React, { useState, useEffect } from 'react';
import GlassmorphismeWindow from './GlassmorphismeWindow';
import { processCommand } from './commandHandlers';

interface Command {
  command: string;
  parameter: string;
}

interface CommandProcessorProps {
  commands: Command[];
  onCommandsProcessed: () => void;
  currentUserId?: string | null;
}

export default function CommandProcessor({ commands, onCommandsProcessed, currentUserId }: CommandProcessorProps) {
  const [windows, setWindows] = useState<Array<{
    id: string;
    type: string;
    content: any;
    title: string;
    x: number;
    y: number;
  }>>([]);
  
  const processedCommandsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (commands && commands.length > 0) {
      const commandKey = JSON.stringify(commands);
      if (!processedCommandsRef.current.has(commandKey)) {
        processedCommandsRef.current.add(commandKey);
        processCommands(commands);
        
        if (processedCommandsRef.current.size > 10) {
          const entries = Array.from(processedCommandsRef.current);
          processedCommandsRef.current = new Set(entries.slice(-5));
        }
      }
    }
  }, [commands]);

  const processCommands = (commands: Command[]) => {
    const newWindows: any[] = [];
    commands.forEach((cmd, index) => {
      const window = processCommand(cmd.command, cmd.parameter, index, currentUserId);
      if (window) newWindows.push(window);
    });
    if (newWindows.length > 0) {
      setWindows(prev => [...prev, ...newWindows]);
    }
    onCommandsProcessed();
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.filter(window => window.id !== id));
  };

  const updateWindowPosition = (id: string, x: number, y: number) => {
    setWindows(prev => prev.map(window => 
      window.id === id ? { ...window, x, y } : window
    ));
  };

  return (
    <>
      {windows.map(window => (
        <GlassmorphismeWindow
          key={window.id}
          title={window.title}
          x={window.x}
          y={window.y}
          onClose={() => closeWindow(window.id)}
          onMove={(x, y) => updateWindowPosition(window.id, x, y)}
        >
          {window.type === 'image' && (
            <img 
              src={window.content.src} 
              alt={window.content.alt}
              onError={window.content.onError}
            />
          )}
          
          {window.type === 'code' && (
            <div style={{ padding: '18px' }}>
              <p style={{ marginBottom: '8px', fontSize: '14px' }}>
                Langage: {window.content.language}
              </p>
              <pre style={{ 
                background: '#000', 
                padding: '12px', 
                borderRadius: '4px', 
                overflowX: 'auto',
                fontSize: '14px'
              }}>
                <code>{window.content.code}</code>
              </pre>
            </div>
          )}
          
          {window.type === 'generic' && (
            <p>{window.content.text}</p>
          )}
        </GlassmorphismeWindow>
      ))}
    </>
  );
}
