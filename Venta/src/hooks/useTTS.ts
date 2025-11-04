'use client';

import { useState, useCallback } from 'react';

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const speakWithBrowser = useCallback((text: string, onEnd: () => void) => {
    if (!('speechSynthesis' in window)) {
      console.error('❌ Web Speech API non supportée');
      setTimeout(onEnd, 5000);
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const frenchVoice = voices.find(voice => voice.lang.startsWith('fr'));
    if (frenchVoice) utterance.voice = frenchVoice;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setAudioLevel(0);
      onEnd();
    };
    utterance.onerror = (e) => {
      console.error('❌ Web Speech API erreur:', e);
      setIsSpeaking(false);
      setAudioLevel(0);
      setTimeout(onEnd, 5000);
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const playAudio = useCallback((
    audioBlob: Blob,
    setupVisualization: (audio: HTMLAudioElement, callback: (level: number) => void) => void,
    onEnd: () => void
  ) => {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    setupVisualization(audio, (level) => setAudioLevel(level));
    audio.onplay = () => setIsSpeaking(true);
    audio.onended = () => {
      setIsSpeaking(false);
      setAudioLevel(0);
      onEnd();
      URL.revokeObjectURL(audioUrl);
    };
    audio.onerror = (e) => {
      console.error('❌ Erreur lecture audio:', e);
      URL.revokeObjectURL(audioUrl);
      speakWithBrowser('', onEnd);
    };
    
    audio.play();
  }, [speakWithBrowser]);

  const speakWithAPI = useCallback(async (
    text: string, 
    setupVisualization: (audio: HTMLAudioElement, callback: (level: number) => void) => void,
    onEnd: () => void
  ) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.warn('⚠️ TTS API erreur');
        speakWithBrowser(text, onEnd);
        return;
      }

      const contentType = response.headers.get('Content-Type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (data.useClientTTS && data.text) {
          speakWithBrowser(data.text, onEnd);
          return;
        }
      }

      const audioBlob = await response.blob();
      if (audioBlob.size === 0) {
        console.warn('⚠️ Audio vide reçu');
        speakWithBrowser(text, onEnd);
        return;
      }
      
      playAudio(audioBlob, setupVisualization, onEnd);
    } catch (error) {
      console.error('❌ Erreur synthèse vocale:', error);
      speakWithBrowser(text, onEnd);
    }
  }, [speakWithBrowser, playAudio]);

  /**
   * Joue l'audio directement depuis des données base64 (reçu du backend)
   */
  const speakWithBase64 = useCallback(async (
    base64Audio: string,
    setupVisualization: (audio: HTMLAudioElement, callback: (level: number) => void) => void,
    onEnd: () => void
  ) => {
    try {
      // Convertir base64 en Blob
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      
      if (audioBlob.size === 0) {
        console.warn('⚠️ Audio vide reçu depuis base64');
        onEnd();
        return;
      }
      
      playAudio(audioBlob, setupVisualization, onEnd);
    } catch (error) {
      console.error('❌ Erreur lecture audio base64:', error);
      onEnd();
    }
  }, [playAudio]);

  return {
    isSpeaking,
    audioLevel,
    speakWithBrowser,
    speakWithAPI,
    speakWithBase64
  };
}

