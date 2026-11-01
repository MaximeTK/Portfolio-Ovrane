'use client';

import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DUREES, ecrire } from '../partage/glyphes';
import { Fenetre, usePanneau, useVues, type Vue } from './Dock';

export function MarqueAdmin() {
  return <span className="marque-admin">ADMIN</span>;
}

export type Onglet = {
  cle: string;
  titre: React.ReactNode;
  // Nom de la vue pour les lecteurs d'écran quand le titre n'est pas un texte
  label?: string;
  // Étiquette ADMIN, et onglet caché si le compte n'est pas admin
  admin?: boolean;
  corps: React.ReactNode;
  // `true` : un pied vide que le corps remplit par <AuPied>, avec l'état de sa fenêtre
  pied?: React.ReactNode;
};

const CROIX = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;

// Hexagone de focus, celui de la sélection : allumé sur la fenêtre qui reçoit le clic gauche
function Focus({ id }: { id: string }) {
  const { focus, focaliser } = useVues();
  return (
    <input type="checkbox" className="case" checked={focus === id} onChange={() => focaliser(id)}
      aria-label="Fenêtre en focus : le clic gauche y ouvre les fiches" title="Fenêtre en focus : le clic gauche y ouvre les fiches" />
  );
}

// Le pied de la vue où l'on est : un corps y pose ses commandes, qui partagent ainsi son état (confirmation, occupé, formulaire)
const Pied = createContext<HTMLElement | null>(null);
export function AuPied({ children }: { children: React.ReactNode }) {
  const pied = useContext(Pied);
  return pied ? createPortal(children, pied) : null;
}

// Corps et pied d'un onglet ; `serie` remonte le corps à chaque nouvel élément
function CorpsEtPied({ o, serie }: { o: Onglet; serie?: number }) {
  const [pied, setPied] = useState<HTMLElement | null>(null);
  return (
    <Pied.Provider value={pied}>
      <div key={serie} className="f-corps">{o.corps}</div>
      {o.pied && <footer ref={setPied} className="f-pied" data-porte={o.pied === true || undefined}>{o.pied}</footer>}
    </Pied.Provider>
  );
}

// Ce que la page sait montrer d'un élément, par sorte : l'onglet d'un objet (« fiche-offre » → la fiche de cette offre)
export type Elements = Record<string, (objet: string) => Onglet | null>;
// L'onglet d'un élément d'une fenêtre, construit par la page vivante
const element = (elements: Elements | undefined, cle: string | null, objets: Record<string, string>) =>
  (cle && elements?.[cle] && objets[cle] !== undefined ? elements[cle](objets[cle]) : null);

// Panneau de la page et fenêtres du clic droit ; ses onglets : les éléments montrés (le dernier objet de chaque sorte), puis les outils de la page
export function Panneau({ onglets, elements, label = 'Panneau de la page' }: { onglets: Onglet[]; elements?: Elements; label?: string }) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const { vues, focaliser, ailleurs } = useVues();
  const objets = vues[0].objets;
  const liste = [
    ...Object.keys(elements ?? {}).map((cle) => element(elements, cle, objets)).filter((o): o is Onglet => !!o),
    ...onglets.filter((o) => !elements?.[o.cle]),
  ];
  const ouvert = liste.some((o) => o.cle === onglet);
  // Fermé, il garde sa dernière vue le temps qu'elle s'efface et que la fenêtre se replie
  const [derniere, setDerniere] = useState(onglet);
  if (ouvert && derniere !== onglet) setDerniere(onglet);
  const montree = ouvert ? onglet : derniere;

  return (
    <>
      <Fenetre id="panneau" as="aside" className="panneau" hidden={!ouvert} passage="ecrit" aria-label={label} titrePrise="Glisser pour détacher le panneau"
        onPointerDownCapture={() => focaliser('panneau')}
        onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) fermer(); }}>
        <header className="p-tete">
          <Focus id="panneau" />
          <div className="p-onglets" role="tablist" aria-label="Sous-fenêtres">
            {liste.map((o) => (
              <button
                key={o.cle}
                type="button"
                role="tab"
                aria-selected={o.cle === onglet}
                className={`p-onglet${o.cle === onglet ? ' actif' : ''}${o.admin ? ' admin-seul' : ''}`}
                onClick={() => ouvrir(o.cle)}
                // Clic droit sur l'onglet d'un élément : cet élément dans une nouvelle fenêtre
                onContextMenu={(e) => {
                  if (!elements?.[o.cle]) return;
                  e.preventDefault();
                  ailleurs(o.cle, objets[o.cle]);
                }}
              >
                {o.titre}
                {o.admin && <MarqueAdmin />}
              </button>
            ))}
          </div>
          <button type="button" className="f-btn" title="Fermer le panneau" aria-label="Fermer le panneau" onClick={fermer}>{CROIX}</button>
        </header>
        {liste.map((o) => (
          <section
            // Un autre objet de la même sorte repart de zéro : rien de l'ancien (saisie, confirmation) ne reste
            key={`${o.cle} ${elements?.[o.cle] ? objets[o.cle] : ''}`}
            role="tabpanel"
            className={`p-vue${o.cle === montree ? ' ouverte' : ''}`}
            aria-label={o.label ?? (typeof o.titre === 'string' ? o.titre : undefined)}
          >
            <CorpsEtPied o={o} />
          </section>
        ))}
      </Fenetre>
      {vues.slice(1).map((v) => <FenetreEnPlus key={v.id} vue={v} elements={elements} />)}
    </>
  );
}

