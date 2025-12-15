import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '@/lib/state/uiStore';

interface NameInputProps {
  onSubmit: (name: string) => void;
}

export const NameInput = ({ onSubmit }: NameInputProps) => {
  const [value, setValue] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const appState = useUIStore((state) => state.appState);

  useEffect(() => {
    // Fonction pour activer l'état chargé
    const handleLoad = () => setIsLoaded(true);

    // Si le document est déjà complètement chargé (y compris ressources externes)
    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      // Sinon on attend l'événement load global qui marque la fin du spinner du navigateur
      window.addEventListener('load', handleLoad);
    }

    return () => {
      window.removeEventListener('load', handleLoad);
    };
  }, []);

  // Focus permanent pour garantir la saisie immédiate
  useEffect(() => {
    const keepFocus = () => {
      if (appState === 'sleeping' && inputRef.current) {
        // Petit délai pour s'assurer que le DOM est prêt ou que l'événement précédent est fini
        setTimeout(() => {
          inputRef.current?.focus();
        }, 10);
      }
    };

    // Focus initial
    keepFocus();

    // Récupérer le focus si on clique n'importe où sur la page
    const handleGlobalClick = () => keepFocus();
    
    // Récupérer le focus si on essaie de tabuler ou quitter
    const handleBlur = () => keepFocus();

    window.addEventListener('click', handleGlobalClick);
    const inputEl = inputRef.current;
    if (inputEl) {
      inputEl.addEventListener('blur', handleBlur);
    }

    return () => {
      window.removeEventListener('click', handleGlobalClick);
      if (inputEl) {
        inputEl.removeEventListener('blur', handleBlur);
      }
    };
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
      <style>{`
        @keyframes blink-red {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
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
                style={isActive && isLoaded ? { animation: 'blink-red 0.75s infinite' } : {}}
                className={`h-[2px] w-full transition-all duration-200 ${
                  isActive 
                    ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)] scale-x-110' // Curseur Rouge Actif
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
