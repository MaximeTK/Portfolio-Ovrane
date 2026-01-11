/**
 * Hook principal pour gérer le chat - max 5 fonctions, max 20 lignes
 */
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ChatStatus, Command, TTSData, UserProfileData } from '../chat/types';
import { createMessage, parseResponse, updateStoredUserId } from './chatHelpers';
import { useBackgroundStore } from '../state/backgroundStore';
import { useUIStore } from '../state/uiStore';
import { CHAT_UI } from '../messages';
import { getOrCreateUserId } from '../userId';

type HistoryItem = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string | number;
  commands?: Command[];
};

function isHistoryItem(value: unknown): value is HistoryItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    (v.role === 'user' || v.role === 'assistant') &&
    typeof v.content === 'string'
  );
}

function toTimestampMs(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : undefined;
  }
  return undefined;
}

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
  // Evite de charger la préférence de fond d'un ancien profil au simple reload.
  // On ne considère le profil "actif" qu'après une réponse backend confirmant l'userId.
  const [hasConfirmedProfile, setHasConfirmedProfile] = useState(false);
  
  // Pagination
  const [historySkip, setHistorySkip] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const HISTORY_LIMIT = 20;

  const clientRef = useRef<WebSocket | null>(null);
  // Ref pour stocker temporairement le message d'accueil avec l'ID cible
  const pendingWelcomeMessageRef = useRef<{ userId: string; message: Message } | null>(null);
  // Ref pour signaler qu'on est dans le flux de création d'un nouvel utilisateur
  const isNewUserFlowRef = useRef(false);

  const loadUserPreference = useBackgroundStore((state) => state.loadUserPreference);
  const resetBackground = useBackgroundStore((state) => state.resetBackground);
  const setAppLocked = useUIStore((state) => state.setAppLocked);
  const setViewMode = useUIStore((state) => state.setViewMode);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = getOrCreateUserId();
      setCurrentUserId(storedUserId);
    }
  }, []);

  // Charger l'historique quand l'utilisateur change
  useEffect(() => {
    const fetchHistory = async () => {
      // Si on est dans le flux de création d'un nouvel utilisateur, on ne charge PAS l'historique
      // On se contente d'afficher le message d'accueil temporaire
      if (isNewUserFlowRef.current) {
        console.log(`🆕 [useChatController] Nouvel utilisateur détecté, skip du chargement d'historique`);
        if (pendingWelcomeMessageRef.current?.userId === currentUserId) {
          setMessages([pendingWelcomeMessageRef.current.message]);
          // On ne vide pas la ref tout de suite par sécurité, ou on la laisse pour le cas où le useEffect serait réexécuté
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
            const historyItems = (data.history as unknown[]).filter(isHistoryItem);
            const initialMessages = historyItems.map((h) =>
              createMessage(
                h.role,
                h.content,
                toTimestampMs(h.timestamp),
                Array.isArray(h.commands) ? h.commands : undefined,
              ),
            );
            
            // Si on a un message d'accueil en attente pour CET utilisateur, on l'ajoute
            if (pendingWelcomeMessageRef.current && pendingWelcomeMessageRef.current.userId === currentUserId) {
              const pending = pendingWelcomeMessageRef.current.message;
              const normalize = (value: string) => String(value ?? '').replace(/\s+/g, ' ').trim();
              const pendingContent = normalize(pending.content);

              // On vérifie s'il est déjà là (doublon)
              const alreadyPresent = initialMessages.some((m) => (
                m.role === pending.role && normalize(m.content) === pendingContent
              ));

              if (!alreadyPresent) {
                // On l'ajoute à la FIN de l'historique pour qu'il soit le dernier message
                initialMessages.push(pending);
              }
              // On ne vide PAS la ref ici pour éviter les race conditions (double execution useEffect).
              // Elle sera écrasée au prochain switch user ou perdue au reload.
            }

            setMessages(initialMessages);
            setHistorySkip(initialMessages.length);
            if (initialMessages.length < HISTORY_LIMIT) {
              setHasMoreMessages(false);
            } else {
              setHasMoreMessages(true);
            }
          } else {
            // Pas d'historique, mais peut-être un message d'accueil
            if (pendingWelcomeMessageRef.current && pendingWelcomeMessageRef.current.userId === currentUserId) {
              setMessages([pendingWelcomeMessageRef.current.message]);
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
          const historyItems = (data.history as unknown[]).filter(isHistoryItem);
          const olderMessages = historyItems.map((h) =>
            createMessage(
              h.role,
              h.content,
              toTimestampMs(h.timestamp),
              Array.isArray(h.commands) ? h.commands : undefined,
            ),
          );
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

    // IMPORTANT: au reload, currentUserId est issu du localStorage (ancien profil potentiel).
    // On attend une confirmation backend (première réponse) avant d'appliquer la préférence.
    if (!hasConfirmedProfile) {
      return;
    }

    if (currentUserId) {
      console.log(`🎨 [useChatController] Chargement systématique des préférences pour: ${currentUserId}`);
      loadUserPreference(currentUserId);
    }
  }, [currentUserId, hasConfirmedProfile, loadUserPreference, resetBackground]);
  
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
        replyText = CHAT_UI.applyRequestFallback;
      }

      setCurrentTranscript(replyText);
      // On a une réponse backend -> le profil est désormais confirmé (évite le flash au reload)
      if (!hasConfirmedProfile) {
        setHasConfirmedProfile(true);
      }
      
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

        // Gestion du verrouillage d'interface (Limite atteinte)
        const lockCommand = data.commands.find(c => c.command === 'LockInterface');
        if (lockCommand) {
          console.log('🔒 [FRONTEND] Verrouillage de l\'interface demandé');
          setAppLocked(true, replyText); // On utilise la réponse comme message de verrouillage
          setViewMode('dashboard'); // Force le retour au dashboard
        }
      }
      
      const newUserId = updateStoredUserId(data.activeUserId, currentUserId);
      if (newUserId !== currentUserId && newUserId) {
        console.log(`🔄 [FRONTEND] Switch de profil détecté: ${currentUserId} → ${newUserId}`);
        
        // Détection si c'est un NOUVEL utilisateur
        if (data.userProfile?.isNewUser) {
           console.log(`✨ [FRONTEND] C'est un nouveau profil ! Activation du flux de création.`);
           isNewUserFlowRef.current = true;
        }

        // On sauvegarde le message d'accueil UNIQUEMENT quand il ne sera pas présent dans l'historique
        // (ex: message éphémère d'intro / flux nouveau profil). Sinon, cela peut provoquer un doublon
        // car l'historique contient déjà la réponse de bienvenue.
        const shouldCarryWelcomeMessage = !!options?.isEphemeral || !!data.userProfile?.isNewUser;
        pendingWelcomeMessageRef.current = shouldCarryWelcomeMessage 
          ? { userId: newUserId, message: assistantMessage } 
          : null;

        // Mettre à jour l'userId - cela déclenchera automatiquement le chargement de l'historique et des préférences via les useEffects
        setCurrentUserId(newUserId);
      }
      
      // APPLIQUER LE TTS MAINTENANT SEULEMENT (après avoir chargé les préférences)
      // Cela garantit que IntroSequence ne déclenche pas 'awake' avant que le store de background ne soit à jour
      if (pendingTTS) {
        setCurrentTTS(pendingTTS);
      }
      
      // Si on n'a PAS changé d'utilisateur (donc pas de fetchHistory déclenché), on doit ajouter le message manuellement ici.
      // Si on A changé d'utilisateur, le fetchHistory va se lancer, mais il inclura le pendingWelcomeMessageRef qu'on vient de set.
      // Donc, pour éviter un doublon VISUEL immédiat avant que le fetchHistory ne remplace tout, on l'ajoute quand même.
      // Le fetchHistory finira par "stabiliser" l'état en remplaçant tout (avec le pending message réinjecté).
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
  }, [status, currentUserId]);
  
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
