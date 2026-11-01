// Les brouillons d'Illusion gardés dans ce navigateur : rangés sous le compte qui les a tapés, effacés à la déconnexion
import { useLayoutEffect } from 'react';

const PREFIXE = 'illusion:';
// Les clés d'avant, communes à tous les comptes du navigateur
const ANCIENNES = ['illusion:atelier:', 'illusion:documents:'];

let compte = '';
// Ce que les pages gardent en mémoire pour la session (fenêtres, pièces, fils lus…) : oublié quand le compte change ou se déconnecte
const oublis = new Set<() => void>();
export const aOublier = (f: () => void) => {
  oublis.add(f);
};

// Ce qu'une section a lu ou choisi (données, filtres, page), gardé pour la session : en y revenant, elle le montre aussitôt et se relit derrière
const gardes = new Map<string, unknown>();
aOublier(() => gardes.clear());
// La valeur gardée sous « section:nom », sinon celle de départ : le départ d'un useState
export const repris = <T,>(cle: string, depart: T): T => (gardes.has(cle) ? (gardes.get(cle) as T) : depart);
// Garde à chaque rendu les valeurs de la section, chacune sous « section:nom »
export function useGarder(section: string, valeurs: Record<string, unknown>) {
  useLayoutEffect(() => {
    for (const [nom, valeur] of Object.entries(valeurs)) gardes.set(`${section}:${nom}`, valeur);
  });
}

// Une empreinte courte de l'adresse : sépare les comptes sans écrire l'e-mail en clair dans le navigateur
function empreinte(texte: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function cles() {
  try {
    return Object.keys(localStorage);
  } catch {
    // Navigation privée ou stockage bloqué : aucun brouillon
    return [];
  }
}

/** Le compte dont les brouillons se lisent et s'écrivent ; posé par la racine d'Illusion avant ses pages. */
export function poserCompte(email: string) {
  const neuf = empreinte(email.trim().toLowerCase());
  if (neuf === compte) return;
  if (compte) oublis.forEach((f) => f());
  compte = neuf;
  for (const cle of cles()) if (ANCIENNES.some((a) => cle.startsWith(a))) localStorage.removeItem(cle);
}

/** La clé d'un brouillon (« atelier:parser », « documents:lettre ») pour le compte en cours. */
export const cleBrouillon = (nom: string) => `${PREFIXE}${compte}:${nom}`;

/** Efface tous les brouillons d'Illusion de ce navigateur, quel que soit leur compte : la déconnexion n'en laisse aucun. */
export function effacerBrouillons() {
  compte = '';
  oublis.forEach((f) => f());
  for (const cle of cles()) if (cle.startsWith(PREFIXE)) localStorage.removeItem(cle);
}
