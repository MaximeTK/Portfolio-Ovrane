'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { sendTrackingLink } from '@/lib/tracking';
import { getOrCreateUserId, getStoredUserId } from '@/lib/userId';

export function UrlTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

    // S'assurer qu'on a un userId stable (créé si absent)
    const storedUserId = getStoredUserId() || getOrCreateUserId();

    console.log('👤 [TRACKING] userId:', storedUserId, '-> Envoi');
    sendTrackingLink(storedUserId, fullUrl);
  }, [pathname, searchParams]);

  return null;
}
