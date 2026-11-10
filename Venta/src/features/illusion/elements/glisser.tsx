import type { DragEvent } from 'react';

// Où lâcher : avant ou après la cible, selon la moitié survolée
export function moitieAvant(e: DragEvent, horizontal = false) {
  const r = e.currentTarget.getBoundingClientRect();
  return horizontal ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
}

// La liste avec `quoi` posé contre `cible` ; la même si rien n'a bougé
export function deplacer<T>(liste: T[], quoi: T, cible: T, dessus: boolean) {
  if (quoi === cible) return liste;
  const sans = liste.filter((x) => x !== quoi);
  const i = sans.indexOf(cible) + (dessus ? 0 : 1);
  const neuve = [...sans.slice(0, i), quoi, ...sans.slice(i)];
  return neuve.every((x, n) => x === liste[n]) ? liste : neuve;
}

// La prise d'un glissement ; son clic ne déplie rien autour d'elle
export function Poignee({ classe, titre, prendre, lacher }: { classe: string; titre: string; prendre: (e: DragEvent) => void; lacher: (e: DragEvent) => void }) {
  return (
    <span className={classe} title={titre} aria-hidden="true" draggable
      onClick={(e) => e.preventDefault()}
      onDragStart={(e) => {
        prendre(e);
        e.dataTransfer.effectAllowed = 'move';
        // Firefox n'ouvre un glissement que si des données sont posées
        e.dataTransfer.setData('text/plain', '');
      }}
      onDragEnd={lacher}>⠿</span>
  );
}
