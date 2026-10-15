/**
 * Découpage structurel des documents Markdown du RAG
 */

// ~350 tokens à 4 caractères par token
const MAX_CARACTERES = 1400;

function regrouperParagraphes(texte) {
  if (texte.length <= MAX_CARACTERES) return [texte];
  const morceaux = [];
  let courant = '';
  for (const paragraphe of texte.split(/\n\s*\n/)) {
    if (courant && courant.length + paragraphe.length + 2 > MAX_CARACTERES) {
      morceaux.push(courant);
      courant = paragraphe;
    } else {
      courant = courant ? `${courant}\n\n${paragraphe}` : paragraphe;
    }
  }
  if (courant) morceaux.push(courant);
  return morceaux;
}

/**
 * Un passage par section #/##/### qui porte du texte, préfixé de son fil d'Ariane pour l'embedding et BM25
 */
export function decouperMarkdown(contenu, document) {
  const passages = [];
  const titres = [];
  let lignes = [];
  let dansCode = false;

  const vider = () => {
    const texte = lignes.join('\n').trim();
    lignes = [];
    if (!texte) return;
    const section = titres.filter(Boolean).join(' > ') || document;
    for (const morceau of regrouperParagraphes(texte)) {
      passages.push({ document, section, texte: morceau, prefixe: `${section}\n\n${morceau}` });
    }
  };

  for (const ligne of contenu.split(/\r?\n/)) {
    if (ligne.trimStart().startsWith('```')) dansCode = !dansCode;
    const titre = !dansCode && /^(#{1,3})\s+(.+)$/.exec(ligne);
    if (!titre) {
      lignes.push(ligne);
      continue;
    }
    vider();
    // Un titre ferme les niveaux plus profonds que le sien
    titres.length = titre[1].length;
    titres[titre[1].length - 1] = titre[2].trim();
  }
  vider();
  return passages;
}
