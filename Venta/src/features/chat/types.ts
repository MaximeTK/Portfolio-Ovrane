/** Types du chat avec l'IA */
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

/** Voix de la réponse : un fichier statique remplace la synthèse */
export interface TTSData {
  isStaticFile?: boolean;
  staticUrl?: string;
}

export type ChatStatus = 'idle' | 'streaming';

/** Accueil public d'une candidature Illusion, écrit et signé par le serveur */
export interface IllusionAccueil {
  entreprise: string;
  poste: string;
  langue: string;
  texte?: string;
  voix?: string;
}

/** Texte à dire et sa signature : le serveur ne lit que ce qu'il a signé */
export interface TexteSigne {
  texte: string;
  voix: string;
}
