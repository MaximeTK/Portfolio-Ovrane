/**
 * FICHIER DE REDIRECTION - TOUS LES TEXTES SONT CENTRALISÉS DANS src/lib/messages.js
 */
import { REDIRECT_MESSAGES } from './src/lib/messages.js';

console.error(`\n${REDIRECT_MESSAGES.fileMovedError}\n`);
console.error(REDIRECT_MESSAGES.fileMovedErrorDetail);
console.error(`\n${REDIRECT_MESSAGES.fileMovedSolutionsTitle}\n`);
console.error(REDIRECT_MESSAGES.fileMovedSolution1);
console.error(REDIRECT_MESSAGES.fileMovedSolution2);
console.error(`\n${REDIRECT_MESSAGES.fileMovedDocumentation}\n`);

process.exit(1);

