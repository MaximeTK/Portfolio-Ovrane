/**
 * Réponse du modèle : consignes fixes, visiteur, historique, puis passages du RAG et question, du plus stable au plus variable pour le cache
 */
import fs from 'fs';
import { rechercher } from '../rag/ragSystem.js';
import { aPlat } from '../utilisateurs.js';
import { callOpenAI } from './agent.js';
import { OUTILS } from './outils.js';
import { SYSTEM_PROMPTS, MISC_MESSAGES, formatUserInfo, formatCandidatureContext } from '../../messages.js';
import * as log from '../../log.js';

const INSTRUCTIONS = fs.readFileSync(new URL('../../../prompts/instructions.txt', import.meta.url), 'utf8').trim();

// Identique pour tous les messages : c'est le préfixe que le cache de prompt d'OpenAI réutilise
export const SYSTEM_FIXE = `${SYSTEM_PROMPTS.mainContext}\n\n${INSTRUCTIONS}\n\n${SYSTEM_PROMPTS.contextRule}`;

const IMAGE = /\b(montre|montrer|display|affiche|affiches|voir|voirs|afficher|images|image|photo|photos|logos|logo|visuels|visuel|illustration|screenshots|screenshot|captures|capture|interfaces|interface)\b/i;
const COULEUR = /\b(fond|background|arriere-plan|arrière-plan|couleur|palette|themes|thèmes|theme|thème|argenté|gris|noir|doré|jaune|orange|rouge|ecarlate|vert clair|vert_clair|forêt|marée|feuille|aqua|ocean|hopa|gris ciel|gris_ciel|spectre|mauve|rose|cyberpunk|melon|goyavier|marron|vin)\b/i;

// Outils d'interface proposés seulement si l'intention est claire, sinon le modèle multiplie les actions
function outilsPour(prompt) {
  const permis = new Set([
    ...(IMAGE.test(prompt) ? ['getRulePicture', 'getAvailableAssets', 'uiShowPicture'] : []),
    ...(COULEUR.test(prompt) ? ['getAvailableColors', 'uiSetBackground'] : []),
  ]);
  return Object.entries(OUTILS)
    .filter(([name]) => permis.has(name))
    .map(([name, outil]) => ({ type: 'function', name, description: outil.description, parameters: outil.parametres }));
}

const attribut = (valeur) => String(valeur).replace(/"/g, "'");

// Bloc <contexte> des passages retrouvés pour la question et le message précédent, vide si la porte reste fermée
export async function buildRAGContextForPrompt(prompt, precedent) {
  try {
    const { porte, passages, cosinusMax, couverture } = await rechercher(prompt, precedent);
    log.debug(`📚 [RAG] Porte ${porte ? 'ouverte' : 'fermée'} (cosinus ${cosinusMax.toFixed(3)}, couverture ${couverture.toFixed(2)})${porte ? ` : ${passages.map((p) => p.section).join(' | ')}` : ''}`);
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

export async function generateResponse(openai, prompt, user, candidature, ctx) {
  // Les derniers échanges en messages : les relances courtes (« en anglais ») s'y rattachent
  const historique = aPlat(user.conversations)
    .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: String(message.content ?? '').trim() }))
    .filter((message) => message.content);
  const precedent = historique.findLast((message) => message.role === 'user')?.content || '';
  const ragContext = await buildRAGContextForPrompt(prompt, precedent);

  const messages = [
    { role: 'system', content: SYSTEM_FIXE },
    { role: 'system', content: buildVisitorContext(user, candidature) },
    ...historique,
    { role: 'user', content: ragContext ? `${ragContext}\n\n${prompt}` : prompt },
  ];
  const texte = await callOpenAI(openai, messages, outilsPour(prompt), ctx);
  if (!texte) log.warn('[CHAT] Réponse vide du modèle, repli sur la réponse par défaut');
  return texte || MISC_MESSAGES.defaultResponse;
}
