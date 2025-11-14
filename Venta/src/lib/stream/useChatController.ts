/**
 * Hook principal pour gérer le chat - max 5 fonctions, max 20 lignes
 */
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ChatStatus, Command } from '../chat/types';
import { createMessage, parseResponse, updateStoredUserId } from './chatHelpers';
import { useBackgroundStore } from '../state/backgroundStore';

interface TTSData {
  audio?: string; // base64
  provider?: string;
  format?: string;
  useClientTTS?: boolean;
}

interface UseChatControllerReturn {
  messages: Message[];
  status: ChatStatus;
  error?: string;
  send: (message: string) => void;
  appendDelta: (delta: string) => void;
  currentTranscript: string;
  lastCommands: Command[];
  currentUserId: string | null;
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
  const [skipNextPreferenceLoad, setSkipNextPreferenceLoad] = useState(false);
  const [currentTTS, setCurrentTTS] = useState<TTSData | null>(null);
  
  const clientRef = useRef<WebSocket | null>(null);
  const loadUserPreference = useBackgroundStore((state) => state.loadUserPreference);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('venta_userId');
      if (storedUserId) {
        setCurrentUserId(storedUserId);
        // Charger les préférences au premier montage
        loadUserPreference(storedUserId);
      }
    }
  }, [loadUserPreference]);
  
  // Charger les préférences utilisateur quand l'userId change
  // SAUF si on vient de faire un SetBackground (pour éviter d'écraser la nouvelle couleur)
  useEffect(() => {
    if (currentUserId && !skipNextPreferenceLoad) {
      console.log(`🔄 [useEffect] Chargement auto des préférences pour: ${currentUserId}`);
      loadUserPreference(currentUserId);
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
      
      // Stocker les données TTS si disponibles
      if (data.tts) {
        setCurrentTTS(data.tts);
      }
      
      const assistantMessage = createMessage('assistant', replyText);
      if (data.commands && data.commands.length > 0) {
        assistantMessage.commands = data.commands;
        setLastCommands(data.commands);
      }
      
      const newUserId = updateStoredUserId(data.activeUserId, currentUserId);
      if (newUserId !== currentUserId && newUserId) {
        console.log(`🔄 [FRONTEND] Switch de profil détecté: ${currentUserId} → ${newUserId}`);
        
        // Vérifier si les commandes contiennent SetBackground
        const hasSetBackgroundCommand = data.commands?.some(
          (cmd) => cmd.command.toLowerCase() === 'setbackground',
        );
        
        if (hasSetBackgroundCommand) {
          console.log(`⏭️ [FRONTEND] SetBackground détecté, on skip le rechargement des préférences`);
          // Activer le flag pour que le useEffect ne charge pas les préférences
          setSkipNextPreferenceLoad(true);
        }
        
        // Mettre à jour l'userId (cela déclenchera le useEffect qui charge les préférences)
        // MAIS le useEffect sera skippé si skipNextPreferenceLoad est true
        setCurrentUserId(newUserId);
        
        // Si pas de SetBackground, charger les préférences manuellement AVANT le traitement des commandes
        if (!hasSetBackgroundCommand) {
          console.log(`🎨 [FRONTEND] Chargement des préférences pour le profil: ${newUserId}`);
          await loadUserPreference(newUserId);
        }
      }
      
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
    currentTTS,
  };
}
