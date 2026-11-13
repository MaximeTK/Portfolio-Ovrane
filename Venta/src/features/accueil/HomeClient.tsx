'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAudioVisualization } from '@/features/oeil/useAudioVisualization';
import { useTTS, type FluxVoix } from '@/features/oeil/useTTS';
import { HexagonalAnimation, type AnimationOeil, type HexagonalAnimationHandle } from '@/features/oeil/HexagonalAnimation';
import { useChatController } from '@/features/chat/useChatController';
import { InputArea } from '@/features/chat/InputArea';
import { SiteHeader } from '@/features/site/SiteHeader';
import { PageView } from '@/features/site/PageView';
import { horsAccueil, useUIStore, CLE_FLOU, CLE_PLEIN, CLE_SON, CLE_VERRE, FLOU_MAX, VERRE_MAX } from '@/lib/uiStore';
import { CHAT_UI } from '@/lib/messages';
import { IntroSequence } from './IntroSequence';

const MessagingView = dynamic(() => import('@/features/chat/MessagingView').then((m) => m.MessagingView));
// ssr: false pose une frontière à repli nul : l'œil n'attend pas le module
const chargerFenetres = () => import('@/features/fenetres/GlassmorphismeWindow');
// Module injoignable (redéploiement, réseau) : la fenêtre se perd, pas le site
const WindowsManager = dynamic(() => chargerFenetres().then((m) => m.WindowsManager).catch(() => () => null), { ssr: false });

// Page actualisée et non ouverte : l'accueil s'affiche sans être redit
const estRechargement = () => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'reload';

// Réponse dite pendant qu'elle s'écrit : sa voix, sa fenêtre, ses textes
type ReponseEnFlux = { texte: string; final: string | null; voix: FluxVoix | null; fenetre: string | null; secours: boolean };

