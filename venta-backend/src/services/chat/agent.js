/**
 * Boucle d'agent sur l'API Responses : le modèle répond ou appelle des outils, en un nombre borné de tours
 */
import { config } from '../../config.js';
import { executeToolCall } from './outils.js';
import * as log from '../../log.js';

// Texte final du modèle, vide si les tours sont épuisés ou s'il n'a rien dit
export async function callOpenAI(openai, messages, outils, ctx) {
  const { model, effort, verbosity, maxTours } = config.openai;
  let input = messages;
  for (let tour = 1; tour <= maxTours; tour += 1) {
    const response = await openai.responses.create({
      model,
      input,
      reasoning: { effort },
      text: { verbosity },
      ...(outils.length ? { tools: outils } : {}),
    });
    if (response.usage) {
      log.debug(`💾 [CHAT] Tour ${tour} : ${response.usage.input_tokens} tokens en entrée, dont ${response.usage.input_tokens_details?.cached_tokens ?? 0} en cache`);
    }
    const texte = String(response.output_text ?? '').trim();
    const appels = (response.output || []).filter((sortie) => sortie.type === 'function_call');
    if (!appels.length) return texte;

    // Les résultats repartent au modèle en messages utilisateur
    input = [...input, ...appels.map((appel) => ({ role: 'user', content: `[RÉSULTAT DE LA FONCTION ${appel.name}]\n${executeToolCall(appel, ctx)}` }))];
    // Afficher des images ne demande pas de nouveau tour
    if (appels.every((appel) => appel.name === 'uiShowPicture')) return texte || 'D\'accord — j\'affiche les visuels.';
  }
  log.warn(`[CHAT] Limite de ${maxTours} tours atteinte`);
  return '';
}
