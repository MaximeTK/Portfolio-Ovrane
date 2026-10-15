'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAudioVisualization } from '@/features/oeil/useAudioVisualization';
import { useTTS } from '@/features/oeil/useTTS';
import { HexagonalAnimation, type HexagonalAnimationHandle } from '@/features/oeil/HexagonalAnimation';
import { useChatController } from '@/features/chat/useChatController';
import { InputArea } from '@/features/chat/InputArea';
import { WindowsManager } from '@/features/fenetres/GlassmorphismeWindow';
import { SiteHeader } from '@/features/site/SiteHeader';
import { PageView } from '@/features/site/PageView';
import { useUIStore, CLE_SON, CLE_VERRE } from '@/lib/uiStore';
import { CHAT_UI } from '@/lib/messages';
import { IntroSequence } from './IntroSequence';

const MessagingView = dynamic(() => import('@/features/chat/MessagingView').then((m) => m.MessagingView));

export default function HomeClient() {
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [currentAnimation, setCurrentAnimation] = useState<'standby' | 'thinking' | 'speak'>('standby');
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState('');
  const [messagingOpened, setMessagingOpened] = useState(false);
  const [messagingHint, setMessagingHint] = useState(false);
  // Astuce de messagerie d'un nouveau profil : armée à sa création, due à son premier message, montrée quand la réponse commence
  const hintStepRef = useRef<'armed' | 'due' | null>(null);
  // Seules les réponses à une question ouvrent une fenêtre, pas l'accueil
  const questionAskedRef = useRef(false);
  const hexAnimationRef = useRef<HexagonalAnimationHandle>(null);

  const { setupAudioVisualization } = useAudioVisualization();
  const { send, sendAuth, status, currentTranscript, currentTTS, currentUserId, isNewProfile, messages, loadMoreMessages, hasMoreMessages } =
    useChatController();
  const { isSpeaking, getAudioLevel, speakWithQueue, speakWithUrl, stop: stopTTS } = useTTS();
  const addWindow = useUIStore((state) => state.addWindow);
  const appState = useUIStore((state) => state.appState);
  const setAppState = useUIStore((state) => state.setAppState);
  const viewMode = useUIStore((state) => state.viewMode);
  const page = useUIStore((state) => state.page);
  const isAppLocked = useUIStore((state) => state.isAppLocked);
  const sonCoupe = useUIStore((state) => state.sonCoupe);
  const inputVisible = appState === 'awake' && !isAppLocked && !page;

  // La messagerie n'est chargée et rendue qu'à sa première ouverture
  if (viewMode === 'messaging' && !messagingOpened) setMessagingOpened(true);

  // Voix du navigateur, en secours de la synthèse : leur liste se charge à l'avance
  useEffect(() => {
    window.speechSynthesis?.getVoices();
  }, []);

  // Préférences de ce navigateur (voix coupée, teinte des boîtes), relues avant le premier accueil
  useEffect(() => {
    try {
      if (localStorage.getItem(CLE_SON) === '1') useUIStore.setState({ sonCoupe: true });
      const verre = localStorage.getItem(CLE_VERRE);
      if (verre !== null && Number(verre) >= 0 && Number(verre) <= 0.9) useUIStore.getState().reglerVerre(Number(verre));
    } catch {
      // Stockage bloqué : réglages par défaut
    }
  }, []);

  useEffect(() => {
    hintStepRef.current = isNewProfile ? 'armed' : null;
    setMessagingHint(false);
  }, [isNewProfile, currentUserId]);

  // L'astuce reste 20 s, et disparaît dès que la messagerie ou une page s'ouvre
  useEffect(() => {
    if (!messagingHint) return;
    if (viewMode === 'messaging' || page) {
      setMessagingHint(false);
      return;
    }
    const timer = setTimeout(() => setMessagingHint(false), 20_000);
    return () => clearTimeout(timer);
  }, [messagingHint, viewMode, page]);

  // Ouvrir une vue ou couper le son arrête la voix en cours
  useEffect(() => {
    if (!page && !sonCoupe) return;
    stopTTS();
    setCurrentAnimation((animation) => (animation === 'speak' ? 'standby' : animation));
  }, [page, sonCoupe, stopTTS]);

  // Garde-fou : 6 s après l'accueil, l'œil s'éveille même si la voix n'a pas démarré
  useEffect(() => {
    if (appState !== 'processing' || !currentTranscript) return;
    const timer = setTimeout(() => setAppState('awake'), 6000);
    return () => clearTimeout(timer);
  }, [appState, currentTranscript, setAppState]);

  // Chaque réponse : fenêtre et voix au tableau de bord, fenêtre seule en messagerie ou sur une page
  useEffect(() => {
    if (status !== 'idle' || !currentTranscript || currentTranscript === lastProcessedTranscript) return;
    setLastProcessedTranscript(currentTranscript);
    const isAnswer = questionAskedRef.current;
    questionAskedRef.current = false;
    let windowOpened = false;
    const openWindow = () => {
      if (!isAnswer || windowOpened) return;
      windowOpened = true;
      addWindow('text', currentTranscript);
    };
    const onEnd = () => setCurrentAnimation('standby');

    if (viewMode === 'messaging' || page) {
      stopTTS();
      openWindow();
      onEnd();
      return;
    }

    // Fenêtre, astuce et réveil arrivent avec le son, pas avant
    const onStart = () => {
      openWindow();
      const ui = useUIStore.getState();
      if (hintStepRef.current === 'due' && ui.viewMode !== 'messaging' && !ui.isAppLocked) {
        hintStepRef.current = null;
        setMessagingHint(true);
      }
      setCurrentAnimation('speak');
      if (ui.appState === 'processing') setAppState('awake');
    };

    // Voix coupée : fenêtre, astuce et réveil arrivent aussitôt, sans le son ni la synthèse
    if (sonCoupe) {
      onStart();
      onEnd();
      return;
    }

    const staticUrl = currentTTS?.isStaticFile ? currentTTS.staticUrl : undefined;
    if (staticUrl) speakWithUrl(staticUrl, setupAudioVisualization, onEnd, onStart);
    else speakWithQueue(currentTranscript, setupAudioVisualization, onEnd, onStart);
  }, [status, currentTranscript, lastProcessedTranscript, currentTTS, speakWithQueue, speakWithUrl, stopTTS, setupAudioVisualization, addWindow, setAppState, viewMode, page, sonCoupe]);

  const handleSubmit = (text: string) => {
    setLastProcessedTranscript('');
    setScrollTrigger((n) => n + 1);
    setCurrentAnimation('thinking');
    questionAskedRef.current = true;
    if (hintStepRef.current === 'armed') hintStepRef.current = 'due';
    send(text);
  };

  return (
    <>
      <div className="min-h-screen text-white font-sans overflow-hidden relative bg-transparent">
        <IntroSequence sendAuth={sendAuth} messages={messages} messagingHint={messagingHint} />

        {messagingOpened && (
          <MessagingView
            messages={messages}
            onLoadHistory={loadMoreMessages}
            hasMoreMessages={hasMoreMessages}
            visible={appState === 'awake' && viewMode === 'messaging'}
            scrollTrigger={scrollTrigger}
          />
        )}

        <SiteHeader />
        <PageView />

        {/* L'œil, au-dessus du header où il se loge ; seul son bouton capte les clics */}
        <div
          className={`fixed inset-0 z-[45] pointer-events-none flex flex-col items-center justify-center transition-all duration-500 ${
            appState === 'awake' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <main className="flex items-center justify-center min-h-screen w-full relative z-30 pointer-events-none">
            {appState === 'awake' && (
              <div>
                <HexagonalAnimation ref={hexAnimationRef} currentAnimation={currentAnimation} isSpeaking={isSpeaking} getAudioLevel={getAudioLevel} />
              </div>
            )}
          </main>
        </div>

        <div
          inert={!inputVisible}
          className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 w-[min(600px,90vw)] z-30 transition-all duration-1000 delay-1000 ${
            inputVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
          }`}
        >
          <InputArea
            onSubmit={handleSubmit}
            triggerWave={() => hexAnimationRef.current?.triggerWave()}
            isLoading={currentAnimation === 'thinking'}
            tipsEnabled={appState === 'awake' && !isAppLocked}
          />
        </div>

        {/* Lecteurs d'écran : la dernière réponse et l'attente */}
        <p className="sr-only" aria-live="polite">
          {status === 'idle' ? currentTranscript : ''}
        </p>
        <p className="sr-only" role="status">
          {currentAnimation === 'thinking' ? CHAT_UI.thinking : ''}
        </p>
      </div>

      {/* Fenêtres flottantes : jamais en messagerie, ni sur une page, ni sous md */}
      {appState === 'awake' && viewMode !== 'messaging' && !page && (
        <div className="hidden md:block">
          <WindowsManager />
        </div>
      )}
    </>
  );
}
