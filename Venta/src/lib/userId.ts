/**
 * Gestion centralisée du userId côté navigateur (localStorage).
 * On génère un ID stable dès le premier chargement pour éviter toute dépendance à l'IP.
 */

const STORAGE_KEY = 'venta_userId';

export function isValidUserId(userId: unknown): userId is string {
  if (typeof userId !== 'string') return false;
  const trimmed = userId.trim();
  return /^[a-zA-Z0-9_-]{6,64}$/.test(trimmed);
}

function generateUserId(): string {
  // crypto.randomUUID est disponible sur la plupart des navigateurs modernes.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback simple (moins idéal, mais suffisant en dev)
  return `${Date.now()}_${Math.random().toString(36).slice(2, 18)}`;
}

export function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return isValidUserId(value) ? value : null;
}

export function setStoredUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  if (!isValidUserId(userId)) return;
  localStorage.setItem(STORAGE_KEY, userId.trim());
}

export function getOrCreateUserId(): string {
  const existing = getStoredUserId();
  if (existing) return existing;
  const created = generateUserId();
  setStoredUserId(created);
  return created;
}


