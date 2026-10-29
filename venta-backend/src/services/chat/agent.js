/**
 * Boucle d'agent sur l'API Responses en flux : le modèle répond ou appelle des outils, en un nombre borné de tours
 */
import { config } from '../../config.js';
import { executeToolCall } from './outils.js';
import * as log from '../../log.js';

// Même clé pour tous : les appels partagent le préfixe fixe et retombent sur le même cache
const CLE_CACHE = 'ovrane-chat';

// Texte du modèle, tous tours réunis, vide si les tours sont épuisés ; chaque morceau part aussi dans surTexte dès qu'il arrive
export async function callOpenAI(openai, messages, outils, ctx, surTexte = () => {}) {
  const { model, verbosity, maxTours } = config.openai;
  const effort = outils.length ? config.openai.effortOutils : config.openai.effort;
  let input = messages;
  const textes = [];
  for (let tour = 1; tour <= maxTours; tour += 1) {
    const flux = await openai.responses.create({
      model,
      input,
      reasoning: { effort },
      text: { verbosity },
      prompt_cache_key: CLE_CACHE,
      stream: true,
      ...(outils.length ? { tools: outils } : {}),
    }, { signal: ctx.signal });
    let texte = '';
    let response = null;
    for await (const evenement of flux) {
      if (evenement.type === 'response.output_text.delta') {
        texte += evenement.delta;
        surTexte(evenement.delta);
      }
      if (evenement.type === 'response.completed') response = evenement.response;
    }
    if (!response) throw new Error('flux du modèle interrompu');
    if (response.usage) {
      log.debug(`💾 [CHAT] Tour ${tour} (${effort}) : ${response.usage.input_tokens} tokens en entrée, dont ${response.usage.input_tokens_details?.cached_tokens ?? 0} en cache`);
    }
    if (texte.trim()) textes.push(texte.trim());
    const appels = (response.output || []).filter((sortie) => sortie.type === 'function_call');
    if (!appels.length) return textes.join('\n\n');

    // Les résultats repartent au modèle en messages utilisateur
    input = [...input, ...appels.map((appel) => ({ role: 'user', content: `[RÉSULTAT DE LA FONCTION ${appel.name}]\n${executeToolCall(appel, ctx)}` }))];
    // Afficher des images ne demande pas de nouveau tour
    if (appels.every((appel) => appel.name === 'uiShowPicture')) {
      if (textes.length) return textes.join('\n\n');
      const annonce = 'D\'accord — j\'affiche les visuels.';
      surTexte(annonce);
      return annonce;
    }
  }
  log.warn(`[CHAT] Limite de ${maxTours} tours atteinte`);
  return '';
}
