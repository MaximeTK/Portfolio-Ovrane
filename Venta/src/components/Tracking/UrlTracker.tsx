'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { sendTrackingLink } from '@/lib/tracking';
import { getUserIdChangedEventName, isValidUserId } from '@/lib/userId';

export function UrlTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userIdRef = useRef<string | null>(null);

  // Écouter la confirmation/changement de userId (après saisie du pseudo, etc.)
  useEffect(() => {
    // Ne pas lire le localStorage au chargement: on ne fait rien avant le pseudo.
    userIdRef.current = null;

    const eventName = getUserIdChangedEventName();
    const handler = (evt: Event) => {
      const e = evt as CustomEvent<{ userId?: string }>;
      const next = e?.detail?.userId;
      userIdRef.current = isValidUserId(next) ? next : null;
    };

    window.addEventListener(eventName, handler as EventListener);
    return () => window.removeEventListener(eventName, handler as EventListener);
  }, []);

  useEffect(() => {
    // On veut tracker à chaque changement d'URL, pas seulement au montage
    // Donc on retire le check initialized.current pour les changements de route, 
    // mais on veut éviter le double log en dev mode.
    // Cependant, pour le tracking, il vaut mieux envoyer deux fois que pas du tout (le backend dédoublonne).
    
    // Construire l'URL complète d'arrivée
    // Note: pathname inclut le slash initial (ex: "/exemple1")
    let fullUrl = window.location.origin + pathname;
    
    if (searchParams.toString()) {
      fullUrl += `?${searchParams.toString()}`;
    }

    console.log('📍 [TRACKING] Détection URL:', fullUrl);

    // IMPORTANT: On ne track PAS tant que l'utilisateur n'a pas un profil confirmé
    // (plus de profils temporaires / userId implicite).
    const userId = userIdRef.current;
    if (!userId) {
      console.log('⏸️ [TRACKING] Aucun userId confirmé, tracking ignoré.');
      return;
    }

    console.log('👤 [TRACKING] userId:', userId, '-> Envoi');
    sendTrackingLink(userId, fullUrl);
  }, [pathname, searchParams]);

  return null;
}
