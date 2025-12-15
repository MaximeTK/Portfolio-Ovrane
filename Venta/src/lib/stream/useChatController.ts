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
  send: (message: string, options?: { isEphemeral?: boolean }) => void;
  appendDelta: (delta: string) => void;
  currentTranscript: string;
  lastCommands: Command[];
  currentUserId: string | null;
  currentUserProfile: UserProfileData | null;
  currentTTS: TTSData | null;
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
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
  const [currentTTS, setCurrentTTS] = useState<TTSData | null>(null);
  
  // Pagination
  const [historySkip, setHistorySkip] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const HISTORY_LIMIT = 20;

  const clientRef = useRef<WebSocket | null>(null);
  // Ref pour stocker temporairement le message d'accueil lors d'un switch user (pour éviter qu'il soit écrasé par le fetchHistory vide)
  const pendingWelcomeMessageRef = useRef<Message | null>(null);
  // Ref pour signaler qu'on est dans le flux de création d'un nouvel utilisateur
  const isNewUserFlowRef = useRef(false);

  const loadUserPreference = useBackgroundStore((state) => state.loadUserPreference);
  const resetBackground = useBackgroundStore((state) => state.resetBackground);
  
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

  // Charger l'historique quand l'utilisateur change
  useEffect(() => {
    const fetchHistory = async () => {
      // Si on est dans le flux de création d'un nouvel utilisateur, on ne charge PAS l'historique
      // On se contente d'afficher le message d'accueil temporaire
      if (isNewUserFlowRef.current) {
        console.log(`🆕 [useChatController] Nouvel utilisateur détecté, skip du chargement d'historique`);
        if (pendingWelcomeMessageRef.current) {
          setMessages([pendingWelcomeMessageRef.current]);
          pendingWelcomeMessageRef.current = null;
        } else {
          setMessages([]);
        }
        setHasMoreMessages(false);
        // On ne reset PAS la ref ici, on la laisse pour le useEffect des préférences
        return;
      }

      if (!currentUserId) {
        setMessages([]);
        return;
      }
      
      try {
        const res = await fetch(`/api/chat/history?userId=${currentUserId}&limit=${HISTORY_LIMIT}&skip=0`);
        if (res.ok) {
          const data = await res.json();
          if (data.history && Array.isArray(data.history)) {
            const initialMessages = data.history.map((h: any) => createMessage(h.role, h.content, h.timestamp ? new Date(h.timestamp).getTime() : undefined));
            
            // Si on a un message d'accueil en attente (suite à une création de profil), on l'ajoute
            if (pendingWelcomeMessageRef.current) {
              initialMessages.push(pendingWelcomeMessageRef.current);
              pendingWelcomeMessageRef.current = null;
            }

            setMessages(initialMessages);
            setHistorySkip(initialMessages.length);
            if (initialMessages.length < HISTORY_LIMIT) {
              setHasMoreMessages(false);
            } else {
              setHasMoreMessages(true);
            }
          } else {
            // Pas d'historique, mais peut-être un message d'accueil en attente
            if (pendingWelcomeMessageRef.current) {
              setMessages([pendingWelcomeMessageRef.current]);
              pendingWelcomeMessageRef.current = null;
            } else {
              setMessages([]);
            }
            setHasMoreMessages(false);
          }
        }
      } catch (err) {
        console.error('Erreur chargement historique:', err);
      }
    };

    fetchHistory();
  }, [currentUserId]);

  const loadMoreMessages = useCallback(async () => {
    if (!currentUserId || !hasMoreMessages) return;
    try {
      const res = await fetch(`/api/chat/history?userId=${currentUserId}&limit=${HISTORY_LIMIT}&skip=${historySkip}`);
      if (res.ok) {
        const data = await res.json();
        if (data.history && Array.isArray(data.history) && data.history.length > 0) {
          const olderMessages = data.history.map((h: any) => createMessage(h.role, h.content, h.timestamp ? new Date(h.timestamp).getTime() : undefined));
          setMessages((prev) => [...olderMessages, ...prev]);
          setHistorySkip((prev) => prev + olderMessages.length);
          
          if (olderMessages.length < HISTORY_LIMIT) {
            setHasMoreMessages(false);
          }
        } else {
          setHasMoreMessages(false);
        }
      }
    } catch (err) {
      console.error('Erreur chargement messages précédents:', err);
    }
  }, [currentUserId, historySkip, hasMoreMessages]);

  // Charger les préférences utilisateur quand l'userId change
  useEffect(() => {
    if (isNewUserFlowRef.current) {
      console.log(`🆕 [useChatController] Nouvel utilisateur détecté, reset local du background`);
      resetBackground();
      isNewUserFlowRef.current = false; // Fin du flux de création
      return;
    }

    if (currentUserId) {
      console.log(`🎨 [useChatController] Chargement systématique des préférences pour: ${currentUserId}`);
      loadUserPreference(currentUserId);
    }
  }, [currentUserId, loadUserPreference, resetBackground]);
  
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
  
  const send = useCallback(async (message: string, options?: { isEphemeral?: boolean }) => {
    if (!message.trim() || status === 'streaming') return;
    
    if (clientRef.current) clientRef.current.close();
    
    const userMessage = createMessage('user', message);
    
    // Si le message est éphémère (Intro), on ne l'affiche PAS dans le chat
    if (!options?.isEphemeral) {
        setMessages((prev) => [...prev, userMessage]);
        setHistorySkip((prev) => prev + 1);
    }
    
    setStatus('streaming');
    setError(undefined);
      setCurrentTranscript('');
      setLastCommands([]);
      setCurrentTTS(null);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            prompt: message, 
            currentUserId: currentUserId,
            isEphemeral: options?.isEphemeral 
        })
      });
      
      const data = await parseResponse(response);
      let replyText = (data.reply ?? '');
      if (typeof replyText === 'string' && replyText.trim() === '' && data.commands && data.commands.length > 0) {
        replyText = 'D\'accord, j\'applique ta demande.';
      }
      
      // Si une commande ShowImage est présente, on ajoute l'image au message pour l'affichage in-line
      if (data.commands) {
        data.commands.forEach((cmd) => {
          if (cmd.command === 'ShowImage') {
             let imageUrl = cmd.parameter;
             if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
                imageUrl = '/' + imageUrl;
             }
             replyText += `\n\n![Image](${imageUrl})`;
          }
        });
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
        
        // Détection si c'est un NOUVEL utilisateur
        if (data.userProfile?.isNewUser) {
           console.log(`✨ [FRONTEND] C'est un nouveau profil ! Activation du flux de création.`);
           isNewUserFlowRef.current = true;
        }

        // On sauvegarde le message d'accueil pour qu'il soit restauré après le chargement de l'historique
        pendingWelcomeMessageRef.current = assistantMessage;

        // Mettre à jour l'userId - cela déclenchera automatiquement le chargement de l'historique et des préférences via les useEffects
        setCurrentUserId(newUserId);
      }
      
      // APPLIQUER LE TTS MAINTENANT SEULEMENT (après avoir chargé les préférences)
      // Cela garantit que IntroSequence ne déclenche pas 'awake' avant que le store de background ne soit à jour
      if (pendingTTS) {
        setCurrentTTS(pendingTTS);
      }
      
      setMessages((prev) => [...prev, assistantMessage]);
      
      if (!options?.isEphemeral) {
        setHistorySkip((prev) => prev + 1);
      }
      
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
    loadMoreMessages,
    hasMoreMessages,
  };
}
