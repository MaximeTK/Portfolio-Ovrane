/**
 * Types pour le système de chat IA
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

export interface TTSData {
  audio?: string; // base64
  provider?: string;
  format?: string;
  useClientTTS?: boolean;
}

export interface UserProfileData {
  name?: string;
  visitCount?: number;
  isNewUser?: boolean;
  isTemporary?: boolean;
}

export type ChatStatus = 'idle' | 'streaming' | 'error';

export interface ChatState {
  messages: Message[];
  status: ChatStatus;
  error?: string;
}