export default function HomeClient() {
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [currentAnimation, setCurrentAnimation] = useState<AnimationOeil>('standby');
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState('');
  const [messagingOpened, setMessagingOpened] = useState(false);
  const [messagingHint, setMessagingHint] = useState(false);
  // Astuce de messagerie d'un nouveau profil, montrée quand la réponse commence
  const hintStepRef = useRef<'armed' | 'due' | null>(null);
  // Seules les réponses à une question ouvrent une fenêtre, pas l'accueil
  const questionAskedRef = useRef(false);
  const hexAnimationRef = useRef<HexagonalAnimationHandle>(null);
  const reponseRef = useRef<ReponseEnFlux | null>(null);

  const { setupAudioVisualization } = useAudioVisualization();
  const { send, sendAuth, status, currentTranscript, currentTTS, currentVoix, currentUserId, isNewProfile, messages, loadMoreMessages, hasMoreMessages } =
    useChatController();
  const { isSpeaking, getAudioLevel, speakWithQueue, speakWithUrl, ouvrirFlux, stop: stopTTS } = useTTS();
  const addWindow = useUIStore((state) => state.addWindow);
  const setWindowContent = useUIStore((state) => state.setWindowContent);
  const appState = useUIStore((state) => state.appState);
  const setAppState = useUIStore((state) => state.setAppState);
  const viewMode = useUIStore((state) => state.viewMode);
  const page = useUIStore((state) => state.page);
  const aDesFenetres = useUIStore((state) => state.windows.length > 0);
  const isAppLocked = useUIStore((state) => state.isAppLocked);
  const sonCoupe = useUIStore((state) => state.sonCoupe);
  const inputVisible = appState === 'awake' && !isAppLocked && !page;
  // La barre s'ouvre ou se ferme comme une fenêtre d'Illusion, puis se pose
  const [saisie, setSaisie] = useState({ visible: inputVisible, passage: '' });
  if (saisie.visible !== inputVisible) setSaisie({ visible: inputVisible, passage: inputVisible ? 'ouvre' : 'ferme' });
  useEffect(() => {
    if (!saisie.passage) return;
    const timer = setTimeout(() => setSaisie((s) => ({ ...s, passage: '' })), 700);
    return () => clearTimeout(timer);
  }, [saisie]);

  // La messagerie n'est chargée et rendue qu'à sa première ouverture
  if (viewMode === 'messaging' && !messagingOpened) setMessagingOpened(true);

  // Voix du navigateur en secours de la synthèse : liste chargée à l'avance
  useEffect(() => {
    window.speechSynthesis?.getVoices();
  }, []);

  // Préférences du navigateur (voix, teinte, flou, opacité), relues d'abord
  useEffect(() => {
    try {
      if (localStorage.getItem(CLE_SON) === '1') useUIStore.setState({ sonCoupe: true });
      const verre = localStorage.getItem(CLE_VERRE);
      if (verre !== null && Number(verre) >= 0 && Number(verre) <= VERRE_MAX) useUIStore.getState().reglerVerre(Number(verre));
      const flou = localStorage.getItem(CLE_FLOU);
      if (flou !== null && Number(flou) >= 0 && Number(flou) <= FLOU_MAX) useUIStore.getState().reglerFlou(Number(flou));
      const plein = localStorage.getItem(CLE_PLEIN);
      if (plein !== null && Number(plein) >= 0 && Number(plein) <= 1) useUIStore.getState().reglerPlein(Number(plein));
    } catch {
      // Stockage bloqué : réglages par défaut
    }
  }, []);

  // L'œil s'éveille avec une onde, à l'arrivée de l'accueil et pas avant
  useEffect(() => {
    if (appState === 'awake') hexAnimationRef.current?.triggerWave();
  }, [appState]);

  useEffect(() => {
    hintStepRef.current = isNewProfile ? 'armed' : null;
    setMessagingHint(false);
  }, [isNewProfile, currentUserId]);

  // L'astuce reste 20 s, et disparaît dès que la messagerie ou une page s'ouvre
  useEffect(() => {
    if (!messagingHint) return;
    if (horsAccueil({ page, viewMode })) {
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

  // Garde-fou : 6 s après l'accueil, l'œil s'éveille même sans voix
  useEffect(() => {
    if (appState !== 'processing' || !currentTranscript) return;
    const timer = setTimeout(() => setAppState('awake'), 6000);
    return () => clearTimeout(timer);
  }, [appState, currentTranscript, setAppState]);

  // Astuce de messagerie due au premier message d'un nouveau profil
  const montrerAstuce = useCallback(() => {
    const ui = useUIStore.getState();
    if (hintStepRef.current !== 'due' || ui.viewMode === 'messaging' || ui.isAppLocked) return;
    hintStepRef.current = null;
    setMessagingHint(true);
  }, []);

  // L'accueil reçu réveille l'œil, s'il ne l'est pas déjà
  const reveiller = useCallback(() => {
    if (useUIStore.getState().appState === 'processing') setAppState('awake');
  }, [setAppState]);

  // Chaque réponse : fenêtre et voix au tableau de bord, fenêtre seule ailleurs
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

    if (horsAccueil({ page, viewMode })) {
      stopTTS();
      openWindow();
      onEnd();
      // Arrivée sur une page : l'accueil reçu réveille l'œil sans attendre
      if (!isAnswer) reveiller();
      return;
    }

    // Réponse déjà dite en flux : sa fenêtre prend le texte final
    const enFlux = isAnswer ? reponseRef.current : null;
    if (enFlux?.voix) {
      enFlux.final = currentTranscript;
      if (enFlux.fenetre) setWindowContent(enFlux.fenetre, currentTranscript);
      return;
    }

    // Fenêtre, astuce et réveil arrivent avec le son, pas avant
    const onStart = () => {
      openWindow();
      montrerAstuce();
      setCurrentAnimation('speak');
      reveiller();
    };

    // Voix coupée : fenêtre, astuce et réveil arrivent aussitôt, sans son
    if (sonCoupe) {
      onStart();
      onEnd();
      return;
    }

    // L'accueil réveille l'œil tout de suite ; sa voix suit quand elle est prête
    if (!isAnswer) {
      reveiller();
      if (estRechargement()) return onEnd();
    }

    const staticUrl = currentTTS?.isStaticFile ? currentTTS.staticUrl : undefined;
    if (staticUrl) speakWithUrl(staticUrl, setupAudioVisualization, onEnd, onStart);
    else speakWithQueue(currentTranscript, setupAudioVisualization, onEnd, onStart, currentVoix);
  }, [status, currentTranscript, lastProcessedTranscript, currentTTS, currentVoix, speakWithQueue, speakWithUrl, stopTTS, setupAudioVisualization, addWindow, setWindowContent, montrerAstuce, reveiller, viewMode, page, sonCoupe]);

  const handleSubmit = (text: string) => {
    // La réponse prend plus de temps que le module de ses fenêtres
    void chargerFenetres().catch(() => undefined);
    setLastProcessedTranscript('');
    setScrollTrigger((n) => n + 1);
    setCurrentAnimation('thinking');
    questionAskedRef.current = true;
    if (hintStepRef.current === 'armed') hintStepRef.current = 'due';

    // Voix en flux : la fenêtre s'ouvre au premier son, le texte s'y allonge
    const reponse: ReponseEnFlux = { texte: '', final: null, voix: null, fenetre: null, secours: false };
    reponseRef.current = reponse;
    const auPremierSon = () => {
      reponse.fenetre = addWindow('text', reponse.final ?? reponse.texte);
      montrerAstuce();
      setCurrentAnimation('speak');
    };
    send(text, {
      texte: (complet) => {
        reponse.texte = complet;
        if (reponse.fenetre) setWindowContent(reponse.fenetre, complet);
      },
      audio: (pcm) => {
        const ui = useUIStore.getState();
        if (reponse.secours || ui.sonCoupe || horsAccueil(ui) || reponseRef.current !== reponse) return;
        reponse.voix ??= ouvrirFlux(() => setCurrentAnimation('standby'), auPremierSon);
        reponse.voix.pousser(pcm);
      },
      secours: () => {
        reponse.secours = true;
      },
    }).then(() => reponse.voix?.terminer());
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
            enCours={currentAnimation === 'thinking'}
          />
        )}

        <SiteHeader />
        <PageView sendAuth={sendAuth} utilisateur={currentUserId} />

        {/* L'œil, au-dessus du header où il se loge ; seul son bouton capte les clics */}
        <div
          className={`fixed inset-0 z-[45] pointer-events-none flex flex-col items-center justify-center transition-all duration-300 ${
            appState === 'awake' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <main className="flex items-center justify-center min-h-screen w-full relative z-30 pointer-events-none">
            {appState === 'awake' && (
              <HexagonalAnimation ref={hexAnimationRef} currentAnimation={currentAnimation} isSpeaking={isSpeaking} getAudioLevel={getAudioLevel} />
            )}
          </main>
        </div>

        <div
          inert={!inputVisible}
          className={`saisie fixed bottom-8 left-1/2 -translate-x-1/2 w-[min(600px,90vw)] z-30 ${saisie.passage} ${
            inputVisible || saisie.passage ? '' : 'invisible'
          }`}
        >
          <span className="ouv-ligne" aria-hidden="true" />
          <span className="ouv-ligne" aria-hidden="true" />
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
      {aDesFenetres && appState === 'awake' && viewMode !== 'messaging' && !page && (
        <div className="hidden md:block">
          <WindowsManager />
        </div>
      )}
    </>
  );
}
