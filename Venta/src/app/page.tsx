import { useEffect, useState, useRef, useCallback } from 'react';
import { useAudioVisualization } from '@/hooks/useAudioVisualization';
import { useChatController } from '@/lib/stream/useChatController';
import { useAnimations } from '@/hooks/useAnimations';
import { useTTS } from '@/hooks/useTTS';
import { HexagonalAnimation, HexagonalAnimationHandle } from '@/components/ui/HexagonalAnimation';
import CommandProcessor from '@/components/ui/CommandProcessor';
import { TextWindowsManager } from '@/components/ui/GlassmorphismeWindow';
import { useUIStore } from '@/lib/state/uiStore';
import { InputArea } from '@/components/ui/InputArea';
import { IntroSequence } from '@/components/intro/IntroSequence';
import { MessagingView } from '@/components/chat/MessagingView';

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [scrollTrigger, setScrollTrigger] = useState(0); // Trigger pour le scroll
  const [currentAnimation, setCurrentAnimation] = useState<'standby' | 'thinking' | 'speak'>('standby');
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState<string>('');
  
  // Ref pour traquer si c'est la toute première réponse (bienvenue)
  const isFirstResponseRef = useRef(true);

  // Ref pour l'animation hexagonale (pour déclencher des vagues manuelles)
  const hexAnimationRef = useRef<HexagonalAnimationHandle>(null);

  const { setupAudioVisualization, cleanup } = useAudioVisualization();
  const { 
    send: sendChatMessage, 
    status: chatStatus, 
    currentTranscript, 
    lastCommands, 
    currentUserId, 
    currentTTS, 
    messages, 
    currentUserProfile, 
    loadMoreMessages,
    hasMoreMessages
  } = useChatController();
  const { 
    startStandbyAnimation, 
    startThinkingAnimation, 
    startSpeakAnimation 
  } = useAnimations();
  const { isSpeaking, getAudioLevel, speakWithAPI, speakWithBase64, speakWithBrowser } = useTTS();
  const addTextWindow = useUIStore((state) => state.addTextWindow);
  const closeTextWindow = useUIStore((state) => state.closeTextWindow);
  const closeAllWindows = useUIStore((state) => state.closeAllWindows);
  const appState = useUIStore((state) => state.appState);
  const viewMode = useUIStore((state) => state.viewMode);

  // Callback stable pour CommandProcessor
  const handleCommandsProcessed = useCallback(() => {
    // Optionnel : Logique post-traitement si nécessaire
  }, []);

  // Fermer toutes les fenêtres (TextWindows, ImageOverlay) quand l'utilisateur change
  useEffect(() => {
    if (currentUserId) {
      closeAllWindows();
    }
  }, [currentUserId, closeAllWindows]);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        window.speechSynthesis.getVoices();
      });
    }
    return () => cleanup();
  }, [cleanup]);

  useEffect(() => {
    if (chatStatus === 'idle' && currentTranscript && currentTranscript !== lastProcessedTranscript) {
      
      // Logique d'affichage de la fenêtre de texte
      // Sur mobile (viewMode messaging) on n'affiche pas les fenêtres flottantes
      // On utilise une simple classe CSS media query pour masquer sur mobile, 
      // mais ici on peut aussi empêcher la création si on détecte le mode messagerie
      if (appState === 'awake') {
        // Si on vient juste de se réveiller (isFirstResponseRef est true),
        // c'est le message de bienvenue -> ON NE L'AFFICHE PAS dans la fenêtre flottante
        // car il est déjà affiché par IntroSequence.
        if (isFirstResponseRef.current) {
          isFirstResponseRef.current = false;
        } else if (currentTranscript.trim() !== '') {
          // Pour les messages suivants, on ajoute une NOUVELLE fenêtre SEULEMENT SI LE TEXTE N'EST PAS VIDE
          // ET si on n'est pas en mode messagerie (bien que masqué par CSS, c'est mieux d'éviter la logique inutile)
          if (viewMode !== 'messaging') {
            addTextWindow(currentTranscript);
          }
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
      
      // Pas de TTS en mode messagerie
      if (viewMode === 'messaging') {
        onEnd(); // On termine immédiatement l'animation
      } else if (currentTTS && currentTTS.audio && !currentTTS.useClientTTS) {
        speakWithBase64(currentTTS.audio, currentTTS.format, setupAudioVisualization, onEnd);
      } else if (currentTTS && currentTTS.useClientTTS) {
        speakWithBrowser(currentTranscript, onEnd);
      } else {
        speakWithAPI(currentTranscript, setupAudioVisualization, onEnd);
      }
    }
  }, [chatStatus, currentTranscript, lastProcessedTranscript, currentTTS, startSpeakAnimation, startStandbyAnimation, speakWithAPI, speakWithBase64, speakWithBrowser, setupAudioVisualization, addTextWindow, closeTextWindow, appState, viewMode]);

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

        {/* Interface de Messagerie (Z-10, derrière le contenu principal) */}
        <MessagingView 
          messages={messages} 
          onLoadHistory={loadMoreMessages}
          hasMoreMessages={hasMoreMessages}
          visible={appState === 'awake' && viewMode === 'messaging'}
          scrollTrigger={scrollTrigger}
        />

        {/* MAIN CONTENT - Hexagone */}
        <div className={`fixed inset-0 flex flex-col items-center justify-center transition-all duration-500 ${appState === 'awake' ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${viewMode === 'messaging' ? '-translate-y-[4vh]' : ''}`}>
          <main className="flex items-center justify-center min-h-screen w-full relative z-30 pointer-events-none">
            {/* L'animation Hexagonale remplace celle de l'intro quand on est éveillé */}
            {appState === 'awake' && (
              <div className="pointer-events-auto">
                <HexagonalAnimation
                  ref={hexAnimationRef}
                  currentAnimation={currentAnimation}
                  isSpeaking={isSpeaking}
                  getAudioLevel={getAudioLevel}
                  mode="awake" // Mode normal avec visualizer
                />
              </div>
            )}
          </main>
        </div>

        {/* Input Form - Sorti du conteneur principal pour garantir le Z-Index 30 */}
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 w-[min(600px,90vw)] z-30 transition-all duration-1000 delay-1000 ${appState === 'awake' ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
          <InputArea
            onSubmit={(text) => {
              setInputValue('');
              setLastProcessedTranscript('');
              setScrollTrigger(prev => prev + 1);
              setCurrentAnimation('thinking');
              startThinkingAnimation();
              sendChatMessage(text);
            }}
            triggerWave={() => hexAnimationRef.current?.triggerWave()}
            onInputChange={setInputValue}
          />
        </div>

        {/* Sections IDs pour navigation */}
        <div id="profil" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="portfolio" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="accueil" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="contact" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
        <div id="reseaux" className="absolute top-0 left-0 w-full h-0 pointer-events-none"></div>
      </div>

      {/* Overlays - Toujours présents mais gérés par le store et masqués sur mobile via CSS/Logique */}
      {appState === 'awake' && (
        <div className={viewMode === 'messaging' ? 'hidden' : 'block md:block hidden:max-md'}>
          {/* hidden:max-md -> masqué sur mobile (taille < md) même en mode dashboard */}
          <div className="hidden md:block">
            <TextWindowsManager />
            <CommandProcessor 
              commands={lastCommands || []} 
              onCommandsProcessed={handleCommandsProcessed}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      )}
    </>
  );
}
