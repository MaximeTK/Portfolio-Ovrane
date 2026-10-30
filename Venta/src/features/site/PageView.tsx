'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useUIStore } from '@/lib/uiStore';
import { INDISPONIBLE } from '@/lib/messages';
import { ErreurIllusion, lireCompte } from '@/features/illusion/api';
import { ADMINISTRATION, MON_ESPACE, PAGE_DEPART, estAdmin, titreDe } from '@/features/illusion/pages/liste';
import { PROJETS, trouverProjet } from './projets';
import { ProjectPage, Sommaire } from './ProjectPage';
import { LegalPage } from './LegalPage';
import { ReglagesPage } from './ReglagesPage';
import { ConnexionPage } from './ConnexionPage';
import type { useChatController } from '@/features/chat/useChatController';

// Illusion ne se charge que pour un compte qui y a accès : le portfolio des visiteurs n'en porte rien
const chargerIllusion = () => import('@/features/illusion/ossature/RacineIllusion');
const VueIllusion = dynamic(chargerIllusion);

// Vues qui ne sont pas des études de cas, et leur titre d'onglet
const VUES: Record<string, string> = { legal: 'Informations légales', reglages: 'Réglages', connexion: 'Compte' };

// La page d'Illusion d'une vue « illusion/<page>?<recherche> », sinon null
function partiesIllusion(vue: string | null) {
  if (!vue?.startsWith('illusion/')) return null;
  const marque = vue.indexOf('?');
  return marque < 0 ? { slug: vue.slice(9), recherche: '' } : { slug: vue.slice(9, marque), recherche: vue.slice(marque + 1) };
}

interface PageViewProps {
  sendAuth: ReturnType<typeof useChatController>['sendAuth'];
  utilisateur: string | null;
}

