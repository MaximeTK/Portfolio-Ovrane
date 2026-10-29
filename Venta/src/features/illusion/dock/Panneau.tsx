'use client';

import { Fenetre, usePanneau } from './Dock';

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
  pied?: React.ReactNode;
};

// Panneau de la page : une fenêtre à onglets, montrée quand un de ses onglets est ouvert, retirée du rangement quand on la ferme
export function Panneau({ onglets, id = 'panneau', label = 'Panneau de la page' }: { onglets: Onglet[]; id?: string; label?: string }) {
  const { onglet, ouvrir, fermer } = usePanneau();
  const ouvert = onglets.some((o) => o.cle === onglet);
  return (
    <Fenetre id={id} as="aside" className="panneau" hidden={!ouvert} aria-label={label} titrePrise="Glisser pour détacher le panneau"
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) fermer(); }}>
      <header className="p-tete">
        <div className="p-onglets" role="tablist" aria-label="Sous-fenêtres">
          {onglets.map((o) => (
            <button
              key={o.cle}
              type="button"
              role="tab"
              aria-selected={o.cle === onglet}
              className={`p-onglet${o.cle === onglet ? ' actif' : ''}${o.admin ? ' admin-seul' : ''}`}
              onClick={() => ouvrir(o.cle)}
            >
              {o.titre}
              {o.admin && <MarqueAdmin />}
            </button>
          ))}
        </div>
        <button type="button" className="f-btn" title="Fermer le panneau" aria-label="Fermer le panneau" onClick={fermer}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      {onglets.map((o) => (
        <section
          key={o.cle}
          role="tabpanel"
          className={`p-vue${o.cle === onglet ? ' ouverte' : ''}`}
          aria-label={o.label ?? (typeof o.titre === 'string' ? o.titre : undefined)}
        >
          <div className="f-corps">{o.corps}</div>
          {o.pied && <footer className="f-pied">{o.pied}</footer>}
        </section>
      ))}
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