// Fenêtre ouverte au clic droit : un élément ; un autre ouvert ici s'y écrit
function FenetreEnPlus({ vue, elements }: { vue: Vue; elements?: Elements }) {
  const { focaliser, fermerVue } = useVues();
  const o = element(elements, vue.cle, vue.objets);
  const contenu = useRef<HTMLElement>(null);
  const serie = useRef(vue.serie);
  useLayoutEffect(() => {
    if (serie.current === vue.serie || !contenu.current) return;
    serie.current = vue.serie;
    const c = ecrire(contenu.current, { duree: DUREES.contenu });
    return () => c.annuler();
  }, [vue.serie]);
  return (
    <Fenetre id={vue.id} as="aside" className="panneau" hidden={!!vue.ferme} aria-label={o?.label ?? 'Fiche'} titrePrise="Glisser pour détacher la fenêtre"
      onPointerDownCapture={() => focaliser(vue.id)}
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) fermerVue(vue.id); }}>
      <header className="p-tete">
        <Focus id={vue.id} />
        <div className="p-onglets">
          <span className="p-onglet actif">{o?.titre}</span>
        </div>
        <button type="button" className="f-btn" title="Fermer la fenêtre" aria-label="Fermer la fenêtre" onClick={() => fermerVue(vue.id)}>{CROIX}</button>
      </header>
      {o && (
        <section ref={contenu} className="p-vue ouverte" aria-label={o.label ?? (typeof o.titre === 'string' ? o.titre : undefined)}>
          <CorpsEtPied o={o} serie={vue.serie} />
        </section>
      )}
    </Fenetre>
  );
}

type ProprietesConfirmer = {
  // La question, en gras et pour les lecteurs d'écran : « Supprimer 2 offres ? »
  question: string;
  detail?: React.ReactNode;
  action: string;
  admin?: boolean;
  occupe?: boolean;
  onConfirmer: () => void;
  onAnnuler: () => void;
};

// Barre de confirmation : posée juste après la rangée .outils d'une fenêtre, elle en prend la place tant qu'elle est rendue
export function Confirmer({ question, detail, action, admin, occupe, onConfirmer, onAnnuler }: ProprietesConfirmer) {
  return (
    <div className="confirmer" role="alertdialog" aria-label={question} onKeyDown={(e) => {
      if (e.key !== 'Escape') return;
      // Échap ferme la barre seule, pas le panneau qui la porte
      e.preventDefault();
      onAnnuler();
    }}>
      <p>
        <b>{question}</b>
        {admin && <MarqueAdmin />}
        {detail && <> {detail}</>}
      </p>
      <button type="button" className="action" onClick={onAnnuler} autoFocus>Annuler</button>
      <button type="button" className="action rouge-plein" onClick={onConfirmer} disabled={occupe}>{action}</button>
    </div>
  );
}
