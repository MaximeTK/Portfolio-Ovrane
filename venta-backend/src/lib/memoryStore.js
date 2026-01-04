/**
 * Stockage en mémoire (Fallback quand MongoDB n'est pas disponible)
 */

// Stockage des utilisateurs
export const memoryUsers = new Map();

// Stockage des conversations (si besoin d'être séparé, mais ici on va stocker dans l'objet user)
// Structure User en mémoire : { id, name, conversations: [], visitCount, ... }

