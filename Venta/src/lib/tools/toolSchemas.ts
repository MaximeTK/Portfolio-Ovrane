/**
 * Schémas Zod pour la validation des arguments des tools
 */
import { z } from 'zod';

// Schéma pour showImage
export const ZShowImageArgs = z.object({
  assetId: z.string().min(1, 'assetId doit être non vide'),
  alt: z.string().optional(),
});

// Schéma pour highlightSection
export const ZHighlightArgs = z.object({
  id: z.string().min(1, 'id doit être non vide'),
});

// Schéma pour openLink
export const ZOpenLinkArgs = z.object({
  url: z.string().url('url doit être une URL valide'),
});

export type ShowImageArgs = z.infer<typeof ZShowImageArgs>;
export type HighlightArgs = z.infer<typeof ZHighlightArgs>;
export type OpenLinkArgs = z.infer<typeof ZOpenLinkArgs>;
