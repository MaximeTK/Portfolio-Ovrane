/** Réponse du modèle : du plus stable au plus variable pour le cache */
import fs from 'fs';
import { rechercher } from '../rag/ragSystem.js';
import { normaliser } from '../rag/recherche.js';
import { aPlat } from '../utilisateurs.js';
import { callOpenAI } from './agent.js';
import { OUTILS } from './outils.js';
import { SYSTEM_PROMPTS, MISC_MESSAGES, formatUserInfo, formatCandidatureContext } from '../../messages.js';
import * as log from '../../log.js';

const INSTRUCTIONS = fs.readFileSync(new URL('../../../prompts/instructions.txt', import.meta.url), 'utf8').trim();

// Identique pour tous les messages : préfixe réutilisé par le cache d'OpenAI
export const SYSTEM_FIXE = `${SYSTEM_PROMPTS.mainContext}\n\n${INSTRUCTIONS}\n\n${SYSTEM_PROMPTS.contextRule}`;

const IMAGE = /\b(montre|montrer|display|affiche|affiches|voir|voirs|afficher|images|image|photo|photos|logos|logo|visuels|visuel|illustration|screenshots|screenshot|captures|capture|interfaces|interface)\b/i;
const COULEUR = /\b(fond|background|arriere-plan|couleur|palette|themes|theme|argente|gris|noir|dore|jaune|orange|rouge|ecarlate|vert clair|vert_clair|foret|maree|feuille|aqua|ocean|hopa|gris ciel|gris_ciel|spectre|mauve|rose|cyberpunk|melon|goyavier|marron|vin)\b/i;

// Outils d'interface seulement si l'intention est claire, sinon trop d'actions
function outilsPour(prompt) {
  // Sans accents : \b ne voit pas de début de mot devant « é » (« écarlate »)
  const texte = normaliser(prompt);
  const permis = new Set([
    ...(IMAGE.test(texte) ? ['getRulePicture', 'getAvailableAssets', 'uiShowPicture'] : []),
    ...(COULEUR.test(texte) ? ['getAvailableColors', 'uiSetBackground'] : []),
  ]);
  return Object.entries(OUTILS)
    .filter(([name]) => permis.has(name))
    .map(([name, outil]) => ({ type: 'function', name, description: outil.description, parameters: outil.parametres }));
}

const attribut = (valeur) => String(valeur).replace(/"/g, "'");

// Bloc <contexte> des passages retrouvés, vide si la porte reste fermée
export async function buildRAGContextForPrompt(prompt, precedent, reponse, signal) {
  try {
    const { porte, passages, cosinusMax, couverture, requete } = await rechercher(prompt, precedent, reponse, signal);
    log.debug(`📚 [RAG] Porte ${porte ? 'ouverte' : 'fermée'} (cosinus ${cosinusMax.toFixed(3)}, couverture ${couverture.toFixed(2)})${requete !== prompt ? ` ; requête « ${requete} »` : ''}${porte ? ` : ${passages.map((p) => p.section).join(' | ')}` : ''}`);
    if (!porte) return '';
    const sources = passages.map((p) => `<source document="${attribut(p.document)}" section="${attribut(p.section)}">\n${p.texte}\n</source>`);
    return `<contexte>\n${sources.join('\n')}\n</contexte>`;
  } catch (error) {
    log.error('[RAG] Recherche impossible :', error.message);
    return '';
  }
}

// Candidature du recruteur, nom et visites, fond actuel
export function buildVisitorContext(user, candidature = null) {
  return `${formatCandidatureContext(candidature)}${formatUserInfo(user.name, user.visitCount)}\n\nFOND ACTUEL (palette): ${user.preferences?.backgroundColor || 'default'}`;
}

export async function generateResponse(openai, prompt, user, candidature, ctx, surTexte) {
  // Derniers échanges en messages : les relances courtes s'y rattachent
  const historique = aPlat(user.conversations)
    .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: String(message.content ?? '').trim() }))
    .filter((message) => message.content);
  const precedent = historique.findLast((message) => message.role === 'user')?.content || '';
  const derniere = historique.findLast((message) => message.role === 'assistant')?.content || '';
  const ragContext = await buildRAGContextForPrompt(prompt, precedent, derniere, ctx.signal);

  const messages = [
    { role: 'system', content: SYSTEM_FIXE },
    { role: 'system', content: buildVisitorContext(user, candidature) },
    ...historique,
    { role: 'user', content: ragContext ? `${ragContext}\n\n${prompt}` : prompt },
  ];
  const texte = await callOpenAI(openai, messages, outilsPour(prompt), ctx, surTexte);
  if (!texte) log.warn('[CHAT] Réponse vide du modèle, repli sur la réponse par défaut');
  return texte || MISC_MESSAGES.defaultResponse;
}
