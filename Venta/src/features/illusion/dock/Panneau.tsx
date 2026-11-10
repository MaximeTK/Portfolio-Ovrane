'use client';

import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DUREES, ecrire } from '../partage/glyphes';
import { Fenetre, usePanneau, useVues, type Vue } from './Dock';
import { Action } from '../elements/Action';
import { Case } from '../elements/Case';
import { ICONES } from '../elements/icones';

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
  // `true` : un pied vide que le corps remplit par <AuPied>
  pied?: React.ReactNode;
};


// La croix d'une fenêtre : `titre` à l'infobulle, `label` aux lecteurs d'écran
export function BoutonFermer({ titre, label = titre, onClick }: { titre: string; label?: string; onClick: () => void }) {
  return <button type="button" className="f-btn" title={titre} aria-label={label} onClick={onClick}>{ICONES.croix_dock}</button>;
}

// Hexagone de focus : allumé sur la fenêtre qui reçoit le clic gauche
function Focus({ id }: { id: string }) {
  const { focus, focaliser } = useVues();
  return (
    <Case checked={focus === id} onChange={() => focaliser(id)} aria-label="Fenêtre en focus : le clic gauche y ouvre les fiches" title="Fenêtre en focus : le clic gauche y ouvre les fiches" />
  );
}

// Le pied de la vue : un corps y pose ses commandes, qui partagent son état
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

// Ce que la page sait montrer d'un élément, par sorte
export type Elements = Record<string, (objet: string) => Onglet | null>;
// L'onglet d'un élément d'une fenêtre, construit par la page vivante
const element = (elements: Elements | undefined, cle: string | null, objets: Record<string, string>) =>
  (cle && elements?.[cle] && objets[cle] !== undefined ? elements[cle](objets[cle]) : null);

// Le panneau d'une page et ses onglets ; `vue` : une fenêtre du clic droit
export function Panneau({ onglets = [], elements, label = 'Panneau de la page', vue }: { onglets?: Onglet[]; elements?: Elements; label?: string; vue?: Vue }) {
  const { onglet, ouvrir, fermer: fermerPanneau } = usePanneau();
  const { vues, focaliser, fermerVue, ailleurs } = useVues();
  const objets = (vue ?? vues[0]).objets;
  const seul = vue ? element(elements, vue.cle, objets) : null;
  const liste = vue ? (seul ? [seul] : []) : [
    ...Object.keys(elements ?? {}).map((cle) => element(elements, cle, objets)).filter((o): o is Onglet => !!o),
    ...onglets.filter((o) => !elements?.[o.cle]),
  ];
  const id = vue?.id ?? 'panneau';
  const fermer = vue ? () => fermerVue(vue.id) : fermerPanneau;
  const ouvert = liste.some((o) => o.cle === onglet);
  // Fermé, il garde sa dernière vue le temps que la fenêtre se replie
  const [derniere, setDerniere] = useState(onglet);
  if (!vue && ouvert && derniere !== onglet) setDerniere(onglet);
  const montree = vue ? seul?.cle : ouvert ? onglet : derniere;
  // Un autre élément ouvert dans une fenêtre du clic droit s'y écrit
  const contenu = useRef<HTMLElement>(null);
  const serie = useRef(vue?.serie);
  useLayoutEffect(() => {
    if (serie.current === vue?.serie || !contenu.current) return;
    serie.current = vue?.serie;
    const c = ecrire(contenu.current, { duree: DUREES.contenu });
    return () => c.annuler();
  }, [vue?.serie]);

  return (
    <>
      <Fenetre id={id} as="aside" className="panneau" hidden={vue ? !!vue.ferme : !ouvert} passage={vue ? undefined : 'ecrit'} aria-label={vue ? seul?.label ?? 'Fiche' : label}
        titrePrise={vue ? undefined : 'Glisser pour détacher le panneau'} onPointerDownCapture={() => focaliser(id)}
        onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) fermer(); }}>
        <header className="p-tete">
          <Focus id={id} />
          {vue ? (
            <div className="p-onglets">
              <span className="p-onglet actif">{seul?.titre}</span>
            </div>
          ) : (
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
          )}
          <BoutonFermer titre={vue ? 'Fermer la fenêtre' : 'Fermer le panneau'} onClick={fermer} />
        </header>
        {liste.map((o) => (
          <section
            // Un autre objet de la même sorte repart de zéro, sans rien de l'ancien
            key={vue ? 'seul' : `${o.cle} ${elements?.[o.cle] ? objets[o.cle] : ''}`}
            ref={vue ? contenu : undefined}
            role={vue ? undefined : 'tabpanel'}
            className={`p-vue${o.cle === montree ? ' ouverte' : ''}`}
            aria-label={o.label ?? (typeof o.titre === 'string' ? o.titre : undefined)}
          >
            <CorpsEtPied o={o} serie={vue?.serie} />
          </section>
        ))}
      </Fenetre>
      {!vue && vues.slice(1).map((v) => <Panneau key={v.id} vue={v} elements={elements} />)}
    </>
  );
}

type ProprietesConfirmer = {
  // La question, en gras et pour les lecteurs d'écran : « Supprimer 2 offres ? »
  question: string;
  detail?: React.ReactNode;
  action: string;
  admin?: boolean;
  // État partagé avec la page ; sinon le geste en cours suffit à griser
  occupe?: boolean;
  onConfirmer: () => void | Promise<unknown>;
  onAnnuler: () => void;
};

// Confirmation : prend la place de la rangée .outils tant qu'elle est rendue
export function Confirmer({ question, detail, action, admin, occupe, onConfirmer, onAnnuler }: ProprietesConfirmer) {
  const [enCours, setEnCours] = useState(false);
  const confirmer = async () => {
    setEnCours(true);
    try {
      await onConfirmer();
    } finally {
      setEnCours(false);
    }
  };
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
      <Action onClick={onAnnuler} autoFocus>Annuler</Action>
      <Action className="rouge-plein" onClick={confirmer} disabled={occupe || enCours}>{action}</Action>
    </div>
  );
}
