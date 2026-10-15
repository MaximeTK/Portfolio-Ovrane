/**
 * Voix des accueils sans nom, générées par la chaîne du site et écrites dans Venta/public, servies en statique
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { config } from '../src/config.js';
import { generateTTS, VOIX_ACCUEIL } from '../src/services/tts.js';

const PUBLIC = fileURLToPath(new URL('../../Venta/public', import.meta.url));
const openai = new OpenAI({ apiKey: config.openaiApiKey });

for (const { texte, url } of Object.values(VOIX_ACCUEIL)) {
  const audio = await generateTTS(texte, openai);
  if (!audio) {
    console.error(`❌ Aucune voix pour « ${texte} » : TTS_DEFAULT actif ou fournisseurs en échec.`);
    process.exit(1);
  }
  const fichier = path.join(PUBLIC, url);
  await fs.mkdir(path.dirname(fichier), { recursive: true });
  await fs.writeFile(fichier, audio.buffer);
  console.log(`✅ ${url} : ${audio.provider}, ${audio.buffer.length} octets`);
}
