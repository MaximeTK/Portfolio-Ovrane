import React, { useEffect, useState } from 'react';
import { useUIStore } from '@/lib/state/uiStore';
import { HexagonalAnimation } from '../ui/HexagonalAnimation';
import { NameInput } from './NameInput';
import { TTSData, Message, UserProfileData } from '@/lib/chat/types';
import { useBackgroundStore } from '@/lib/state/backgroundStore';

interface IntroSequenceProps {
  send: (message: string) => void;
  currentTTS: TTSData | null;
  messages: Message[];
  currentUserProfile: UserProfileData | null;
  currentUserId: string | null;
}

export const IntroSequence = ({ send, currentTTS, messages, currentUserProfile, currentUserId }: IntroSequenceProps) => {
  const { appState, setAppState, setUserName, userName } = useUIStore();
  const loadUserPreference = useBackgroundStore((state) => state.loadUserPreference);
  const [hasTriggeredAwake, setHasTriggeredAwake] = useState(false);
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(true);

  // Gestion de la transition vers 'awake' quand l'audio arrive
  useEffect(() => {
    if (appState === 'processing' && currentTTS && !hasTriggeredAwake) {
      // On a reçu l'audio (TTS) du backend !
      setAppState('awake');
      setHasTriggeredAwake(true);
      
      // C'est le bon moment pour appliquer les préférences utilisateur
      // car l'utilisateur vient d'être identifié par le backend
      if (currentUserId) {
        console.log(`🎨 [IntroSequence] Application des préférences pour l'utilisateur: ${currentUserId}`);
        loadUserPreference(currentUserId);
      }
    }
  }, [appState, currentTTS, messages, setAppState, hasTriggeredAwake, currentUserId, loadUserPreference]);

  // Gestion de la disparition du message de bienvenue après 10 secondes
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (appState === 'awake') {
      timer = setTimeout(() => {
        setIsWelcomeVisible(false);
      }, 10000); // 10 secondes
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [appState]);

  const handleNameSubmit = (name: string) => {
    setAppState('processing');
    setUserName(name); // On sauvegarde le nom pour l'affichage
    // On envoie le nom avec une intention claire
    send(`Je m'appelle ${name}`);
  };

  const getWelcomeMessage = () => {
    // Si on a l'info que c'est un nouvel utilisateur
    if (currentUserProfile?.isNewUser) {
      return "ENCHANTÉE DE FAIRE VOTRE CONNAISSANCE !";
    }
    // Par défaut (ou si utilisateur existant)
    return "RAVIE DE VOUS REVOIR !";
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-colors duration-1000 ${
        appState === 'awake' ? 'bg-transparent pointer-events-none' : 'bg-[#020106]'
      }`}
    >
      
      {/* Logo Centré - Utilise HexagonalAnimation en mode sleep tant que pas awake */}
      <div className={`transition-opacity duration-500 ${appState === 'awake' ? 'opacity-0' : 'opacity-100'}`}>
        <HexagonalAnimation 
          currentAnimation="standby"
          isSpeaking={false}
          audioLevel={0}
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
          <NameInput onSubmit={handleNameSubmit} />
        </div>

        {/* État 3: Awake (Message de bienvenue STATIQUE) */}
        <div 
          className={`transition-all duration-1000 delay-300 flex flex-col items-center text-center w-full px-6 absolute ${
            appState === 'awake' && isWelcomeVisible
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-0'
          }`}
        >
          <h1 className="text-sm md:text-base font-bold text-white tracking-[0.15em] uppercase drop-shadow-lg">
            BIENVENUE {userName?.toUpperCase()}, {getWelcomeMessage()}
          </h1>
        </div>

      </div>
    </div>
  );
};
