'use client';

import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/lib/uiStore';
import { PROJETS, trouverProjet } from './projets';
import { ProjectPage, Sommaire } from './ProjectPage';
import { LegalPage } from './LegalPage';
import { ReglagesPage } from './ReglagesPage';
import { ConnexionPage } from './ConnexionPage';
import type { useChatController } from '@/features/chat/useChatController';

// Vues qui ne sont pas des études de cas, et leur titre d'onglet
const VUES: Record<string, string> = { legal: 'Informations légales', reglages: 'Réglages', connexion: 'Compte' };

interface PageViewProps {
  sendAuth: ReturnType<typeof useChatController>['sendAuth'];
  utilisateur: string | null;
}

export function PageView({ sendAuth, utilisateur }: PageViewProps) {
  const page = useUIStore((s) => s.page);
  const setPage = useUIStore((s) => s.setPage);
  const conteneurRef = useRef<HTMLDivElement>(null);
  // Jeton du lien « mot de passe oublié », lu dans le fragment de /connexion avant que l'URL redevienne celle de base
  const [reinit, setReinit] = useState(() =>
    typeof window !== 'undefined' && window.location.pathname === '/connexion' ? new URLSearchParams(window.location.hash.slice(1)).get('reinit') : null,
  );
  // Garde la dernière page affichée pendant le fondu de fermeture
  const [affichee, setAffichee] = useState(page);
  if (page && page !== affichee) setAffichee(page);

  useEffect(() => {
    if (!page || !conteneurRef.current) return;
    conteneurRef.current.scrollTo({ top: 0 });
    conteneurRef.current.focus({ preventScroll: true });
  }, [page]);

  // Une vue ouverte ajoute une entrée d'historique sans changer l'URL, et nomme l'onglet
  useEffect(() => {
    if (page && window.history.state?.page !== page) window.history.pushState({ page }, '');
    const nom = page ? VUES[page] ?? trouverProjet(page)?.nom : undefined;
    const titre = nom ? `${nom} — Ovrane` : 'Ovrane';
    document.title = titre;
    // Next réécrit son titre, plus tard, quand l'URL change (arrivée par /connexion) : celui de la vue est remis
    const veille = new MutationObserver(() => {
      if (document.title !== titre) document.title = titre;
    });
    veille.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => veille.disconnect();
  }, [page]);

  // Le retour arrière du navigateur rouvre la vue précédente, ou l'accueil
  useEffect(() => {
    const retour = (e: PopStateEvent) => setPage(e.state?.page ?? null);
    window.addEventListener('popstate', retour);
    return () => window.removeEventListener('popstate', retour);
  }, [setPage]);

  // /connexion, le lien d'accès à Illusion, ouvre la vue Compte sur l'URL de base
  useEffect(() => {
    if (window.location.pathname !== '/connexion') return;
    setPage('connexion');
    // Après les effets du routeur de Next, qui remettrait sinon l'URL d'arrivée
    const minuteur = setTimeout(() => window.history.replaceState(null, '', '/'));
    return () => clearTimeout(minuteur);
  }, [setPage]);

  const projet = affichee && !VUES[affichee] ? trouverProjet(affichee) : undefined;
  const rang = projet ? PROJETS.indexOf(projet) : -1;

  // Le header n'a plus de fond : le texte qui remonte s'efface avant d'atteindre les onglets
  return (
    <>
    <div
      ref={conteneurRef}
      tabIndex={-1}
      inert={!page}
      aria-hidden={!page}
      className={`fixed inset-0 z-20 overflow-y-auto overscroll-contain outline-none [scrollbar-gutter:stable_both-edges] [touch-action:pan-y] [mask-image:linear-gradient(to_bottom,transparent_56px,black_104px)] transition-all duration-500 ease-in-out ${
        // Ouverte, sans translation : le fond que le verre recopie reste fixe à l'écran
        page ? 'opacity-100 translate-none' : 'pointer-events-none translate-y-8 opacity-0'
      }`}
    >
      <div key={affichee ?? ''} className="apparition">
        {affichee === 'legal' && <LegalPage />}
        {affichee === 'reglages' && <ReglagesPage />}
        {affichee === 'connexion' && (
          <ConnexionPage sendAuth={sendAuth} utilisateur={utilisateur} reinit={reinit} finirReinit={() => setReinit(null)} />
        )}
        {projet && <ProjectPage projet={projet} rang={rang + 1} total={PROJETS.length} suivant={PROJETS[(rang + 1) % PROJETS.length]} />}
      </div>
    </div>
    {projet && <Sommaire key={projet.slug} projet={projet} visible={!!page} />}
    </>
  );
}
