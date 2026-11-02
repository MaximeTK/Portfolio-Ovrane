/** Environnement des tests hors ligne : aucune clé ni base réelles */
Object.assign(process.env, {
  NODE_ENV: 'test',
  SERVICE_SECRET: 'secret-de-test',
  INVITE_CODE: 'invitation-de-test',
  OPENAI_API_KEY: 'sk-test-local',
  CARTESIA_API_KEY: '',
  ELEVEN_API_KEY: '',
  TTS_DEFAULT: 'false',
  // Défi de 4 bits : créer un visiteur reste instantané dans les tests
  DEFI_DIFFICULTE: '4',
  LOG_VERBOSE: 'false',
  MONGODB_URI: 'mongodb://127.0.0.1:1/jamais',
  MONGODB_DB: 'jamais',
});
