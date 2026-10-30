import type { NextConfig } from "next";

// Appliquée : ce qui sort de cette liste est bloqué. Polices auto-hébergées par next/font, aucune image ni script tiers,
// seule connexion externe : la transcription des appels d'Illusion. 'unsafe-inline' reste pour les scripts que Next injecte
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  // Le flux de transcription des appels d'Illusion (RUBY) s'ouvre du navigateur vers AssemblyAI
  "connect-src 'self' wss://streaming.assemblyai.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Le micro est permis au site seul : l'enregistrement des appels d'Illusion en a besoin
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
