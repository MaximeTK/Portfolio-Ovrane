'use client';

import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/lib/state/uiStore';
import { PROJETS, trouverProjet } from '@/lib/projets';
import { ProjectPage, Sommaire } from './ProjectPage';
import { LegalPage } from './LegalPage';

export function PageView() {
  const page = useUIStore((s) => s.page);
  const conteneurRef = useRef<HTMLDivElement>(null);
  // Garde la dernière page affichée pendant le fondu de fermeture
  const [affichee, setAffichee] = useState(page);
  if (page && page !== affichee) setAffichee(page);

  useEffect(() => {
    if (!page || !conteneurRef.current) return;
    conteneurRef.current.scrollTo({ top: 0 });
    conteneurRef.current.focus({ preventScroll: true });
  }, [page]);

  const projet = affichee && affichee !== 'legal' ? trouverProjet(affichee) : undefined;
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
        page ? 'opacity-100 translate-y-0' : 'pointer-events-none translate-y-8 opacity-0'
      }`}
    >
      <div key={affichee ?? ''} className="apparition">
        {affichee === 'legal' && <LegalPage />}
        {projet && <ProjectPage projet={projet} rang={rang + 1} total={PROJETS.length} suivant={PROJETS[(rang + 1) % PROJETS.length]} />}
      </div>
    </div>
    {projet && <Sommaire key={projet.slug} projet={projet} visible={!!page} />}
    </>
  );
}
