/**
 * Gestion des documents RAG - max 5 fonctions, max 20 lignes
 */
import fs from 'fs';
import path from 'path';

/**
 * Charge tous les fichiers .txt d'un dossier
 */
export function loadDocumentsFromFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    console.warn(`⚠️ [RAG-SYSTEM] Dossier non trouvé: ${folderPath}`);
    return [];
  }
  return getTxtFiles(folderPath)
    .map((filename) => createDocument(folderPath, filename))
    .filter(Boolean);
}

function getTxtFiles(folderPath) {
  return fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith('.txt'));
}

function createDocument(folderPath, filename) {
  const filePath = path.join(folderPath, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      source: filename.replace('.txt', ''),
      content,
      metadata: { filename, path: filePath, size: content.length },
    };
  } catch (error) {
    console.error(
      `❌ [RAG-SYSTEM] Erreur lecture ${filename}:`,
      error.message,
    );
    return null;
  }
}

