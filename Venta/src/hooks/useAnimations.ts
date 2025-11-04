'use client';

import { useRef, useCallback } from 'react';

export function useAnimations() {
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startStandbyAnimation = useCallback(() => {
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }
    // Logique simplifiée - l'animation est maintenant gérée par le composant HexagonalAnimation
  }, []);

  const startThinkingAnimation = useCallback(() => {
    if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current);
    thinkingTimeoutRef.current = setTimeout(() => {
      startStandbyAnimation();
    }, 10000);
  }, [startStandbyAnimation]);

  const startSpeakAnimation = useCallback(() => {
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }
  }, []);

  return {
    startStandbyAnimation,
    startThinkingAnimation,
    startSpeakAnimation
  };
}

