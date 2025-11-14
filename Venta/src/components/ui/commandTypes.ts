export type ImageWindowContent = {
  src: string;
  alt: string;
  width: number;
  height: number;
  onError?: () => void;
};

export type CodeWindowContent = {
  language: string;
  code: string;
};

export type GenericWindowContent = {
  text: string;
  timestamp?: string;
};

type BaseWindow = {
  id: string;
  title: string;
  x: number;
  y: number;
};

export type ImageWindow = BaseWindow & {
  type: 'image';
  content: ImageWindowContent;
};

export type CodeWindow = BaseWindow & {
  type: 'code';
  content: CodeWindowContent;
};

export type GenericWindow = BaseWindow & {
  type: 'generic';
  content: GenericWindowContent;
};

export type WindowData = ImageWindow | CodeWindow | GenericWindow;

