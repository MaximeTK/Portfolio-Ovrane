/**
 * Outils offerts au modèle : un objet par outil, exécuté avec le contexte de sa seule requête
 */
import fs from 'fs';
import { isValidAssetFilename, normalizeAssetParamToFilename } from '../../validators.js';
import * as log from '../../log.js';

// Chaque fichier de prompts/ est lu une fois, au chargement
const lire = (nom) => fs.readFileSync(new URL(`../../../prompts/${nom}`, import.meta.url), 'utf8').split(/\r?\n/).map((ligne) => ligne.trim());

const LIGNES_ASSETS = lire('assets.txt');
// Noms d'images valides : seuls ceux-là peuvent être affichés
const IMAGES = new Set(LIGNES_ASSETS.filter(isValidAssetFilename));
// « fichier - description » de chaque visuel
export const ASSETS = [];
let visuel = null;
for (const ligne of LIGNES_ASSETS) {
  if (/^[\w\s]+\.(png|svg|json|lottie|webm)(\s*\/\s*[\w\s]+\.(png|svg|json|lottie|webm))*$/.test(ligne)) visuel = ligne.split('/')[0].trim();
  if (ligne.startsWith('Description :') && visuel) {
    ASSETS.push(`${visuel} - ${ligne.replace('Description :', '').trim()}`);
    visuel = null;
  }
}

// Une palette commence à son identifiant : ligne courte, sans « : », qui n'est pas un titre
const estIdPalette = (ligne) => ligne && !ligne.includes(':') && ligne.length < 20
  && !['LISTE', '⚠️', 'RÈGLES', 'EXEMPLES', 'Si l', '-', 'PALETTES'].some((debut) => ligne.startsWith(debut));
export const PALETTES = [];
for (const ligne of lire('colors.txt')) {
  if (estIdPalette(ligne)) PALETTES.push({ id: ligne });
  const palette = PALETTES.at(-1);
  if (palette && ligne.startsWith('Nom :')) palette.nom = ligne.replace('Nom :', '').trim();
  if (palette && ligne.startsWith('Description :')) palette.description = ligne.replace('Description :', '').trim();
}

const resultat = (success, message) => JSON.stringify({ success, message });
const SANS_PARAMETRE = { type: 'object', properties: {}, required: [] };

