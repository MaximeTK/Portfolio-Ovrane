/**
 * Gestion des documents RAG - max 5 fonctions, max 20 lignes
 */
import fs from 'fs';
import path from 'path';

/**
 * Charge tous les fichiers .txt d'un dossier
 */
export function loadDocumentsFromFolder(folderPath) {
  const documents = [];
  
  if (!fs.existsSync(folderPath)) {
    console.warn(`⚠️ [RAG-SYSTEM] Dossier non trouvé: ${folderPath}`);
    return documents;
  }
  
  const files = fs.readdirSync(folderPath);
  const txtFiles = files.filter(file => file.endsWith('.txt'));
  
  for (const filename of txtFiles) {
    try {
      const filePath = path.join(folderPath, filename);
      const content = fs.readFileSync(filePath, 'utf8');
      documents.push({
        source: filename.replace('.txt', ''),
        content,
        metadata: { filename, path: filePath, size: content.length }
      });
    } catch (error) {
      console.error(`❌ [RAG-SYSTEM] Erreur lecture ${filename}:`, error.message);
    }
  }
  
  return documents;
}

