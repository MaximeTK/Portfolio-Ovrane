'use client';

import { useCallback, useState } from 'react';
import type { ChatStatus, Command, Message, MessageRole, TTSData } from './types';
import { useBackgroundStore } from '@/features/fond/backgroundStore';
import { useUIStore } from '@/lib/uiStore';
import { CHAT_UI, INDISPONIBLE } from '@/lib/messages';

const HISTORY_LIMIT = 20;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Réponse du chat ou de l'arrivée ; activeUserId ne sert qu'à l'affichage, la session est un cookie. */
interface Reponse {
  reply?: string;
  error?: string;
  commands?: Command[];
  tts?: TTSData;
  activeUserId?: string;
  userProfile?: { isNewUser?: boolean };
}

type HistoryItem = { role: MessageRole; content: string; timestamp?: string | number; commands?: Command[] };

function createMessage(role: MessageRole, content: string, timestamp = Date.now(), commands?: Command[]): Message {
  return { id: `${timestamp}-${Math.random().toString(36).slice(2, 9)}`, role, content, timestamp, commands };
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Écoute d'une réponse en flux : texte reçu jusqu'ici, audio PCM en base64, voix de secours annoncée par le serveur. */
export interface EcouteReponse {
  texte: (complet: string) => void;
  audio: (pcm: string) => void;
  secours: () => void;
}

// Événements SSE d'un corps de réponse, au fil de leur arrivée
async function* lireEvenements(corps: ReadableStream<Uint8Array>) {
  const lecteur = corps.getReader();
  // Un caractère accentué coupé entre deux morceaux est recollé par le décodage en flux
  const decodeur = new TextDecoder();
  let reste = '';
  for (let morceau = await lecteur.read(); !morceau.done; morceau = await lecteur.read()) {
    reste += decodeur.decode(morceau.value, { stream: true });
    for (let fin = reste.indexOf('\n\n'); fin >= 0; fin = reste.indexOf('\n\n')) {
      const bloc = reste.slice(0, fin);
      reste = reste.slice(fin + 2);
      const type = bloc.match(/^event: (.+)$/m)?.[1];
      const donnees = bloc.match(/^data: (.+)$/m)?.[1];
      if (type && donnees) yield { type, donnees: JSON.parse(donnees) };
    }
  }
}

async function fetchHistory(skip: number): Promise<Message[]> {
  const res = await fetch(`/api/chat/history?limit=${HISTORY_LIMIT}&skip=${skip}`);
  const data = res.ok ? await res.json() : null;
  if (!Array.isArray(data?.history)) return [];
  return (data.history as HistoryItem[])
    .filter((h) => (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
    .map((h) =>
      createMessage(h.role, h.content, new Date(h.timestamp ?? NaN).getTime() || Date.now(), Array.isArray(h.commands) ? h.commands : undefined),
    );
}

export function useChatController() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentTTS, setCurrentTTS] = useState<TTSData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isNewProfile, setIsNewProfile] = useState(false);
  const [historySkip, setHistorySkip] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);

  // Réponse du chat comme de l'arrivée : changement de profil, commandes, puis le texte à dire
  const applyResponse = useCallback((data: Reponse, text: string) => {
    const ui = useUIStore.getState();
    const fond = useBackgroundStore.getState();
    const message = createMessage('assistant', text, Date.now(), data.commands);

    const userId = data.activeUserId;
    if (userId && userId !== currentUserId) {
      ui.closeAllWindows();
      setCurrentUserId(userId);
      setIsNewProfile(!!data.userProfile?.isNewUser);
      setMessages([message]);
      setHistorySkip(0);
      setHasMoreMessages(false);
      const { origin, pathname, search } = window.location;
      fetch('/api/tracking/visit', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ link: `${origin}${pathname}${search}` }) })
        .catch((err) => console.error('[suivi] visite :', err));
      if (data.userProfile?.isNewUser) {
        fond.resetBackground();
      } else {
        fond.loadPreference();
        // L'accueil reste le dernier message, sauf s'il figure déjà dans l'historique
        fetchHistory(0)
          .then((history) => {
            const known = history.some((m) => m.role === 'assistant' && normalize(m.content) === normalize(text));
            setMessages(known ? history : [...history, message]);
            setHistorySkip(history.length);
            setHasMoreMessages(history.length >= HISTORY_LIMIT);
          })
          .catch((err) => console.error('[chat] historique :', err));
      }
    } else {
      setMessages((prev) => [...prev, message]);
    }

    let images = 0;
    for (const { command, parameter } of data.commands ?? []) {
      const nom = command.toLowerCase();
      if (nom === 'setbackground') fond.setBackground(parameter);
      if (nom === 'showpicture' || nom === 'showimage') {
        const decalage = 100 + 50 * images++;
        ui.addWindow('image', parameter, { x: decalage, y: decalage });
      }
      if (nom === 'lockinterface') {
        ui.setAppLocked(true, text);
        ui.setViewMode('dashboard');
      }
    }

    setCurrentTTS(data.tts ?? null);
    setCurrentTranscript(text);
    setStatus('idle');
  }, [currentUserId]);

  const send = useCallback(async (prompt: string, ecoute?: EcouteReponse) => {
    if (!prompt.trim() || status === 'streaming') return;
    setMessages((prev) => [...prev, createMessage('user', prompt)]);
    setHistorySkip((n) => n + 1);
    setStatus('streaming');
    setCurrentTranscript('');
    setCurrentTTS(null);

    // Texte et voix arrivent pendant que le modèle écrit ; la réponse complète clôt le flux
    let data: Reponse = {};
    try {
      const res = await fetch('/api/chat/flux', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ prompt }) });
      if (res.ok && res.body && res.headers.get('Content-Type')?.startsWith('text/event-stream')) {
        let complet = '';
        for await (const { type, donnees } of lireEvenements(res.body)) {
          if (type === 'texte') {
            complet += donnees.delta;
            ecoute?.texte(complet);
          }
          if (type === 'audio') ecoute?.audio(donnees.pcm);
          if (type === 'secours') ecoute?.secours();
          if (type === 'fin') data = donnees;
        }
      } else if (res.ok) {
        data = (await res.json().catch(() => null)) || {};
      }
    } catch (err) {
      console.error('[chat] envoi :', err);
    }
    const text = data.reply?.trim() || (data.commands?.length ? CHAT_UI.applyRequestFallback : '');
    if (text) setHistorySkip((n) => n + 1);
    // Réponse vide ou en erreur : un message lisible, dit puis suivi du retour au repos
    applyResponse(data, text || INDISPONIBLE);
  }, [status, applyResponse]);

  const sendAuth = useCallback(async (mode: 'register' | 'login' | 'visitor', body: Record<string, string>, welcome?: Promise<string>) => {
    setStatus('streaming');
    setCurrentTranscript('');
    setCurrentTTS(null);
    const res = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
      .catch((err) => {
        console.error(`[auth] ${mode} :`, err);
        return null;
      });
    const data: Reponse | null = await res?.json().catch(() => null);
    if (!res?.ok || !data) {
      setStatus('idle');
      throw new Error(data?.error || INDISPONIBLE);
    }
    // L'accueil du recruteur, s'il est fourni, remplace celui du backend
    const recruteur = await welcome;
    applyResponse(data, recruteur || data.reply || '');
  }, [applyResponse]);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages) return;
    try {
      const older = await fetchHistory(historySkip);
      setMessages((prev) => [...older, ...prev]);
      setHistorySkip((n) => n + older.length);
      setHasMoreMessages(older.length >= HISTORY_LIMIT);
    } catch (err) {
      console.error('[chat] messages précédents :', err);
    }
  }, [hasMoreMessages, historySkip]);

  return {
    messages,
    status,
    send,
    sendAuth,
    currentTranscript,
    currentTTS,
    currentUserId,
    isNewProfile,
    loadMoreMessages,
    hasMoreMessages,
  };
}
