import { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/lib/uiStore';
import { HexagonalAnimation } from '@/features/oeil/HexagonalAnimation';
import type { IllusionAccueil, Message, TexteSigne } from '@/features/chat/types';
import type { useChatController } from '@/features/chat/useChatController';
import { CHAT_UI, INDISPONIBLE } from '@/lib/messages';

// Identifiant que le navigateur gardait avant la session en cookie
const ANCIEN_ID = 'venta_userId';

interface IntroSequenceProps {
  sendAuth: ReturnType<typeof useChatController>['sendAuth'];
  messages: Message[];
  messagingHint: boolean;
}

export function IntroSequence({ sendAuth, messages, messagingHint }: IntroSequenceProps) {
  const appState = useUIStore((state) => state.appState);
  const setAppState = useUIStore((state) => state.setAppState);
  const viewMode = useUIStore((state) => state.viewMode);
  const page = useUIStore((state) => state.page);
  const isAppLocked = useUIStore((state) => state.isAppLocked);
  const lockedMessage = useUIStore((state) => state.lockedMessage);
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(true);
  const [visitError, setVisitError] = useState(false);
  const visitStartedRef = useRef(false);

  // Arrivée sans saisie : profil visiteur créé ou repris, accueil du recruteur si la session porte un jeton
  const startVisit = useCallback(async () => {
    setAppState('processing');
    setVisitError(false);
    // En parallèle de l'arrivée : l'accueil du recruteur ne dépend pas de la session ; le serveur l'écrit et le signe
    const welcome = fetch('/api/illusion/accueil')
      .then((res) => (res.ok ? res.json() : null))
      .then((accueil: IllusionAccueil | null): TexteSigne | null => (accueil?.texte ? { texte: accueil.texte, voix: accueil.voix ?? '' } : null))
      .catch(() => null);
    // L'ancien identifiant est confié une seule fois au backend, puis oublié
    let ancienId: string | null = null;
    try {
      ancienId = localStorage.getItem(ANCIEN_ID);
    } catch {
      // Stockage bloqué : rien à reprendre
    }
    try {
      await sendAuth('visitor', ancienId ? { ancienId } : {}, welcome);
      if (ancienId) localStorage.removeItem(ANCIEN_ID);
    } catch {
      setAppState('sleeping');
      setVisitError(true);
    }
  }, [sendAuth, setAppState]);

  useEffect(() => {
    if (visitStartedRef.current) return;
    visitStartedRef.current = true;
    startVisit();
  }, [startVisit]);

  // Verrouillée (limite atteinte), l'app s'éveille pour afficher le message
  useEffect(() => {
    if (!isAppLocked) return;
    setAppState('awake');
    setIsWelcomeVisible(true);
  }, [isAppLocked, setAppState]);

  // L'accueil s'efface après 10 s, ou dès que la messagerie ou une page s'ouvre
  useEffect(() => {
    if (appState !== 'awake' || isAppLocked) return;
    if (viewMode === 'messaging' || page) {
      setIsWelcomeVisible(false);
      return;
    }
    const timer = setTimeout(() => setIsWelcomeVisible(false), 10_000);
    return () => clearTimeout(timer);
  }, [appState, isAppLocked, viewMode, page]);

  // Sous l'œil : le message de verrouillage, sinon la dernière réponse de l'IA, dont l'accueil du backend
  const welcomeMessage =
    isAppLocked && lockedMessage
      ? lockedMessage
      : [...messages].reverse().find((m) => m.role === 'assistant' && m.content.trim())?.content ?? '';

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-colors duration-300 ${
        appState === 'awake' ? 'bg-transparent pointer-events-none' : 'bg-[#020106]'
      }`}
    >
      {/* Œil endormi, relayé par celui de l'accueil au réveil */}
      <div inert className={`transition-opacity duration-300 ${appState === 'awake' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <HexagonalAnimation currentAnimation="standby" isSpeaking={false} getAudioLevel={() => 0} mode="sleep" />
      </div>

      <div className="absolute top-[65%] mt-[100px] w-full flex flex-col items-center justify-center pointer-events-auto">
        {/* Endormi : l'erreur éventuelle de l'arrivée */}
        <div
          inert={appState !== 'sleeping'}
          className={`transition-all duration-500 absolute w-full ${appState === 'sleeping' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          {visitError && (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <p role="alert" className="text-red-500 text-[10px] tracking-wider">{INDISPONIBLE}</p>
              <button
                type="button"
                onClick={startVisit}
                className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/60 hover:text-white transition-colors"
              >
                {CHAT_UI.retry}
              </button>
            </div>
          )}
        </div>

        <OverlayMessage visible={appState === 'awake' && isWelcomeVisible && !messagingHint && !page}>{welcomeMessage}</OverlayMessage>
        <OverlayMessage visible={appState === 'awake' && !isAppLocked && viewMode !== 'messaging' && messagingHint}>
          {CHAT_UI.messagingHint}
        </OverlayMessage>
      </div>
    </div>
  );
}

function OverlayMessage({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none transition-all duration-300 flex flex-col items-center text-center w-full px-6 absolute ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <p className="text-sm md:text-base font-bold text-white tracking-[0.15em] uppercase drop-shadow-lg max-w-2xl leading-relaxed">{children}</p>
    </div>
  );
}
