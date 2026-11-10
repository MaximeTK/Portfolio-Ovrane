// Les règles des images de /assets, communes au chat et à ses fenêtres
export const urlAsset = (nom: string) => `/assets/${encodeURIComponent(nom)}`;
export const estImageSite = (src: unknown): src is string => typeof src === 'string' && src.startsWith('/assets/') && !src.includes('..');
export const estCommandeImage = (commande: string) => /^show(picture|image)$/i.test(commande);
export const sansExtension = (nom: string) => nom.replace(/\.[^/.]+$/, '');
