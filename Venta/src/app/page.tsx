'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
import { IntroSequence } from '@/components/intro/IntroSequence';

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [currentAnimation, setCurrentAnimation] = useState<'standby' | 'thinking' | 'speak'>('standby');
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState<string>('');
  
  // Ref pour traquer si c'est la toute première réponse (bienvenue)
  const isFirstResponseRef = useRef(true);
  
  const { setupAudioVisualization, cleanup } = useAudioVisualization();
  const { send: sendChatMessage, status: chatStatus, currentTranscript, lastCommands, currentUserId, currentTTS, messages, currentUserProfile } = useChatController();
  const { 
    startStandbyAnimation, 
    startThinkingAnimation, 
    startSpeakAnimation 
  } = useAnimations();
  const { isSpeaking, audioLevel, speakWithAPI, speakWithBase64, speakWithBrowser } = useTTS();
  const addTextWindow = useUIStore((state) => state.addTextWindow);
  const closeTextWindow = useUIStore((state) => state.closeTextWindow);
  const appState = useUIStore((state) => state.appState);

  // Callback stable pour CommandProcessor
  const handleCommandsProcessed = useCallback(() => {
    // Optionnel : Logique post-traitement si nécessaire
  }, []);

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
    // Les fenêtres de texte restent ouvertes et on en créera une nouvelle pour la prochaine réponse
    setCurrentAnimation('thinking');
    startThinkingAnimation();
    sendChatMessage(question);
  };

  useEffect(() => {
    if (chatStatus === 'idle' && currentTranscript && currentTranscript !== lastProcessedTranscript) {
      
      // Logique d'affichage de la fenêtre de texte
      if (appState === 'awake') {
        // Si on vient juste de se réveiller (isFirstResponseRef est true),
        // c'est le message de bienvenue -> ON NE L'AFFICHE PAS dans la fenêtre flottante
        // car il est déjà affiché par IntroSequence.
        if (isFirstResponseRef.current) {
          isFirstResponseRef.current = false;
        } else if (currentTranscript.trim() !== '') {
          // Pour les messages suivants, on ajoute une NOUVELLE fenêtre SEULEMENT SI LE TEXTE N'EST PAS VIDE
          addTextWindow(currentTranscript);
        }
      }
      
      setLastProcessedTranscript(currentTranscript);
      setCurrentAnimation('speak');
      startSpeakAnimation();
      
      const onEnd = () => {
        // On ne ferme plus automatiquement la fenêtre de texte à la fin de la parole
        // hideTextWindow(); 
        setCurrentAnimation('standby');
        startStandbyAnimation();
      };
      
      if (currentTTS && currentTTS.audio && !currentTTS.useClientTTS) {
        speakWithBase64(currentTTS.audio, currentTTS.format, setupAudioVisualization, onEnd);
      } else if (currentTTS && currentTTS.useClientTTS) {
        speakWithBrowser(currentTranscript, onEnd);
      } else {
        speakWithAPI(currentTranscript, setupAudioVisualization, onEnd);
      }
    }
  }, [chatStatus, currentTranscript, lastProcessedTranscript, currentTTS, startSpeakAnimation, startStandbyAnimation, speakWithAPI, speakWithBase64, speakWithBrowser, setupAudioVisualization, addTextWindow, closeTextWindow, appState]);

  return (
    <>
      {/* Suppression de la classe bg-[#020106] qui masquait le BackgroundProvider */}
      <div className="min-h-screen text-white font-sans overflow-hidden relative bg-transparent">
        
        {/* INTRO SEQUENCE - Contient le logo en mode Sleep et l'input */}
        <IntroSequence 
          send={sendChatMessage} 
          currentTTS={currentTTS} 
          messages={messages} 
          currentUserProfile={currentUserProfile}
          currentUserId={currentUserId}
        />

        {/* MAIN CONTENT - Visible seulement quand awake */}
        <div className={`fixed inset-0 flex flex-col items-center justify-center transition-opacity duration-1000 ${appState === 'awake' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          
          <main className="flex items-center justify-center min-h-screen w-full">
            {/* L'animation Hexagonale remplace celle de l'intro quand on est éveillé */}
            {appState === 'awake' && (
              <HexagonalAnimation
                currentAnimation={currentAnimation}
                isSpeaking={isSpeaking}
                audioLevel={audioLevel}
                mode="awake" // Mode normal avec visualizer
              />
            )}
          </main>

          {/* Input Form - Barre de chat standard */}
          <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 w-[min(600px,90vw)] z-30 transition-all duration-1000 delay-1000 ${appState === 'awake' ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
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
        </div>

        {/* Sections IDs pour navigation */}
        <div id="profil" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="portfolio" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="accueil" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="contact" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="reseaux" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
      </div>

      {/* Overlays - Toujours présents mais gérés par le store */}
      {appState === 'awake' && (
        <>
          <TextWindow />
          <ImageOverlay />
          <SectionHighlight />
          <CommandProcessor 
            commands={lastCommands || []} 
            onCommandsProcessed={handleCommandsProcessed}
            currentUserId={currentUserId}
          />
        </>
      )}
    </>
  );
}
