'use client';

import React, { useState, useRef } from 'react';

interface DraggableWindowProps {
  title: string;
  x: number;
  y: number;
  children: React.ReactNode;
  onClose: () => void;
  onMove: (x: number, y: number) => void;
}

export default function DraggableWindow({ 
  title, 
  x, 
  y, 
  children, 
  onClose, 
  onMove 
}: DraggableWindowProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      onMove(newX, newY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={windowRef}
      className="fixed z-50 bg-gray-800 border border-blue-500 rounded-lg shadow-2xl min-w-[300px] max-w-[500px]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Barre de titre */}
      <div
        className="bg-blue-600 text-white px-4 py-2 rounded-t-lg flex justify-between items-center cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <span className="text-sm font-medium truncate">{title}</span>
        <button
          onClick={onClose}
          className="ml-2 text-white hover:text-red-300 transition-colors duration-200 flex items-center justify-center w-6 h-6 rounded-full hover:bg-red-600"
          title="Fermer"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M9 3L3 9M3 3L9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      
      {/* Contenu de la fenêtre */}
      <div className="overflow-hidden">
        {children}
      </div>
      
      {/* Indicateur de redimensionnement (optionnel) */}
      <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 opacity-50 hover:opacity-100 cursor-se-resize" />
    </div>
  );
}