export function PageView({ sendAuth, utilisateur }: PageViewProps) {
  const page = useUIStore((s) => s.page);
  const setPage = useUIStore((s) => s.setPage);
  const compteIllusion = useUIStore((s) => s.compteIllusion);
  const erreurIllusion = useUIStore((s) => s.erreurIllusion);
  const conteneurRef = useRef<HTMLDivElement>(null);
  // Jeton du lien « mot de passe oublié », lu dans le fragment de /connexion avant que l'URL redevienne celle de base
  const [reinit, setReinit] = useState(() =>
    typeof window !== 'undefined' && window.location.pathname === '/connexion' ? new URLSearchParams(window.location.hash.slice(1)).get('reinit') : null,
  );
  // Arrivée par une adresse d'Illusion (/illusion/<page>?…) : sa page s'ouvre une fois le compte connu
  const [entree] = useState(() => {
    const morceaux = typeof window !== 'undefined' ? /^\/illusion(?:\/([^/]*))?\/?$/.exec(window.location.pathname) : null;
    return morceaux ? { slug: morceaux[1] ?? '', recherche: window.location.search.slice(1) } : null;
  });
  const entreeFaite = useRef(false);
  // Garde la dernière page affichée pendant le fondu de fermeture
  const [affichee, setAffichee] = useState(page);
  if (page && page !== affichee) setAffichee(page);

  useEffect(() => {
    if (!page || !conteneurRef.current) return;
    conteneurRef.current.scrollTo({ top: 0 });
    conteneurRef.current.focus({ preventScroll: true });
  }, [page]);

  // Une vue ouverte ajoute une entrée d'historique, à l'adresse d'Illusion pour ses pages, et nomme l'onglet
  useEffect(() => {
    const illusion = partiesIllusion(page);
    if (page && window.history.state?.page !== page) window.history.pushState({ page }, '', illusion ? `/${page}` : '/');
    // Revenu à l'accueil depuis une page d'Illusion : l'adresse redevient celle du site
    else if (!page && window.history.state?.page && window.location.pathname !== '/') window.history.pushState({ page: null }, '', '/');
    const nom = illusion ? `${titreDe(illusion.slug)} · Illusion` : page ? VUES[page] ?? trouverProjet(page)?.nom : undefined;
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

  // Le compte d'Illusion, relu à chaque connexion ou déconnexion ; un visiteur sans compte Ovrane ne demande rien à Illusion ; son code se prépare dès que l'accès est ouvert
  useEffect(() => {
    let actif = true;
    fetch('/api/auth/compte')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (data?.compte ? lireCompte() : null))
      .then((compte) => {
        if (!actif) return;
        useUIStore.setState({ compteIllusion: compte, erreurIllusion: null });
        if (compte) void chargerIllusion();
      })
      .catch((e) => actif && useUIStore.setState({ compteIllusion: null, erreurIllusion: e instanceof ErreurIllusion && e.message ? e.message : INDISPONIBLE }));
    return () => {
      actif = false;
    };
  }, [utilisateur]);

  // Une adresse d'Illusion ouvre sa page, l'accueil des canaux pour une page inconnue ou réservée ; sans accès, la vue Compte
  useEffect(() => {
    if (!entree || entreeFaite.current || compteIllusion === undefined) return;
    entreeFaite.current = true;
    if (!compteIllusion && !erreurIllusion) {
      window.history.replaceState(null, '', '/');
      setPage('connexion');
      return;
    }
    const connue = entree.slug === 'accueil' || [...MON_ESPACE, ...ADMINISTRATION].some((p) => p.slug === entree.slug);
    const slug = connue && (compteIllusion?.admin || !estAdmin(entree.slug)) ? entree.slug : PAGE_DEPART;
    const vue = `illusion/${slug}${entree.recherche ? `?${entree.recherche}` : ''}`;
    window.history.replaceState({ page: vue }, '', `/${vue}`);
    setPage(vue);
  }, [entree, compteIllusion, erreurIllusion, setPage]);

  // Sans accès à Illusion (déconnexion, retour arrière), ses pages laissent place à la vue Compte
  useEffect(() => {
    if (partiesIllusion(page) && compteIllusion === null && !erreurIllusion) setPage('connexion');
  }, [page, compteIllusion, erreurIllusion, setPage]);

  const illusion = partiesIllusion(affichee);
  const projet = affichee && !VUES[affichee] && !illusion ? trouverProjet(affichee) : undefined;
  const rang = projet ? PROJETS.indexOf(projet) : -1;

  // Le header n'a plus de fond : le texte qui remonte s'efface avant d'atteindre les onglets ; Illusion range ses fenêtres elle-même
  return (
    <>
    <div
      ref={conteneurRef}
      tabIndex={-1}
      inert={!page}
      aria-hidden={!page}
      className={`fixed inset-0 z-20 overflow-y-auto overscroll-contain outline-none ${
        illusion ? '' : '[scrollbar-gutter:stable_both-edges] [touch-action:pan-y] [mask-image:linear-gradient(to_bottom,transparent_56px,black_104px)]'
      } transition-all duration-500 ease-in-out ${
        // Ouverte, sans translation : le fond que le verre recopie reste fixe à l'écran
        page ? 'opacity-100 translate-none' : 'pointer-events-none translate-y-8 opacity-0'
      }`}
    >
      {illusion ? (
        compteIllusion ? (
          <VueIllusion compte={compteIllusion} page={illusion.slug} recherche={illusion.recherche} />
        ) : (
          erreurIllusion && <p role="alert" className="grid min-h-screen place-items-center p-6 text-center font-sans text-white">{erreurIllusion}</p>
        )
      ) : (
        <div key={affichee ?? ''} className="apparition">
          {affichee === 'legal' && <LegalPage />}
          {affichee === 'reglages' && <ReglagesPage />}
          {affichee === 'connexion' && (
            <ConnexionPage sendAuth={sendAuth} utilisateur={utilisateur} reinit={reinit} finirReinit={() => setReinit(null)} />
          )}
          {projet && <ProjectPage projet={projet} rang={rang + 1} total={PROJETS.length} suivant={PROJETS[(rang + 1) % PROJETS.length]} />}
        </div>
      )}
    </div>
    {projet && <Sommaire key={projet.slug} projet={projet} visible={!!page} />}
    </>
  );
}
