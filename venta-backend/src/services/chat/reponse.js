/**
 * Réponse envoyée au client : texte, commandes d'interface de la requête, fond retenu et échange enregistré
 */
import { addConversation, saveUserPreference, profilPublic } from '../utilisateurs.js';
import { normaliser } from '../rag/recherche.js';
import { PALETTES } from './outils.js';
import { MISC_MESSAGES } from '../../messages.js';
import { normalizeAssetParamToFilename } from '../../validators.js';
import * as log from '../../log.js';

const mots = (texte) => normaliser(texte).replace(/[^a-z0-9_]+/g, ' ').trim().split(' ').filter(Boolean);
const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const estFond = (commande) => commande.command === 'SetBackground';

// Identifiants de palette découpés en mots, les plus longs d'abord (gris_ciel avant gris)
const PALETTES_EN_MOTS = PALETTES
  .map(({ id }) => ({ id, parties: mots(id.replace(/_/g, ' ')) }))
  .filter(({ parties }) => parties.length)
  .sort((a, b) => b.parties.length - a.parties.length);

function paletteDuTexte(texte) {
  const tokens = mots(texte);
  for (const { id, parties } of PALETTES_EN_MOTS) {
    for (let i = 0; i <= tokens.length - parties.length; i += 1) {
      if (parties.every((partie, j) => tokens[i + j] === partie)) return id;
    }
  }
  return null;
}

// Demande explicite de changer le fond ; une question ou une demande de liste ne déclenche rien
function demandeChangementFond(texte) {
  const t = normaliser(texte);
  if (!/background|arriere-plan|fond|palette|theme/.test(t)) return false;
  if (/\b(quel|quels|quelle|quelles|liste|disponible|disponibles|possible|possibles|montre|affiche|voir)\b/i.test(t)) return false;
  return /\b(change|changer|passe|passer|mets|met|mettez|mettre|applique|appliquer|active|activer|set|switch)\b/i.test(t);
}

export async function processResponse(texte, prompt, user, ctx, isEphemeral) {
  let commands = [...ctx.uiCommands];
  let reply = texte.trim();

  // Une image affichée par commande n'est pas répétée en Markdown dans la bulle
  for (const { parameter } of commands.filter((commande) => commande.command === 'ShowPicture')) {
    const nom = normalizeAssetParamToFilename(parameter);
    if (nom) reply = reply.replace(new RegExp(`!\\[[^\\]]*\\]\\([^)]*(${echapper(nom)}|${echapper(encodeURIComponent(nom))})[^)]*\\)`, 'gi'), '');
  }
  if (!reply && commands.length) reply = MISC_MESSAGES.defaultResponse;

  // Demande explicite de fond sans appel d'outil : la palette est cherchée dans la question, jamais
  // dans la réponse, où une simple liste de thèmes changerait le fond
  if (!commands.some(estFond) && demandeChangementFond(prompt)) {
    const paletteId = paletteDuTexte(prompt);
    if (paletteId) {
      commands.push({ command: 'SetBackground', parameter: paletteId });
      log.debug(`[CHAT] Commande SetBackground ajoutée : ${paletteId}`);
    }
  }

  const vues = new Set();
  commands = commands.filter(({ command, parameter }) => !vues.has(`${command}|${parameter}`) && vues.add(`${command}|${parameter}`));

  // Le fond est gardé côté serveur pour que le modèle connaisse le FOND ACTUEL au message suivant
  const fond = commands.findLast(estFond)?.parameter;
  if (fond) {
    await saveUserPreference(user.id, 'backgroundColor', fond)
      .catch((error) => log.warn('[CHAT] Fond non sauvegardé :', error.message));
  }

  if (!isEphemeral) {
    addConversation(user.id, prompt, reply, commands)
      .catch((error) => log.error('[CHAT] Échange non enregistré :', error.message));
  }

  return { reply, commands, userProfile: profilPublic(user), activeUserId: user.id };
}
