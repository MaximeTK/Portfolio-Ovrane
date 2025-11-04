/**
 * Registry des handlers de tools avec validation Zod
 */
import { z } from 'zod';
import { useUIStore } from '../state/uiStore';
import { ZShowImageArgs, ZHighlightArgs, ZOpenLinkArgs } from './toolSchemas';

export type ToolHandler = (args: unknown) => void;

/**
 * Valide les arguments avec un schéma Zod
 */
function validate<T>(schema: z.ZodSchema<T>, args: unknown): args is T {
  const result = schema.safeParse(args);
  
  if (!result.success) {
    console.warn('Arguments de tool invalides:', result.error.format());
    return false;
  }
  
  return true;
}

/**
 * Ouvre une URL en toute sécurité dans un nouvel onglet
 */
function safeOpen(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Registry des handlers de tools
 */
export const toolHandlers: Record<string, ToolHandler> = {
  showImage: (args) => {
    if (validate(ZShowImageArgs, args)) {
      const { showImage } = useUIStore.getState();
      showImage(args.assetId, args.alt);
    }
  },
  
  highlightSection: (args) => {
    if (validate(ZHighlightArgs, args)) {
      const { highlight } = useUIStore.getState();
      highlight(args.id);
    }
  },
  
  openLink: (args) => {
    if (validate(ZOpenLinkArgs, args)) {
      safeOpen(args.url);
    }
  },
};
