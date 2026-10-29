/**
 * E-mails du système par l'API de Resend ; sans clé ni expéditeur, rien ne part et l'erreur est journalisée
 */
import { config } from '../config.js';
import * as log from '../log.js';

export async function envoyerMail(destinataire, { sujet, texte, html }) {
  const { resendKey, expediteur } = config.mails;
  if (!resendKey || !expediteur) {
    log.error('[MAIL] RESEND_API_KEY ou MAIL_FROM absent : e-mail non envoyé');
    return false;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: expediteur, to: [destinataire], subject: sujet, text: texte, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) log.error(`[MAIL] Resend refuse l'envoi (${response.status}) :`, (await response.text().catch(() => '')).slice(0, 300));
    return response.ok;
  } catch (error) {
    log.error('[MAIL] Resend injoignable :', error.message);
    return false;
  }
}
