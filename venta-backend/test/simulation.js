/**
 * Base MongoDB simulée en mémoire, modèle OpenAI simulé et application Express éphémère pour les tests hors ligne
 */
import './env.js';
import { once } from 'node:events';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import { Reinitialisation } from '../src/models/Reinitialisation.js';
import { IllusionCandidature } from '../src/models/IllusionCandidature.js';
import { IllusionFichier } from '../src/models/IllusionFichier.js';
import { RedirectLog } from '../src/models/RedirectLog.js';
import { Budget } from '../src/models/Budget.js';
import { createApp } from '../src/app.js';

const valeur = (doc, chemin) => chemin.split('.').reduce((v, cle) => v?.[cle], doc);
// Copie profonde des objets simples ; dates et tampons restent partagés
const copier = (v) => (Array.isArray(v) ? v.map(copier)
  : v?.constructor === Object ? Object.fromEntries(Object.entries(v).map(([cle, x]) => [cle, copier(x)])) : v);

function ecrire(doc, chemin, v) {
  const cles = chemin.split('.');
  const fin = cles.pop();
  cles.reduce((objet, cle) => (objet[cle] ??= {}), doc)[fin] = v;
}

function correspond(doc, filtre) {
  return Object.entries(filtre).every(([cle, attendu]) => {
    if (cle === '$or') return attendu.some((f) => correspond(doc, f));
    const v = valeur(doc, cle);
    if (attendu === null) return v == null;
    if (attendu?.constructor === Object) {
      return Object.entries(attendu).every(([op, x]) => {
        if (op === '$gt') return v > x;
        if (op === '$gte') return v >= x;
        if (op === '$lt') return v < x;
        if (op === '$in') return x.includes(v);
        if (op === '$exists') return (v !== undefined) === x;
        throw new Error(`Opérateur non simulé : ${op}`);
      });
    }
    return Array.isArray(v) ? v.includes(attendu) : v === attendu;
  });
}

// Expressions d'agrégation des mises à jour en pipeline
function evaluer(expr, doc) {
  if (typeof expr === 'string' && expr.startsWith('$')) return valeur(doc, expr.slice(1));
  if (Array.isArray(expr)) return expr.map((e) => evaluer(e, doc));
  if (expr?.constructor !== Object) return expr;
  const [[op, args]] = Object.entries(expr);
  const a = evaluer(args, doc);
  switch (op) {
    case '$ifNull': return a[0] ?? a[1];
    case '$add': return a[0] + a[1];
    case '$subtract': return a[0] - a[1];
    case '$gt': return a[0] > a[1];
    case '$min': return Math.min(...a);
    case '$cond': return a[0] ? a[1] : a[2];
    case '$setUnion': return [...new Set(a.flat())];
    default: throw new Error(`Expression non simulée : ${op}`);
  }
}

function appliquer(doc, maj) {
  if (Array.isArray(maj)) {
    // Toutes les expressions d'une étape lisent le document d'avant l'étape
    for (const { $set } of maj) Object.assign(doc, Object.fromEntries(Object.entries($set).map(([cle, e]) => [cle, evaluer(e, doc)])));
    return;
  }
  for (const [op, champs] of Object.entries(maj)) {
    for (const [chemin, v] of Object.entries(champs)) {
      if (op === '$set') ecrire(doc, chemin, v);
      else if (op === '$inc') ecrire(doc, chemin, (valeur(doc, chemin) ?? 0) + v);
      else if (op === '$addToSet') ecrire(doc, chemin, [...new Set([...(valeur(doc, chemin) ?? []), v])]);
      else if (op === '$push') ecrire(doc, chemin, [...(valeur(doc, chemin) ?? []), ...v.$each].slice(v.$slice ?? 0));
      else if (op === '$max') { if (valeur(doc, chemin) == null || v > valeur(doc, chemin)) ecrire(doc, chemin, v); }
      else throw new Error(`Mise à jour non simulée : ${op}`);
    }
  }
}

function projeter(doc, projection = {}) {
  if (!doc) return null;
  const copie = copier(doc);
  const inclusion = Object.values(projection).includes(1);
  const resultat = inclusion ? {} : copie;
  for (const [chemin, v] of Object.entries(projection)) {
    if (v === 0) delete resultat[chemin];
    else if (v?.$slice !== undefined) resultat[chemin] = (copie[chemin] ?? []).slice(v.$slice);
    else if (valeur(copie, chemin) !== undefined) ecrire(resultat, chemin, valeur(copie, chemin));
  }
  return resultat;
}

