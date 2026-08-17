/**
 * Gestion centralisée du userId côté navigateur (localStorage).
 * On génère un ID stable dès le premier chargement pour éviter toute dépendance à l'IP.
 */

const STORAGE_KEY = 'venta_userId';
const USER_ID_CHANGED_EVENT = 'venta:userIdChanged';

export function isValidUserId(userId: unknown): userId is string {
  if (typeof userId !== 'string') return false;
  const trimmed = userId.trim();
  return /^[a-zA-Z0-9_-]{6,64}$/.test(trimmed);
}

export function setStoredUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  if (!isValidUserId(userId)) return;
  const trimmed = userId.trim();
  localStorage.setItem(STORAGE_KEY, trimmed);
  // Notifier le reste de l'app (ex: UrlTracker) qu'un userId a été confirmé/changé
  try {
    window.dispatchEvent(new CustomEvent(USER_ID_CHANGED_EVENT, { detail: { userId: trimmed } }));
  } catch {
    // ignore
  }
}

export function getUserIdChangedEventName() {
  return USER_ID_CHANGED_EVENT;
}


