import type { NextConfig } from "next";

// CSP appliquée ; 'unsafe-inline' reste pour les scripts que Next injecte
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  // Le flux de transcription des appels (RUBY) va du navigateur à AssemblyAI
  "connect-src 'self' wss://streaming.assemblyai.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    const communs = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      // Micro permis au site seul : RUBY enregistre les appels
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
    ];
    return [
      // Le relais garde la CSP d'Illusion : celle du site la remplacerait
      { source: "/:path((?!api/illusion/app/).*)", headers: [{ key: "Content-Security-Policy", value: csp }, ...communs] },
      { source: "/api/illusion/app/:path*", headers: communs },
    ];
  },
};

export default nextConfig;
