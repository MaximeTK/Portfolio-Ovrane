'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAudioVisualization } from '@/hooks/setupAudioVisualization';
import { useChatController } from '@/lib/stream/useChatController';
import { useAnimations } from '@/hooks/useAnimations';
import { useTTS } from '@/hooks/useTTS';
import { HexagonalAnimation, HexagonalAnimationHandle } from '@/components/ui/HexagonalAnimation';
import CommandProcessor from '@/components/Fonction AI/CommandProcessor';
import { TextWindowsManager } from '@/components/ui/GlassmorphismeWindow';
import { useUIStore } from '@/lib/state/uiStore';
import { InputArea } from '@/components/ui/InputArea';
import { IntroSequence } from '@/components/intro/IntroSequence';
import { MessagingView } from '@/components/chat/MessagingView';

export default function Home() {
  const [_inputValue, setInputValue] = useState('');
  const [scrollTrigger, setScrollTrigger] = useState(0); // Trigger pour le scroll
  const [currentAnimation, setCurrentAnimation] = useState<'standby' | 'thinking' | 'speak'>('standby');
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState<string>('');
  
  // Ref pour traquer si c'est la toute première réponse (bienvenue)
  const isFirstResponseRef = useRef(true);
  const isNewAccountRef = useRef(false);
  const hasSentFirstRealUserMessageRef = useRef(false);
  const pendingMessagingHintAfterResponseRef = useRef(false);
  const messagingHintTimerRef = useRef<number | null>(null);
  const [overlayOverrideText, setOverlayOverrideText] = useState<string | null>(null);

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
  const { isSpeaking, getAudioLevel, speakWithAPI, speakWithBase64, speakWithBrowser, speakWithUrl } = useTTS();
  const addTextWindow = useUIStore((state) => state.addTextWindow);
  const closeTextWindow = useUIStore((state) => state.closeTextWindow);
  const closeAllWindows = useUIStore((state) => state.closeAllWindows);
  const appState = useUIStore((state) => state.appState);
  const viewMode = useUIStore((state) => state.viewMode);
  const isAppLocked = useUIStore((state) => state.isAppLocked);

  // Mémoriser "nouveau compte" dès qu'on le sait (évite que l'API flippe isNewUser ensuite)
  useEffect(() => {
    if (currentUserProfile?.isNewUser) {
      isNewAccountRef.current = true;
    }
  }, [currentUserProfile?.isNewUser]);

  // Reset onboarding quand on change de profil
  useEffect(() => {
    hasSentFirstRealUserMessageRef.current = false;
    pendingMessagingHintAfterResponseRef.current = false;
    setOverlayOverrideText(null);
    if (messagingHintTimerRef.current !== null) {
      window.clearTimeout(messagingHintTimerRef.current);
      messagingHintTimerRef.current = null;
    }
  }, [currentUserId]);

  // Cacher l'overlay dès qu'on passe en messagerie
  useEffect(() => {
    if (viewMode === 'messaging') {
      setOverlayOverrideText(null);
      if (messagingHintTimerRef.current !== null) {
        window.clearTimeout(messagingHintTimerRef.current);
        messagingHintTimerRef.current = null;
      }
    }
  }, [viewMode]);

  // Callback stable pour CommandProcessor
  const handleCommandsProcessed = useCallback(() => {
    // Optionnel : Logique post-traitement si nécessaire
  }, []);

  // Fermer toutes les fenêtres (TextWindows) quand l'utilisateur change
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
      // IMPORTANT: la 1ère réponse (welcome) peut arriver pendant appState='processing'.
      // On doit donc consommer isFirstResponseRef même si on n'est pas encore "awake",
      // sinon la réponse suivante (ex: image) sera traitée à tort comme "première" et la fenêtre texte ne s'affichera jamais.
      const isFirst = isFirstResponseRef.current;
      if (isFirst) {
        isFirstResponseRef.current = false;
      } else if (currentTranscript.trim() !== '') {
        // Pour les messages suivants, on ajoute une NOUVELLE fenêtre SEULEMENT SI LE TEXTE N'EST PAS VIDE.
        // Note: même si on est en mode messagerie, on garde la fenêtre en "background" pour que le Dashboard
        // affiche bien le texte + les images (CommandProcessor) quand on bascule de mode.
        addTextWindow(currentTranscript);
      }

      // Onboarding "messagerie" : afficher après la réponse IA au 1er message utilisateur (InputArea),
      // uniquement pour un nouveau compte, en dashboard.
      if (
        pendingMessagingHintAfterResponseRef.current &&
        !isAppLocked &&
        viewMode !== 'messaging' &&
        currentUserId
      ) {
        const storageKey = `vanta:onboarding:messagingHintSeen:${currentUserId}`;
        let alreadySeen = false;
        try {
          if (typeof window !== 'undefined') {
            alreadySeen = window.localStorage.getItem(storageKey) === '1';
          }
        } catch {
          alreadySeen = false;
        }

        if (!alreadySeen) {
          setOverlayOverrideText('Vous pouvez accéder à la messagerie en cliquant sur OVRANE au centre');
          try {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(storageKey, '1');
            }
          } catch {
            // ignore
          }

          if (messagingHintTimerRef.current !== null) {
            window.clearTimeout(messagingHintTimerRef.current);
            messagingHintTimerRef.current = null;
          }
          messagingHintTimerRef.current = window.setTimeout(() => {
            setOverlayOverrideText(null);
            messagingHintTimerRef.current = null;
          }, 20000);
        }

        pendingMessagingHintAfterResponseRef.current = false;
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
      } else if (currentTTS && currentTTS.isStaticFile && currentTTS.staticUrl) {
         // Lecture fichier statique (ex: fin de session)
         speakWithUrl(currentTTS.staticUrl, setupAudioVisualization, onEnd);
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
          overlayOverrideText={overlayOverrideText}
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
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 w-[min(600px,90vw)] z-30 transition-all duration-1000 delay-1000 ${appState === 'awake' && !isAppLocked ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
          <InputArea
            onSubmit={(text) => {
              setInputValue('');
              setLastProcessedTranscript('');
              setScrollTrigger(prev => prev + 1);
              setCurrentAnimation('thinking');
              startThinkingAnimation();

              // Marquer le 1er vrai message utilisateur (champ de texte)
              if (
                !hasSentFirstRealUserMessageRef.current &&
                isNewAccountRef.current &&
                currentUserId
              ) {
                // Ne pas re-montrer si déjà vu pour ce profil
                const storageKey = `vanta:onboarding:messagingHintSeen:${currentUserId}`;
                let alreadySeen = false;
                try {
                  if (typeof window !== 'undefined') {
                    alreadySeen = window.localStorage.getItem(storageKey) === '1';
                  }
                } catch {
                  alreadySeen = false;
                }

                if (!alreadySeen) {
                  pendingMessagingHintAfterResponseRef.current = true;
                }
                hasSentFirstRealUserMessageRef.current = true;
              }

              sendChatMessage(text);
            }}
            triggerWave={() => hexAnimationRef.current?.triggerWave()}
            onInputChange={setInputValue}
            isLoading={currentAnimation === 'thinking'}
            tipsEnabled={appState === 'awake' && !isAppLocked}
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

