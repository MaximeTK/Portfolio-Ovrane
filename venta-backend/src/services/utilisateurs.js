/**
 * Profils utilisateurs dans MongoDB : visites, messages, conversations, préférences et liens d'arrivée
 */
import { User } from '../models/User.js';

export const MAX_MESSAGES = 50;
const UNE_HEURE = 3_600_000;
const MAX_LIENS = 100;

// Ce que le client voit d'un profil
export function profilPublic(user, nouveau) {
  const visitCount = user.visitCount || 1;
  return { name: user.name ?? null, visitCount, isNewUser: nouveau ?? visitCount === 1, messageCount: user.messageCount || 0 };
}

// Une visite compte si la précédente date de plus d'une heure ; l'IP ne sert qu'aux limites de débit, jamais gardée
function visite() {
  const maintenant = new Date();
  const ecart = { $subtract: [maintenant, { $ifNull: ['$lastVisit', new Date(0)] }] };
  return {
    visitCount: { $cond: [{ $gt: [ecart, UNE_HEURE] }, { $add: [{ $ifNull: ['$visitCount', 0] }, 1] }, '$visitCount'] },
    lastVisit: maintenant,
  };
}

// Profil du chat : compte la visite et le message avant l'appel au modèle, avec les 8 derniers échanges
export function getUserProfile(id) {
  return User.findOneAndUpdate(
    { id },
    [{ $set: { ...visite(), messageCount: { $min: [{ $add: [{ $ifNull: ['$messageCount', 0] }, 1] }, MAX_MESSAGES + 1] } } }],
    { returnDocument: 'after', updatePipeline: true, projection: { _id: 0, id: 1, name: 1, visitCount: 1, messageCount: 1, preferences: 1, conversations: { $slice: -8 } } },
  ).lean();
}

export function compterVisite(id) {
  return User.findOneAndUpdate(
    { id },
    [{ $set: visite() }],
    { returnDocument: 'after', updatePipeline: true, projection: { _id: 0, id: 1, name: 1, visitCount: 1, messageCount: 1 } },
  ).lean();
}

// Messages à plat ; un échange donne la question puis la réponse, l'ancien format un seul message
export function aPlat(conversations = []) {
  return conversations.flatMap((conv) => {
    if (!conv.prompt && !conv.response) {
      return conv.role && conv.content ? [{ role: conv.role, content: conv.content, timestamp: conv.timestamp, commands: conv.commands }] : [];
    }
    return [
      ...(conv.prompt ? [{ role: 'user', content: conv.prompt, timestamp: conv.timestamp }] : []),
      ...(conv.response ? [{ role: 'assistant', content: conv.response, timestamp: conv.timestamp, commands: conv.commands }] : []),
    ];
  });
}

// Page de messages comptée depuis la fin ; skip + limit échanges suffisent car chacun donne au moins un message
export async function historique(id, limit, skip) {
  const user = await User.findOne({ id }, { _id: 0, id: 1, conversations: { $slice: -(skip + limit) } }).lean();
  const messages = aPlat(user?.conversations);
  const fin = Math.max(0, messages.length - skip);
  return messages.slice(Math.max(0, fin - limit), fin);
}

export function addConversation(id, prompt, response, commands) {
  const conversation = { role: 'user', content: prompt, timestamp: new Date(), prompt, response, commands };
  return User.updateOne({ id }, { $push: { conversations: { $each: [conversation], $slice: -500 } } });
}

export async function saveUserPreference(id, preference, value) {
  const { matchedCount } = await User.updateOne({ id }, { $set: { [`preferences.${preference}`]: value } });
  return matchedCount > 0;
}

// Sans doublon, et 100 liens au plus par profil
export async function saveVisitedLink(id, link) {
  const { matchedCount } = await User.updateOne(
    { id, [`visitedLinks.${MAX_LIENS - 1}`]: { $exists: false } },
    { $addToSet: { visitedLinks: link } },
  );
  return matchedCount > 0;
}
