/**
 * Migration: nettoyer et réordonner les documents User dans MongoDB.
 *
 * - Supprime isTemporary et firstVisit (legacy)
 * - Force l'ordre des champs (utile pour Compass / lisibilité)
 *
 * Usage:
 *  - définir MONGODB_URI dans l'env
 *  - node scripts/migrate-users-clean-order.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';

const ORDERED_KEYS = [
  '_id',
  'name',
  'nameNormalized',
  'id',
  'ipHashes',
  'createdAt',
  'updatedAt',
  'lastVisit',
  'visitCount',
  'visitedLinks',
  'preferences',
  'messageCount',
  'conversations',
];

const STRIP_KEYS = new Set([
  'isTemporary',
  'firstVisit',
]);

function buildOrderedDoc(user) {
  const u = user || {};

  // Base dans l'ordre demandé
  const base = {
    _id: u._id,
    name: u.name ?? null,
    nameNormalized: u.nameNormalized ?? null,
    id: u.id,
    ipHashes: Array.isArray(u.ipHashes) ? u.ipHashes : [],
    createdAt: u.createdAt ?? null,
    updatedAt: u.updatedAt ?? null,
    lastVisit: u.lastVisit ?? null,
    visitCount: typeof u.visitCount === 'number' ? u.visitCount : 0,
    visitedLinks: Array.isArray(u.visitedLinks) ? u.visitedLinks : [],
    preferences: u.preferences ?? {},
    messageCount: typeof u.messageCount === 'number' ? u.messageCount : 0,
    conversations: Array.isArray(u.conversations) ? u.conversations : [],
  };

  // Ajouter les autres champs existants (preferences, messageCount, etc.) à la fin
  const extras = {};
  for (const [k, v] of Object.entries(u)) {
    if (k in base) continue;
    if (STRIP_KEYS.has(k)) continue;
    extras[k] = v;
  }

  return { ...base, ...extras };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI manquant');
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: 'venta' });
  console.log('✅ Connecté MongoDB');

  const users = await User.find({}).lean();
  console.log(`ℹ️ ${users.length} utilisateur(s) à migrer`);

  let updated = 0;
  for (const u of users) {
    const ordered = buildOrderedDoc(u);
    // Replace complet (1 doc) pour imposer l'ordre des clés en BSON
    await User.replaceOne({ _id: u._id }, ordered, { strict: false });
    updated += 1;
  }

  console.log(`✅ Migration terminée: ${updated}/${users.length} document(s) réécrit(s)`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Migration échouée:', err);
  process.exit(1);
});