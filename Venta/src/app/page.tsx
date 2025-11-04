'use client';

import { useEffect, useState } from 'react';
import { useAudioVisualization } from '@/hooks/useAudioVisualization';
import { useChatController } from '@/lib/stream/useChatController';
import { useAnimations } from '@/hooks/useAnimations';
import { useTTS } from '@/hooks/useTTS';
import { ImageOverlay } from '@/components/ui/ImageOverlay';
import { SectionHighlight } from '@/components/ui/SectionHighlight';
import { HexagonalAnimation } from '@/components/ui/HexagonalAnimation';
import CommandProcessor from '@/components/ui/CommandProcessor';

export default function Home() {
  const [transcript, setTranscript] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [currentAnimation, setCurrentAnimation] = useState<'standby' | 'thinking' | 'speak'>('standby');
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState<string>('');
  
  const { setupAudioVisualization, cleanup } = useAudioVisualization();
  const { send: sendChatMessage, status: chatStatus, currentTranscript, lastCommands, currentUserId, currentTTS } = useChatController();
  const { 
    startStandbyAnimation, 
    startThinkingAnimation, 
    startSpeakAnimation 
  } = useAnimations();
  const { isSpeaking, audioLevel, speakWithAPI, speakWithBase64, speakWithBrowser } = useTTS();

  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        window.speechSynthesis.getVoices();
      });
    }
    return () => cleanup();
  }, [cleanup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = inputValue.trim();
    if (!question) return;

    setInputValue('');
    setLastProcessedTranscript('');
    setShowTranscript(false);
    setCurrentAnimation('thinking');
    startThinkingAnimation();
    sendChatMessage(question);
  };

  useEffect(() => {
    if (chatStatus === 'idle' && currentTranscript && currentTranscript !== lastProcessedTranscript) {
      setTranscript(currentTranscript);
      setShowTranscript(true);
      setLastProcessedTranscript(currentTranscript);
      setCurrentAnimation('speak');
      startSpeakAnimation();
      
      const onEnd = () => {
        setShowTranscript(false);
        setCurrentAnimation('standby');
        startStandbyAnimation();
      };
      
      // Utiliser l'audio reçu directement si disponible, sinon fallback sur l'API
      if (currentTTS && currentTTS.audio && !currentTTS.useClientTTS) {
        // Audio déjà généré par le backend, on l'utilise directement
        speakWithBase64(currentTTS.audio, setupAudioVisualization, onEnd);
      } else if (currentTTS && currentTTS.useClientTTS) {
        // Fallback côté client demandé par le backend
        speakWithBrowser(currentTranscript, onEnd);
      } else {
        // Pas de TTS dans la réponse, utiliser l'API (compatibilité ascendante)
        speakWithAPI(currentTranscript, setupAudioVisualization, onEnd);
      }
    }
  }, [chatStatus, currentTranscript, lastProcessedTranscript, currentTTS, startSpeakAnimation, startStandbyAnimation, speakWithAPI, speakWithBase64, speakWithBrowser, setupAudioVisualization]);

  return (
    <>
      <div className="min-h-screen text-white font-sans overflow-hidden relative">
        <nav className="fixed top-0 left-0 right-0 h-16 flex items-center justify-center px-4 z-50">
          <div className="flex gap-12">
            <a href="#profil" className="text-white uppercase tracking-wider text-sm font-medium hover:text-blue-400 transition-colors">PROFIL</a>
            <a href="#portfolio" className="text-white uppercase tracking-wider text-sm font-medium hover:text-blue-400 transition-colors">PORTFOLIO</a>
            <a href="#accueil" className="text-white uppercase tracking-wider text-sm font-medium hover:text-blue-400 transition-colors">ACCUEIL</a>
            <a href="#contact" className="text-white uppercase tracking-wider text-sm font-medium hover:text-blue-400 transition-colors">CONTACT</a>
            <a href="#reseaux" className="text-white uppercase tracking-wider text-sm font-medium hover:text-blue-400 transition-colors">RESEAUX</a>
          </div>
        </nav>

        <main className="flex items-center justify-center min-h-screen">
          <HexagonalAnimation
            currentAnimation={currentAnimation}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
          />
        </main>

        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-[min(600px,90vw)] z-30">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Posez moi une question"
              className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder-gray-400"
              aria-label="Question"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Envoyer
            </button>
          </form>
        </div>

        {showTranscript && (
          <output 
            className="fixed left-1/2 transform -translate-x-1/2 bottom-24 w-[min(600px,90vw)] px-4 py-3 rounded-lg bg-gray-900/80 border border-gray-700 backdrop-blur-md text-gray-300 text-sm whitespace-pre-wrap max-h-[20vh] overflow-auto shadow-lg z-20"
            aria-live="polite"
          >
            {transcript}
          </output>
        )}

        <div id="profil" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="portfolio" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="accueil" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="contact" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="reseaux" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
      </div>

      <ImageOverlay />
      <SectionHighlight />
      
      {lastCommands && lastCommands.length > 0 && (
        <CommandProcessor 
          commands={lastCommands} 
          onCommandsProcessed={() => {}}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