export const OUTILS = {
  getRulePicture: {
    description: 'Obtient les règles pour afficher des images. Appelle quand l\'utilisateur demande une image/visuel. Retourne les instructions de process (assets + tool UI).',
    parametres: SANS_PARAMETRE,
    executer: () => `⚠️ RÈGLES D'AFFICHAGE D'IMAGES ⚠️

Tu PEUX afficher des images via un TOOL: uiShowPicture({ filenames: [...] }).

PROCESSUS À SUIVRE:
1. Si tu n'as pas encore appelé getAvailableAssets(), appelle-le MAINTENANT pour obtenir la liste des images disponibles.
2. Choisis un filename EXACT depuis la liste (casse, espaces, extensions).
3. Déclenche l'affichage avec uiShowPicture({ filenames: ["..."] }).
4. Si l'image demandée n'existe pas dans la liste, dis-le clairement et n'appelle PAS uiShowPicture.

RÈGLES IMPORTANTES:
- N'appelle getAvailableAssets() qu'UNE SEULE FOIS maximum par conversation.
- N'écris JAMAIS de slash-commandes dans le texte.

MULTIPLE IMAGES (IMPORTANT - évite les limites):
- N'appelle PAS uiShowPicture plusieurs fois.
- Fais UN SEUL appel: uiShowPicture({ filenames: ["img1.png","img2.png", ...] }).
- Fais une phrase d'introduction globale, puis déclenche l'affichage via ce seul tool call (pas dans le texte).`,
  },

  getAvailableAssets: {
    description: 'Liste toutes les images disponibles (assets). Appelle uniquement si tu ne connais pas le filename exact ou si tu dois valider qu\'il existe, puis appelle uiShowPicture({ filenames: [...] }).',
    parametres: SANS_PARAMETRE,
    executer: () => `✅ LISTE DES IMAGES DISPONIBLES:
${ASSETS.join('\n')}

🎯 INSTRUCTIONS IMPORTANTES:
- Tu dois déclencher l'affichage d'image via un TOOL: uiShowPicture({ filenames: [...] })
- filenames doit être un NOM EXACT issu de la liste ci-dessus (casse/espaces/extensions)
- Si tu dois afficher plusieurs images, fais UN SEUL appel uiShowPicture({ filenames: ["...","..."] })
- N'écris PAS de slash-commandes dans le texte
- N'APPELLE PLUS getAvailableAssets() - tu as déjà toutes les informations nécessaires`,
  },

  getAvailableColors: {
    description: 'Liste les palettes de couleurs. À appeler si l\'utilisateur mentionne une couleur (ex: "en rouge", "rose"), un thème ou demande de changer l\'apparence. Ensuite, déclenche uiSetBackground.',
    parametres: SANS_PARAMETRE,
    executer: () => `✅ RÉFÉRENTIEL INTERNE DES PALETTES (${PALETTES.length}):
${PALETTES.map((p) => `${p.id} — ${p.description || p.nom || ''}`).join('\n')}

🎯 INSTRUCTIONS IMPORTANTES:
- Ce référentiel est INTERNE. Ne le recopie JAMAIS dans ta réponse, ni en liste, ni en tableau.
- Si l'utilisateur demande quelles couleurs existent, réponds en une phrase en citant 3 ou 4 exemples parlants, puis propose de choisir.
- Ne déclenche un changement de fond via un TOOL (uiSetBackground({ paletteId })) QUE si l'utilisateur le demande explicitement
- paletteId doit être un ID EXACT issu du référentiel ci-dessus
- N'écris PAS de slash-commandes dans le texte
- N'APPELLE PLUS getAvailableColors() - tu as déjà toutes les informations nécessaires`,
  },

  uiShowPicture: {
    description: 'Déclenche l\'affichage d\'une ou plusieurs images (assets) dans l\'interface. Utilise TOUJOURS uiShowPicture({ filenames: ["A.png","B.png"] }) pour éviter les limites. À appeler après validation via getAvailableAssets() si nécessaire. Ne pas écrire de slash-commandes dans le texte.',
    parametres: {
      type: 'object',
      properties: {
        filenames: {
          type: 'array',
          description: 'Liste de noms exacts de fichiers image (assets) à afficher en un SEUL appel. Ex: ["Interface Menu Hikup Refonte.png", "Logo Hikup.png"]',
          items: { type: 'string' },
          minItems: 1,
        },
      },
      required: ['filenames'],
    },
    executer({ filename, filenames }, ctx) {
      const demandes = Array.isArray(filenames) && filenames.length ? filenames : (typeof filename === 'string' && filename.trim() ? [filename] : []);
      if (!demandes.length) return resultat(false, 'Paramètres invalides. Utilise uiShowPicture({ filenames: ["A.png", "B.png"] }).');
      const noms = [];
      for (const demande of demandes) {
        const nom = normalizeAssetParamToFilename(demande);
        if (!isValidAssetFilename(nom)) {
          return resultat(false, `filename invalide: "${String(demande)}" (doit être un nom exact de fichier image existant, ex: "CV.png"). N’utilise jamais de PDF. Si tu n’es pas sûr, appelle getAvailableAssets().`);
        }
        // Le modèle n'affiche que les images de la liste, jamais un nom inventé
        if (!IMAGES.has(nom)) {
          return resultat(false, `Asset inconnu: "${nom}". Ne l'invente pas. Appelle getAvailableAssets() et utilise un filename EXACT de la liste.`);
        }
        noms.push(nom);
      }
      const uniques = [...new Set(noms)];
      for (const nom of uniques) ctx.uiCommands.push({ command: 'ShowPicture', parameter: nom });
      return resultat(true, uniques.length === 1 ? `Image demandée: ${uniques[0]}` : `Images demandées (${uniques.length}): ${uniques.join(', ')}`);
    },
  },

  uiSetBackground: {
    description: 'Déclenche le changement de fond (palette). À appeler après avoir validé paletteId via getAvailableColors(). Ne pas écrire de slash-commandes dans le texte.',
    parametres: {
      type: 'object',
      properties: { paletteId: { type: 'string', description: 'ID exact de la palette, ex: "ocean", "purple", "default"' } },
      required: ['paletteId'],
    },
    executer({ paletteId }, ctx) {
      const id = String(paletteId || '').trim();
      if (!id) return resultat(false, 'paletteId manquant');
      ctx.uiCommands.push({ command: 'SetBackground', parameter: id });
      return resultat(true, `Fond demandé: ${id}`);
    },
  },
};

// Les arguments du modèle sont analysés sans jamais lever ; un nom inconnu, ou hérité d'Object, est refusé
export function executeToolCall(appel, ctx) {
  if (!Object.hasOwn(OUTILS, appel.name)) return resultat(false, `Outil indisponible : ${appel.name}.`);
  let args;
  try {
    args = JSON.parse(appel.arguments || '{}');
  } catch {
    return resultat(false, 'Arguments invalides : un objet JSON est attendu.');
  }
  log.debug(`   └─ ${appel.name} ${JSON.stringify(args)}`);
  return OUTILS[appel.name].executer(args && typeof args === 'object' ? args : {}, ctx);
}
