import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useUIStore } from '@/lib/uiStore';

const MAX_LENGTH = 5000;
const PLACEHOLDER = 'Posez-moi une question';

// Lignes utiles d'un fichier de public/ : ni vides ni commentaires
const lireLignes = (url: string) =>
  fetch(url)
    .then((res) => (res.ok ? res.text() : ''))
    .then((texte) => texte.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')))
    .catch(() => [] as string[]);

// Propositions et astuces, lues une seule fois pour toute la visite
let textes: Promise<string[][]> | undefined;

interface InputAreaProps {
  onSubmit: (text: string) => void;
  triggerWave?: () => void;
  isLoading?: boolean;
  tipsEnabled?: boolean;
}

export function InputArea({ onSubmit, triggerWave, isLoading = false, tipsEnabled = true }: InputAreaProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSingleLine, setIsSingleLine] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Propositions : placeholder qui change à chaque envoi
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [tips, setTips] = useState<string[]>([]);
  const [activeTip, setActiveTip] = useState('');
  const [isTipVisible, setIsTipVisible] = useState(false);
  const sonCoupe = useUIStore((s) => s.sonCoupe);
  const basculerSon = useUIStore((s) => s.basculerSon);

  // Hauteur suivant le texte jusqu'à 200 px ; au-delà de ~60 px, il y a plus d'une ligne
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    setIsSingleLine(textarea.scrollHeight < 60);
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [inputValue]);

  useEffect(() => {
    textes ??= Promise.all([lireLignes('/propositions.txt'), lireLignes('/astuces.txt')]);
    textes.then(([propositions, astuces]) => {
      setSuggestions(propositions);
      setTips(astuces);
    });
  }, []);

  // Toutes les 3 minutes, une astuce pendant 15 s, à tour de rôle
  useEffect(() => {
    setIsTipVisible(false);
    if (!tipsEnabled || !tips.length) return;
    let index = 0;
    let masquer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      setActiveTip(tips[index++ % tips.length]);
      setIsTipVisible(true);
      clearTimeout(masquer);
      masquer = setTimeout(() => setIsTipVisible(false), 15_000);
    }, 180_000);
    return () => {
      clearInterval(interval);
      clearTimeout(masquer);
    };
  }, [tipsEnabled, tips]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    setSuggestionIndex((i) => i + 1);
    triggerWave?.();
    onSubmit(text);
  };

  const disabled = isLoading || !inputValue.trim();

  return (
    <div className="relative">
      {tipsEnabled && activeTip && (
        <div
          className={`absolute bottom-full mb-7 left-1/2 -translate-x-1/2 w-[min(520px,90%)] transition-all duration-300 ease-out ${
            isTipVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
          aria-hidden={!isTipVisible}
        >
          <div className="mx-auto w-full text-white/90 text-xs md:text-sm text-center drop-shadow-md line-clamp-2">{activeTip}</div>
        </div>
      )}

      {/* Compteur, visible à l'approche de la limite */}
      <div
        className={`absolute -top-6 right-2 text-xs font-mono transition-all duration-300 ${
          inputValue.length >= MAX_LENGTH ? 'text-red-500' : 'text-white'
        } ${inputValue.length > MAX_LENGTH * 0.9 ? 'opacity-25' : 'opacity-0'}`}
      >
        {inputValue.length} / {MAX_LENGTH}
      </div>

      <div className="relative rounded-2xl overflow-hidden bg-(--verre) backdrop-blur-xl border border-white/10 pr-4 focus-within:ring-2 focus-within:ring-white/40">
        <form onSubmit={handleSubmit} className="relative z-10 w-full flex items-center">
          <textarea
            ref={textareaRef}
            value={inputValue}
            maxLength={MAX_LENGTH}
            rows={1}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e);
            }}
            placeholder={suggestions.length ? suggestions[suggestionIndex % suggestions.length] : PLACEHOLDER}
            className="custom-scrollbar w-full bg-transparent text-white placeholder-gray-300 outline-none resize-none overflow-y-auto max-h-[200px] pl-4 pr-16 py-3"
            aria-label="Question"
            style={{
              minHeight: '24px',
              maskImage: 'linear-gradient(to bottom, transparent 0px, black 12px, black calc(100% - 12px), transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 12px, black calc(100% - 12px), transparent 100%)',
            }}
          />
          <button
            type="button"
            onClick={basculerSon}
            aria-pressed={sonCoupe}
            aria-label={sonCoupe ? 'Rétablir la voix' : 'Couper la voix'}
            title={sonCoupe ? 'Rétablir la voix' : 'Couper la voix'}
            className={`absolute right-8 p-1 rounded-md text-white/70 transition-colors hover:text-white ${isSingleLine ? 'top-1/2 -translate-y-1/2' : 'bottom-2'}`}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              {sonCoupe ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />}
            </svg>
          </button>
          <button
            type="submit"
            disabled={disabled}
            className={`absolute right-0 group bg-transparent text-white p-1 rounded-md transition-colors flex items-center justify-center ${
              isSingleLine ? 'top-1/2 -translate-y-1/2' : 'bottom-2'
            } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label="Envoyer"
          >
            <Image
              src="/send.png"
              alt=""
              width={24}
              height={24}
              className={`w-5 h-5 transition duration-200 ${disabled ? '' : 'group-hover:brightness-75'}`}
            />
          </button>
        </form>
      </div>
    </div>
  );
}
