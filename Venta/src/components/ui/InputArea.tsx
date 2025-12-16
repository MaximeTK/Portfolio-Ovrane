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
}

export function InputArea({ 
  onSubmit, 
  onInputChange, 
  onInputFocus,
  placeholder = "Posez moi une question", 
  triggerWave,
  maxLength = 5000,
  className
}: InputAreaProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSingleLine, setIsSingleLine] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;

    // Reset UI
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

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
            placeholder={placeholder}
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
            className={`absolute right-0 group bg-transparent text-white p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
              isSingleLine ? 'top-1/2 -translate-y-1/2' : 'bottom-2'
            }`}
            aria-label="Envoyer"
          >
            <Image
              src="/send.png"
              alt=""
              width={24}
              height={24}
              className="w-5 h-5 transition duration-200 group-hover:brightness-75"
            />
          </button>
        </form>
      </div>
    </div>
  );
}

