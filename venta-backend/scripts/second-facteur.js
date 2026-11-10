/** Enrôle le second facteur : secret affiché, puis activé par un code */
import dns from 'dns';
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { activerDeuxiemeFacteur, preparerDeuxiemeFacteur } from '../src/services/deuxiemeFacteur.js';

const [email, code] = process.argv.slice(2).map((valeur) => valeur.trim().toLowerCase());
if (!email) {
  console.error('Usage : npm run second-facteur -- <e-mail> [code à 6 chiffres]');
  process.exit(1);
}

// Sous Windows, Node peut ignorer le DNS du réseau et faire échouer le SRV
if (dns.getServers().every((serveur) => serveur === '127.0.0.1' || serveur === '::1')) dns.setServers(['1.1.1.1', '8.8.8.8']);
await mongoose.connect(config.mongodbUri, { dbName: config.mongodbDb });
try {
  if (!code) {
    const prepare = await preparerDeuxiemeFacteur(email);
    console.log(prepare
      ? `Clé à saisir dans l'application d'authentification : ${prepare.secret}\nOu ce lien en QR code : ${prepare.uri}\n`
        + `Puis : npm run second-facteur -- ${email} <code affiché>`
      : 'Aucun compte pour cette adresse.');
  } else if (await activerDeuxiemeFacteur(email, code)) {
    console.log('Second facteur actif, sessions du compte fermées. Connexion : mot de passe suivi du code, sans espace.');
  } else {
    console.error('Code refusé, ou aucun secret en attente : relancez sans code.');
    process.exitCode = 1;
  }
} finally {
  await mongoose.disconnect();
}
