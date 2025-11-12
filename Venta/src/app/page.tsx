'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAudioVisualization } from '@/hooks/useAudioVisualization';
import { useChatController } from '@/lib/stream/useChatController';
import { useAnimations } from '@/hooks/useAnimations';
import { useTTS } from '@/hooks/useTTS';
import { ImageOverlay } from '@/components/ui/ImageOverlay';
import { SectionHighlight } from '@/components/ui/SectionHighlight';
import { HexagonalAnimation } from '@/components/ui/HexagonalAnimation';
import CommandProcessor from '@/components/ui/CommandProcessor';
import { TextWindow } from '@/components/ui/TextWindow';
import { useUIStore } from '@/lib/state/uiStore';

export default function Home() {
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
  const showTextWindow = useUIStore((state) => state.showTextWindow);
  const hideTextWindow = useUIStore((state) => state.hideTextWindow);

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
    hideTextWindow();
    setCurrentAnimation('thinking');
    startThinkingAnimation();
    sendChatMessage(question);
  };

  useEffect(() => {
    if (chatStatus === 'idle' && currentTranscript && currentTranscript !== lastProcessedTranscript) {
      showTextWindow(currentTranscript);
      setLastProcessedTranscript(currentTranscript);
      setCurrentAnimation('speak');
      startSpeakAnimation();
      
      const onEnd = () => {
        hideTextWindow();
        setCurrentAnimation('standby');
        startStandbyAnimation();
      };
      
      // Utiliser l'audio reçu directement si disponible, sinon fallback sur l'API
      if (currentTTS && currentTTS.audio && !currentTTS.useClientTTS) {
        // Audio déjà généré par le backend, on l'utilise directement
        speakWithBase64(currentTTS.audio, currentTTS.format, setupAudioVisualization, onEnd);
      } else if (currentTTS && currentTTS.useClientTTS) {
        // Fallback côté client demandé par le backend
        speakWithBrowser(currentTranscript, onEnd);
      } else {
        // Pas de TTS dans la réponse, utiliser l'API (compatibilité ascendante)
        speakWithAPI(currentTranscript, setupAudioVisualization, onEnd);
      }
    }
  }, [chatStatus, currentTranscript, lastProcessedTranscript, currentTTS, startSpeakAnimation, startStandbyAnimation, speakWithAPI, speakWithBase64, speakWithBrowser, setupAudioVisualization, showTextWindow, hideTextWindow]);

  return (
    <>
      <div className="min-h-screen text-white font-sans overflow-hidden relative">
        <main className="flex items-center justify-center min-h-screen">
          <HexagonalAnimation
            currentAnimation={currentAnimation}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
          />
        </main>

        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-[min(600px,90vw)] z-30">
          <div className="relative rounded-2xl overflow-hidden">
            <div className="glass-morphisme-background"></div>
            <form
              onSubmit={handleSubmit}
              className="relative z-10 flex items-center gap-3 px-4 py-3"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Posez moi une question"
                className="flex-1 bg-transparent text-white placeholder-gray-300 outline-none focus:outline-none"
                aria-label="Question"
              />
              <button
                type="submit"
                className="group bg-transparent text-white p-2 rounded-md transition-colors flex items-center justify-center"
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

        <div id="profil" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="portfolio" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="accueil" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="contact" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="reseaux" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
      </div>

      <TextWindow />
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