// Remplace les accès d'un modèle par un tableau ; les requêtes passent par .lean() comme dans le serveur
function simuler(Modele) {
  const docs = [];
  const requete = (resultat) => ({ lean: async () => resultat });
  const trouver = (filtre) => docs.find((doc) => correspond(doc, filtre));
  Object.assign(Modele, {
    findOne: (filtre, projection) => requete(projeter(trouver(filtre), projection)),
    findById: (id, projection) => requete(projeter(docs.find((doc) => String(doc._id) === String(id)), projection)),
    exists: async (filtre) => (trouver(filtre) ? { _id: 1 } : null),
    create: async (doc) => {
      docs.push(copier(doc));
      return doc;
    },
    findOneAndUpdate: (filtre, maj, options = {}) => {
      let doc = trouver(filtre);
      if (!doc && options.upsert) {
        // Comme Mongo : le document naît des égalités du filtre, puis la mise à jour s'applique
        doc = {};
        for (const [cle, v] of Object.entries(filtre)) if (cle !== '$or' && v?.constructor !== Object) ecrire(doc, cle, v);
        docs.push(doc);
      }
      if (doc) appliquer(doc, maj);
      return requete(projeter(doc, options.projection));
    },
    updateOne: async (filtre, maj) => {
      const doc = trouver(filtre);
      if (doc) appliquer(doc, maj);
      return { matchedCount: doc ? 1 : 0 };
    },
    findOneAndDelete: (filtre) => {
      const i = docs.findIndex((doc) => correspond(doc, filtre));
      return requete(i >= 0 ? docs.splice(i, 1)[0] : null);
    },
    deleteOne: async (filtre) => {
      const i = docs.findIndex((doc) => correspond(doc, filtre));
      if (i >= 0) docs.splice(i, 1);
      return { deletedCount: i >= 0 ? 1 : 0 };
    },
    updateMany: async (filtre, maj) => {
      const cibles = docs.filter((doc) => correspond(doc, filtre));
      for (const doc of cibles) appliquer(doc, maj);
      return { modifiedCount: cibles.length };
    },
    deleteMany: async (filtre) => {
      const avant = docs.length;
      for (let i = docs.length - 1; i >= 0; i--) if (correspond(docs[i], filtre)) docs.splice(i, 1);
      return { deletedCount: avant - docs.length };
    },
    distinct: async (chemin, filtre = {}) =>
      [...new Set(docs.filter((doc) => correspond(doc, filtre)).map((doc) => valeur(doc, chemin)).filter((v) => v !== undefined))],
  });
  return docs;
}

export const base = {
  users: simuler(User),
  sessions: simuler(Session),
  reinitialisations: simuler(Reinitialisation),
  candidatures: simuler(IllusionCandidature),
  fichiers: simuler(IllusionFichier),
  logs: simuler(RedirectLog),
  budgets: simuler(Budget),
};

// Le modèle simulé répond par modele.repondre, que chaque test peut remplacer
export const appelsOpenAI = [];
export const REPONSE = 'Bonjour, bienvenue sur le portfolio.';
export const modele = { repondre: async () => ({ output: [], output_text: REPONSE }) };
// En flux, la réponse simulée arrive comme chez OpenAI : son texte en deux morceaux, puis la réponse complète
async function* enFlux(reponse) {
  const texte = String(reponse.output_text ?? '');
  const milieu = Math.ceil(texte.length / 2);
  for (const delta of [texte.slice(0, milieu), texte.slice(milieu)].filter(Boolean)) yield { type: 'response.output_text.delta', delta };
  yield { type: 'response.completed', response: reponse };
}
const openai = {
  responses: {
    create: async (params) => {
      appelsOpenAI.push(params);
      const reponse = await modele.repondre(params);
      return params.stream ? enFlux(reponse) : reponse;
    },
  },
  audio: { speech: { create: async ({ input }) => ({ arrayBuffer: async () => Buffer.from(`audio:${input}`) }) } },
};

const serveur = createApp({ openai }).listen(0, '127.0.0.1');
await once(serveur, 'listening');
const url = `http://127.0.0.1:${serveur.address().port}`;

export const fermer = () => serveur.close();
export const SECRET = process.env.SERVICE_SECRET;

let adresses = 0;
// Requête comme Next la relaie : secret de service, IP du visiteur (une nouvelle par défaut) et session
// `brut` rend la réponse sans lire son corps, pour suivre un flux morceau par morceau
export async function appeler(chemin, { method = 'GET', body, session, secret = SECRET, ip = `10.0.0.${++adresses}`, headers = {}, brut = false } = {}) {
  const res = await fetch(`${url}${chemin}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(secret ? { 'X-Ovrane-Service': secret, 'X-Ovrane-Client-Ip': ip } : {}),
      ...(session ? { 'X-Ovrane-Session': session } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  if (brut) return res;
  const bytes = Buffer.from(await res.arrayBuffer());
  let json = null;
  try {
    json = JSON.parse(bytes.toString('utf8'));
  } catch {
    json = null;
  }
  return { status: res.status, json, bytes, headers: res.headers };
}

// Nouveau visiteur et sa session
export async function visiteur() {
  const { json } = await appeler('/api/auth/visitor', { method: 'POST', body: {} });
  return { id: json.activeUserId, session: json.session.jeton };
}
