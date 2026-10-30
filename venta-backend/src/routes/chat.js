/**
 * Chat et historique de l'utilisateur de la session
 */
import { IllusionCandidature } from '../models/IllusionCandidature.js';
import { getUserProfile, historique, profilPublic, MAX_MESSAGES } from '../services/utilisateurs.js';
import { generateResponse } from '../services/chat/generer.js';
import { processResponse } from '../services/chat/reponse.js';
import { consommer } from '../services/budget.js';
import { ouvrirVoixFlux } from '../services/tts.js';
import { sendError, requireSession, ipClient, limite } from '../http.js';
import { ERROR_MESSAGES } from '../messages.js';
import { isNonEmptyString, isValidJeton } from '../validators.js';
import * as log from '../log.js';

const MAX_PROMPT = 4000;

// Candidature Illusion du recruteur venu par un lien suivi ; une erreur ne bloque jamais le chat
async function loadCandidature(jeton) {
  if (!isValidJeton(jeton)) return null;
  try {
    return await IllusionCandidature.findOne({ jeton }).lean();
  } catch (error) {
    log.warn(`[CHAT] Candidature Illusion illisible (${jeton}) :`, error.message);
    return null;
  }
}

const limiteAtteinte = (user) => ({
  reply: ERROR_MESSAGES.limitReached,
  commands: [{ command: 'LockInterface', parameter: 'limit_reached' }],
  userProfile: profilPublic(user),
  activeUserId: user.id,
  tts: { isStaticFile: true, staticUrl: '/endmessage.mp3' },
});

// Plafond de dépense du jour atteint : une réponse fixe, sans appeler le modèle ni la voix
const budgetDepasse = (user) => ({
  reply: ERROR_MESSAGES.budgetReached,
  userProfile: profilPublic(user),
  activeUserId: user.id,
  tts: { useClientTTS: true, text: ERROR_MESSAGES.budgetReached },
});

// Question valide et profil de la session, le message comptant avant l'appel au modèle ; null si une erreur est déjà partie
async function preparer(req, res) {
  const { prompt } = req.body || {};
  const refus = !isNonEmptyString(prompt) ? [400, ERROR_MESSAGES.promptRequired] : prompt.length > MAX_PROMPT ? [413, ERROR_MESSAGES.promptTooLong] : null;
  const user = refus ? null : await getUserProfile(req.user.id, ipClient(req));
  if (!user) sendError(res, ...(refus ?? [401, ERROR_MESSAGES.sessionRequired]));
  return user;
}

export function setupChatRoutes(app, openai) {
  // Par session, comptée sur son utilisateur
  const parSession = limite(60 * 1000, 10, (req) => req.user.id);

  app.post('/api/chat', requireSession, parSession, async (req, res, next) => {
    try {
      const user = await preparer(req, res);
      if (!user) return;
      if (user.messageCount > MAX_MESSAGES) return res.json(limiteAtteinte(user));
      // Avant tout appel payant : le plafond du jour, tous visiteurs confondus
      if (!(await consommer('chat'))) return res.json(budgetDepasse(user));

      const { prompt, isEphemeral, jeton } = req.body;
      const ctx = { uiCommands: [] };
      const texte = await generateResponse(openai, prompt, user, await loadCandidature(jeton), ctx);
      res.json(await processResponse(texte, prompt, user, ctx, isEphemeral === true));
    } catch (error) {
      next(error);
    }
  });

  // Même réponse en flux SSE : morceaux de texte, audio PCM de Cartesia dès les premiers mots, puis la réponse complète
  app.post('/api/chat/flux', requireSession, parSession, async (req, res, next) => {
    let user;
    try {
      user = await preparer(req, res);
      if (!user) return;
    } catch (error) {
      return next(error);
    }
    res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const envoyer = (type, donnees) => res.write(`event: ${type}\ndata: ${JSON.stringify(donnees)}\n\n`);
    if (user.messageCount > MAX_MESSAGES) {
      envoyer('fin', limiteAtteinte(user));
      return res.end();
    }
    if (!(await consommer('chat'))) {
      envoyer('fin', budgetDepasse(user));
      return res.end();
    }

    // Le visiteur qui part arrête le modèle et la voix
    const arret = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) arret.abort();
    });
    // La connexion à Cartesia s'ouvre pendant que le modèle réfléchit
    const voix = ouvrirVoixFlux({ surAudio: (pcm) => envoyer('audio', { pcm }), surEchec: () => envoyer('secours', {}) });
    if (!voix) envoyer('secours', {});
    try {
      const { prompt, isEphemeral, jeton } = req.body;
      const ctx = { uiCommands: [], signal: arret.signal };
      const texte = await generateResponse(openai, prompt, user, await loadCandidature(jeton), ctx, (delta) => {
        envoyer('texte', { delta });
        voix?.dire(delta);
      });
      await voix?.finir();
      envoyer('fin', await processResponse(texte, prompt, user, ctx, isEphemeral === true));
    } catch (error) {
      voix?.annuler();
      if (!arret.signal.aborted) {
        log.error('[CHAT] Flux interrompu :', error.message);
        envoyer('erreur', { error: ERROR_MESSAGES.internalServerError });
      }
    }
    res.end();
  });

  app.get('/api/chat/history', requireSession, async (req, res, next) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 50));
      const skip = Math.min(1000, Math.max(0, parseInt(String(req.query.skip), 10) || 0));
      res.json({ history: await historique(req.user.id, limit, skip) });
    } catch (error) {
      next(error);
    }
  });
}
