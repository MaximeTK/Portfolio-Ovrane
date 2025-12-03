/**
 * Hook principal pour gérer le chat - max 5 fonctions, max 20 lignes
 */
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ChatStatus, Command, TTSData, UserProfileData } from '../chat/types';
import { createMessage, parseResponse, updateStoredUserId } from './chatHelpers';
import { useBackgroundStore } from '../state/backgroundStore';

interface UseChatControllerReturn {
  messages: Message[];
  status: ChatStatus;
  error?: string;
  send: (message: string) => void;
  appendDelta: (delta: string) => void;
  currentTranscript: string;
  lastCommands: Command[];
  currentUserId: string | null;
  currentUserProfile: UserProfileData | null;
  currentTTS: TTSData | null;
}

/**
 * Hook pour contrôler le chat
 */
export function useChatController(): UseChatControllerReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | undefined>();
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [lastCommands, setLastCommands] = useState<Command[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfileData | null>(null);
  const [skipNextPreferenceLoad, setSkipNextPreferenceLoad] = useState(false);
  const [currentTTS, setCurrentTTS] = useState<TTSData | null>(null);
  
  const clientRef = useRef<WebSocket | null>(null);
  const loadUserPreference = useBackgroundStore((state) => state.loadUserPreference);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('venta_userId');
      if (storedUserId) {
        setCurrentUserId(storedUserId);
        // NE PAS charger les préférences au premier montage pour éviter le flash
        // On attend l'interaction explicite (IntroSequence) ou la confirmation d'identité
      }
    }
  }, [loadUserPreference]);

  // Charger les préférences utilisateur quand l'userId change
  // SAUF si on vient de faire un SetBackground (pour éviter d'écraser la nouvelle couleur)
  // ET SAUF au démarrage initial (géré par IntroSequence)
  useEffect(() => {
    if (currentUserId && !skipNextPreferenceLoad) {
      // On ne charge plus automatiquement ici au montage initial pour éviter le flash
      // C'est IntroSequence qui s'en charge au moment du "réveil"
      // Mais on garde ce hook pour les changements ultérieurs (switch user)
      
      // Hack pour détecter si c'est le premier montage ou un vrai changement
      // (si on voulait être très précis, on utiliserait une ref)
      // Pour l'instant, on laisse IntroSequence gérer le premier chargement
    } else if (skipNextPreferenceLoad) {
      console.log(`⏭️ [useEffect] Skip du chargement auto (SetBackground actif)`);
      setSkipNextPreferenceLoad(false);
    }
  }, [currentUserId, loadUserPreference, skipNextPreferenceLoad]);
  
  const appendDelta = useCallback((delta: string) => {
    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') {
        const newMessage = createMessage('assistant', delta);
        setCurrentTranscript(delta);
        return [...prev, newMessage];
      }
      
      const updatedMessage = { ...lastMessage, content: lastMessage.content + delta };
      setCurrentTranscript(updatedMessage.content);
      return [...prev.slice(0, -1), updatedMessage];
    });
  }, []);
  
  const send = useCallback(async (message: string) => {
    if (!message.trim() || status === 'streaming') return;
    
    if (clientRef.current) clientRef.current.close();
    
    const userMessage = createMessage('user', message);
    setMessages((prev) => [...prev, userMessage]);
    setStatus('streaming');
    setError(undefined);
      setCurrentTranscript('');
      setLastCommands([]);
      setCurrentTTS(null);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: message, currentUserId: currentUserId })
      });
      
      const data = await parseResponse(response);
      let replyText = (data.reply ?? '');
      if (typeof replyText === 'string' && replyText.trim() === '' && data.commands && data.commands.length > 0) {
        replyText = 'D\'accord, j\'applique ta demande.';
      }
      setCurrentTranscript(replyText);
      
      // Stocker les données TTS si disponibles (MAIS on ne l'applique pas tout de suite pour éviter le réveil prématuré)
      let pendingTTS = null;
      if (data.tts) {
        pendingTTS = data.tts;
      }

      // Stocker le profil utilisateur s'il est renvoyé
      if (data.userProfile) {
        setCurrentUserProfile(data.userProfile);
      }
      
      const assistantMessage = createMessage('assistant', replyText);
      if (data.commands && data.commands.length > 0) {
        assistantMessage.commands = data.commands;
        setLastCommands(data.commands);
      }
      
      const newUserId = updateStoredUserId(data.activeUserId, currentUserId);
      if (newUserId !== currentUserId && newUserId) {
        console.log(`🔄 [FRONTEND] Switch de profil détecté: ${currentUserId} → ${newUserId}`);
        
        // On ne reset PAS le background ici pour éviter le passage par le noir si on a une préférence
        
        // Vérifier si les commandes contiennent SetBackground
        const hasSetBackgroundCommand = data.commands?.some(
          (cmd) => cmd.command.toLowerCase() === 'setbackground',
        );
        
        if (hasSetBackgroundCommand) {
          console.log(`⏭️ [FRONTEND] SetBackground détecté, on skip le rechargement des préférences`);
          setSkipNextPreferenceLoad(true);
        }
        
        // Mettre à jour l'userId
        setCurrentUserId(newUserId);
        
        // Si pas de SetBackground, charger les préférences manuellement AVANT le traitement des commandes
        if (!hasSetBackgroundCommand) {
          console.log(`🎨 [FRONTEND] Chargement des préférences pour le profil: ${newUserId}`);
          await loadUserPreference(newUserId);
        }
      }
      
      // APPLIQUER LE TTS MAINTENANT SEULEMENT (après avoir chargé les préférences)
      // Cela garantit que IntroSequence ne déclenche pas 'awake' avant que le store de background ne soit à jour
      if (pendingTTS) {
        setCurrentTTS(pendingTTS);
      }
      
      setMessages((prev) => [...prev, assistantMessage]);
      
      setMessages((prev) => [...prev, assistantMessage]);
      setStatus('idle');
    } catch (err) {
      console.error('❌ [FRONTEND] Erreur lors de l\'envoi:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      setStatus('error');
      const errorMessageObj = createMessage('assistant', `❌ ${errorMessage}`);
      setMessages((prev) => [...prev, errorMessageObj]);
    }
  }, [status, currentUserId, loadUserPreference]);
  
  return {
    messages,
    status,
    error,
    send,
    appendDelta,
    currentTranscript,
    lastCommands,
    currentUserId,
    currentUserProfile,
    currentTTS,
  };
}
