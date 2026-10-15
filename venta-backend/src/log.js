/**
 * Journalisation à quatre niveaux ; debug, le traçage par requête, reste muet sans LOG_VERBOSE=true
 */
import { config } from './config.js';

export function debug(...args) {
  if (config.logVerbose) console.log(...args);
}

export function info(...args) {
  console.log(...args);
}

export function warn(...args) {
  console.warn('⚠️', ...args);
}

export function error(...args) {
  console.error('❌', ...args);
}
