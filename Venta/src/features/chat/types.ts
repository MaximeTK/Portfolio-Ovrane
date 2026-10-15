/**
 * Types du chat avec l'IA
 */
export type MessageRole = 'user' | 'assistant';

export interface Command {
  command: string;
  parameter: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  commands?: Command[];
}

/** Voix de la réponse : un fichier statique remplace la synthèse, ex. le message de fin de session. */
export interface TTSData {
  isStaticFile?: boolean;
  staticUrl?: string;
}

export type ChatStatus = 'idle' | 'streaming';

/** Accueil public d'une candidature Illusion (GET /api/illusion/accueil?jeton=). */
export interface IllusionAccueil {
  entreprise: string;
  poste: string;
  langue: string;
}
