import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '@/lib/state/uiStore';

interface NameInputProps {
  onSubmit: (name: string) => void;
}

export const NameInput = ({ onSubmit }: NameInputProps) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const appState = useUIStore((state) => state.appState);

  // Focus automatique au démarrage
  useEffect(() => {
    if (appState === 'sleeping') {
      inputRef.current?.focus();
    }
  }, [appState]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value.toUpperCase();
    if (newVal.length <= 25) {
      setValue(newVal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim().length > 0) {
      onSubmit(value.trim());
    }
  };

  // Calcul du nombre de tirets à afficher (Min 8, Max 25)
  const totalChars = Math.max(8, Math.min(25, value.length + 1)); 

  return (
    <div 
      className="flex flex-col items-center cursor-text select-none group"
      // onClick retiré ici pour un contrôle précis via l'input lui-même
    >
      {/* Zone de texte descriptive */}
      <div className="text-[10px] md:text-xs font-bold tracking-[0.2em] text-white/40 uppercase mb-4 group-hover:text-white/60 transition-colors">
        Entrer votre nom
      </div>

      {/* Zone de saisie (Tirets) */}
      <div className="relative flex items-center justify-center gap-2 h-12">
        {/* L'input invisible qui capture la saisie */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          // Modification de la zone de clique: 
          // h-32 (128px) pour monter haut
          // bottom-0 pour s'arrêter exactement en bas du conteneur (au niveau des tirets)
          className="absolute bottom-0 left-0 w-full h-32 opacity-0 cursor-text z-10"
          autoComplete="off"
          autoFocus
        />

        {/* Le rendu visuel des tirets */}
        {Array.from({ length: totalChars }).map((_, i) => {
          const char = value[i] || '';
          const isActive = i === value.length; // La position du curseur

          return (
            <div 
              key={i} 
              className="flex flex-col items-center w-4 md:w-5"
            >
              {/* La lettre */}
              <span className="text-xl md:text-2xl font-bold text-white h-8 mb-2 tracking-wider">
                {char}
              </span>
              
              {/* Le tiret (Ligne) */}
              <div 
                className={`h-[2px] w-full transition-all duration-200 ${
                  isActive 
                    ? 'bg-red-600 animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)] scale-x-110' // Curseur Rouge Actif
                    : 'bg-white/30 group-hover:bg-white/40' // Tiret Inactif
                }`}
              />
            </div>
          );
        })}
      </div>
      
      {/* Compteur supprimé comme demandé */}
    </div>
  );
};
