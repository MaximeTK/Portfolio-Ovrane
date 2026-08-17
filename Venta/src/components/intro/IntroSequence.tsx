import React, { useEffect, useState, useRef } from 'react';
import { useUIStore } from '@/lib/state/uiStore';
import { HexagonalAnimation, HexagonalAnimationHandle } from '../ui/HexagonalAnimation';
import { AuthForm } from './AuthForm';
import { Message } from '@/lib/chat/types';

interface IntroSequenceProps {
  sendAuth: (mode: 'register' | 'login', data: Record<string, string>) => Promise<void>;
  messages: Message[];
  overlayOverrideText?: string | null;
}

export const IntroSequence = ({ sendAuth, messages, overlayOverrideText }: IntroSequenceProps) => {
  const { appState, setAppState, setUserName, viewMode, isAppLocked, lockedMessage } = useUIStore();
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(true);
  
  // Ref vers l'animation pour déclencher des vagues manuelles
  const hexAnimationRef = useRef<HexagonalAnimationHandle>(null);

  // Si l'app est verrouillée, on force l'état 'awake' pour afficher le message
  useEffect(() => {
    if (isAppLocked) {
      setAppState('awake');
      setIsWelcomeVisible(true);
    }
  }, [isAppLocked, setAppState]);

  // Gestion de la disparition du message de bienvenue après 10 secondes
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (appState === 'awake' && !isAppLocked) { // Ne pas masquer si verrouillé
      timer = setTimeout(() => {
        setIsWelcomeVisible(false);
      }, 10000); // 10 secondes
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [appState, isAppLocked]);

  // Disparition immédiate si on passe en mode messagerie
  useEffect(() => {
    if (viewMode === 'messaging' && !isAppLocked) {
      setIsWelcomeVisible(false);
    }
  }, [viewMode, isAppLocked]);

  const handleAuthSubmit = async (mode: 'register' | 'login', data: Record<string, string>) => {
    hexAnimationRef.current?.triggerWave();
    setAppState('processing');
    const identifier = data.pseudo || data.identifier || '';
    if (identifier) setUserName(identifier);
    try {
      await sendAuth(mode, data);
    } catch (err) {
      setAppState('sleeping');
      throw err;
    }
  };

  const getWelcomeMessage = () => {
    // Si l'application est verrouillée (limite atteinte)
    if (isAppLocked && lockedMessage) {
      return lockedMessage;
    }

    // IMPORTANT: le message de bienvenue est généré côté backend (source unique),
    // et injecté dans le flux frontend via `useChatController`.
    // Ici, on se contente de ré-afficher le dernier message assistant reçu.
    const lastAssistantMessage = [...(messages || [])]
      .reverse()
      .find((m) => m.role === 'assistant' && String(m.content || '').trim().length > 0);

    if (lastAssistantMessage) {
      return lastAssistantMessage.content;
    }

    // Pas de fallback texte ici : le backend est la source unique des messages d'accueil.
    return '';
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-colors duration-1000 ${
        appState === 'awake' ? 'bg-transparent pointer-events-none' : 'bg-[#020106]'
      }`}
    >
      
      {/* Logo Centré - Utilise HexagonalAnimation en mode sleep tant que pas awake */}
      <div className={`transition-opacity duration-500 ${appState === 'awake' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <HexagonalAnimation 
          ref={hexAnimationRef}
          currentAnimation="standby"
          isSpeaking={false}
          getAudioLevel={() => 0}
          mode="sleep" 
        />
      </div>

      {/* Zone de Contenu sous le logo */}
      {/* Position ajustée pour être bien en dessous du logo */}
      <div className="absolute top-[65%] mt-[100px] w-full flex flex-col items-center justify-center pointer-events-auto">
        
        {/* État 1: Input (Sleeping) */}
        <div 
          className={`transition-all duration-500 absolute w-full ${
            appState === 'sleeping' 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-0 pointer-events-none'
          }`}
        >
          <AuthForm onSubmit={handleAuthSubmit} />
        </div>

        {/* État 3: Awake (Message de bienvenue STATIQUE ou Message de Verrouillage) */}
        <OverlayMessage visible={appState === 'awake' && isWelcomeVisible && !overlayOverrideText}>
          {getWelcomeMessage()}
        </OverlayMessage>

        {/* Message overlay piloté depuis HomeClient (même design que le welcome) */}
        <OverlayMessage visible={appState === 'awake' && !isAppLocked && viewMode !== 'messaging' && !!overlayOverrideText}>
          {String(overlayOverrideText || '').toUpperCase()}
        </OverlayMessage>

      </div>
    </div>
  );
};

function OverlayMessage({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`transition-all duration-1000 delay-300 flex flex-col items-center text-center w-full px-6 absolute ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-0 pointer-events-none'
      }`}
    >
      <h1 className="text-sm md:text-base font-bold text-white tracking-[0.15em] uppercase drop-shadow-lg max-w-2xl leading-relaxed">
        {children}
      </h1>
    </div>
  );
}
