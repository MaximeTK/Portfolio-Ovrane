/**
 * Construction des prompts pour OpenAI
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { rechercher } from './rag/ragSystem.js';
import {
  SYSTEM_PROMPTS,
  ERROR_MESSAGES,
  formatUserInfo,
  formatCandidatureContext
} from './messages.js';
import { debug } from './log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INSTRUCTIONS = fs.readFileSync(path.join(__dirname, '..', '..', 'prompts', 'instructions.txt'), 'utf8').trim();

// Identique pour tous les messages : c'est le préfixe que le cache de prompt d'OpenAI réutilise
export const SYSTEM_FIXE = `${SYSTEM_PROMPTS.mainContext}\n\n${INSTRUCTIONS}\n\n${SYSTEM_PROMPTS.contextRule}`;

const attribut = (valeur) => String(valeur).replace(/"/g, "'");

/**
 * Bloc <contexte> des passages retrouvés pour la question et le message précédent, vide si la porte reste fermée
 */
export async function buildRAGContextForPrompt(prompt, precedent, ragInitialized) {
  if (!ragInitialized) {
    return { ragContext: '', ragSources: [], ragCoverage: 'disabled' };
  }

  try {
    const { porte, passages, cosinusMax, couverture } = await rechercher(prompt, precedent);
    debug(`📚 [RAG] Porte ${porte ? 'ouverte' : 'fermée'} (cosinus ${cosinusMax.toFixed(3)}, couverture ${couverture.toFixed(2)})${porte ? ` : ${passages.map((p) => p.section).join(' | ')}` : ''}`);
    if (!porte) {
      return { ragContext: '', ragSources: [], ragCoverage: 'none' };
    }
    const sources = passages.map((p) => `<source document="${attribut(p.document)}" section="${attribut(p.section)}">\n${p.texte}\n</source>`);
    return {
      ragContext: `<contexte>\n${sources.join('\n')}\n</contexte>`,
      ragSources: [...new Set(passages.map((p) => p.document))],
      ragCoverage: 'good'
    };
  } catch (error) {
    console.error(`❌ [BACKEND] ${ERROR_MESSAGES.ragRetrievalError}`, error.message);
    return { ragContext: '', ragSources: [], ragCoverage: 'error' };
  }
}

/**
 * Contexte du visiteur : candidature du recruteur, nom et visites, fond actuel
 */
export function buildVisitorContext(userProfile, candidature = null) {
  const bgPref = userProfile?.preferences?.backgroundColor ? String(userProfile.preferences.backgroundColor) : 'default';
  return `${formatCandidatureContext(candidature)}${formatUserInfo(userProfile.name, userProfile.visitCount)}\n\nFOND ACTUEL (palette): ${bgPref}`;
}
