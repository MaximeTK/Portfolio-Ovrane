import type { MetadataRoute } from 'next';

// Seul le portfolio s'indexe : ni API, ni Illusion, ni connexion, ni lien suivi
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/illusion', '/connexion', '/redirect'] } };
}
