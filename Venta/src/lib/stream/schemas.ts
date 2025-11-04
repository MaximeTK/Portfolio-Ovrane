/**
 * Schémas Zod pour les items du stream SSE
 */
import { z } from 'zod';

// Item de type texte (delta incrémental)
export const ZText = z.object({
  type: z.literal('text'),
  delta: z.string().min(1),
});

// Item de type tool_call
export const ZToolCall = z.object({
  type: z.literal('tool_call'),
  name: z.enum(['showImage', 'highlightSection', 'openLink']),
  arguments: z.record(z.string(), z.any()),
});

// Item de type done (fin du stream)
export const ZDone = z.object({
  type: z.literal('done'),
});

// Union de tous les types d'items possibles
export const ZStreamItem = z.union([ZText, ZToolCall, ZDone]);

// Types TypeScript inférés
export type TextItem = z.infer<typeof ZText>;
export type ToolCallItem = z.infer<typeof ZToolCall>;
export type DoneItem = z.infer<typeof ZDone>;
export type StreamItem = z.infer<typeof ZStreamItem>;
