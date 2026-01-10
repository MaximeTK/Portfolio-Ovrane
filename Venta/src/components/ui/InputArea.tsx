import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';

interface InputAreaProps {
  onSubmit: (text: string) => void;
  onInputChange?: (text: string) => void;
  onInputFocus?: () => void;
  placeholder?: string;
  triggerWave?: () => void;
  maxLength?: number;
  className?: string;
  isLoading?: boolean;
  tipsEnabled?: boolean;
  tipsUrl?: string; // ex: "/astuces.txt"
  suggestionsEnabled?: boolean;
  suggestionsUrl?: string; // ex: "/propositions.txt"
}

export function InputArea({ 
  onSubmit, 
  onInputChange, 
  onInputFocus,
  placeholder = "Posez moi une question", 
  triggerWave,
  maxLength = 5000,
  className,
  isLoading = false,
  tipsEnabled = true,
  tipsUrl = '/astuces.txt',
  suggestionsEnabled = true,
  suggestionsUrl = '/propositions.txt',
}: InputAreaProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSingleLine, setIsSingleLine] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ===== Propositions (placeholder dynamique) =====
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState<string>('');
  const suggestionCursorRef = useRef(0);
  const suggestionsLoadedRef = useRef(false);

  // ===== Astuces =====
  const [tips, setTips] = useState<string[]>([]);
  const [activeTip, setActiveTip] = useState<string>('');
  const [isTipVisible, setIsTipVisible] = useState(false);
  const tipCursorRef = useRef(0);
  const tipsLoadedRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  // Ajuster la hauteur du textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      
      const scrollHeight = textarea.scrollHeight;
      // Seuil ~60px pour padding + line-height (1 ligne)
      const isSingle = scrollHeight < 60;
      setIsSingleLine(isSingle);
      
      // Limite max height à 200px
      const newHeight = Math.min(textarea.scrollHeight, 200); 
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  // Charger les propositions depuis le fichier .txt (une seule fois)
  useEffect(() => {
    if (!suggestionsEnabled) return;
    if (suggestionsLoadedRef.current) return;
    suggestionsLoadedRef.current = true;

    const loadSuggestions = async () => {
      try {
        const res = await fetch(suggestionsUrl, { cache: 'no-store' });
        if (!res.ok) return;
        const text = await res.text();

        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith('#'));

        if (lines.length > 0) {
          setSuggestions(lines);
          // Première proposition immédiate
          setActiveSuggestion(lines[0] || '');
          suggestionCursorRef.current = 1;
        }
      } catch {
        // Silencieux : les propositions sont optionnelles
      }
    };

    loadSuggestions();
  }, [suggestionsEnabled, suggestionsUrl]);

  const rotateSuggestion = () => {
    if (!suggestionsEnabled) return;
    if (!suggestions || suggestions.length === 0) return;
    const idx = suggestionCursorRef.current % suggestions.length;
    suggestionCursorRef.current = idx + 1;
    setActiveSuggestion(suggestions[idx] || '');
  };

  // Charger les astuces depuis le fichier .txt (une seule fois)
  useEffect(() => {
    if (!tipsEnabled) return;
    if (tipsLoadedRef.current) return;

    tipsLoadedRef.current = true;

    const loadTips = async () => {
      try {
        const res = await fetch(tipsUrl, { cache: 'no-store' });
        if (!res.ok) return;
        const text = await res.text();

        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith('#'));

        if (lines.length > 0) {
          setTips(lines);
        }
      } catch {
        // Silencieux : les astuces sont optionnelles
      }
    };

    loadTips();
  }, [tipsEnabled, tipsUrl]);

  // Timer: toutes les 180s afficher une astuce 15s
  useEffect(() => {
    // Nettoyage
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsTipVisible(false);

    if (!tipsEnabled) return;
    if (!tips || tips.length === 0) return;

    const showTip = () => {
      if (!tips || tips.length === 0) return;

      // Stopper le hide précédent si nécessaire
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      const idx = tipCursorRef.current % tips.length;
      tipCursorRef.current = (idx + 1) % tips.length;
      setActiveTip(tips[idx] || '');
      setIsTipVisible(true);

      hideTimeoutRef.current = window.setTimeout(() => {
        setIsTipVisible(false);
        hideTimeoutRef.current = null;
      }, 15000);
    };

    // Première astuce après 180 secondes
    intervalRef.current = window.setInterval(showTip, 180000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [tipsEnabled, tips]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;

    // Reset UI
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    // Changer la proposition à chaque envoi
    rotateSuggestion();

    // Effets visuels
    triggerWave?.();

    // Callback parent
    onSubmit(text);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setInputValue(newVal);
    onInputChange?.(newVal);
  };

  return (
    <div className={`relative ${className || ''}`}>
      {/* Bulle d'astuce (toutes les 180s, 15s) */}
      {tipsEnabled && activeTip && (
        <div
          className={`absolute -top-12 left-1/2 -translate-x-1/2 w-[min(520px,90%)] transition-all duration-300 ease-out ${
            isTipVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
          aria-hidden={!isTipVisible}
        >
          <div className="mx-auto w-full text-white/90 text-xs md:text-sm text-center drop-shadow-md truncate">
            {activeTip}
          </div>
        </div>
      )}

      {/* Indicateur de limite de caractères */}
      <div 
        className={`absolute -top-6 right-2 text-xs font-mono transition-all duration-300 ${
          inputValue.length >= maxLength ? 'text-red-500' : 'text-white'
        } ${
          inputValue.length > (maxLength * 0.9) ? 'opacity-25' : 'opacity-0'
        }`}
      >
        {inputValue.length} / {maxLength}
      </div>

      <div className="relative rounded-2xl overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 pr-4">
        <style jsx>{`
          .scrollbar-shorter::-webkit-scrollbar-track {
            margin-bottom: 30px;
            margin-top: 12px;
            background: transparent;
            cursor: default;
          }
          .scrollbar-shorter::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            border: 3px solid transparent;
            background-clip: content-box;
            cursor: default;
          }
          .scrollbar-shorter::-webkit-scrollbar {
            width: 12px;
            cursor: default;
          }
        `}</style>
        <form onSubmit={handleSubmit} className="relative z-10 w-full flex items-center">
          <textarea
            ref={textareaRef}
            value={inputValue}
            maxLength={maxLength}
            rows={1}
            onChange={handleChange}
            onFocus={onInputFocus}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={suggestionsEnabled && activeSuggestion ? activeSuggestion : placeholder}
            className={`scrollbar-shorter w-full bg-transparent text-white placeholder-gray-300 outline-none focus:outline-none resize-none overflow-y-auto max-h-[200px] pl-4 pr-4 ${
              isSingleLine ? 'py-3' : 'py-3'
            }`}
            aria-label="Question"
            style={{
              minHeight: '24px',
              maskImage: 'linear-gradient(to bottom, transparent 0px, black 12px, black calc(100% - 12px), transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 12px, black calc(100% - 12px), transparent 100%)'
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className={`absolute right-0 group bg-transparent text-white p-1 rounded-md transition-colors flex items-center justify-center ${
              isSingleLine ? 'top-1/2 -translate-y-1/2' : 'bottom-2'
            } ${isLoading || !inputValue.trim() ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label="Envoyer"
          >
            <Image
              src="/send.png"
              alt=""
              width={24}
              height={24}
              className={`w-5 h-5 transition duration-200 ${isLoading || !inputValue.trim() ? '' : 'group-hover:brightness-75'}`}
            />
          </button>
        </form>
      </div>
    </div>
  );
}

