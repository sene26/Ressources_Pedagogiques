import type { NextConfig } from "next";

/**
 * Configuration Next.js.
 * - Les en-têtes de sécurité s'appliquent à toutes les routes.
 */
/**
 * Politique de sécurité du contenu (CSP). Next.js insère des scripts en ligne : « unsafe-inline »
 * reste nécessaire sans nonce ; « unsafe-eval » n'est autorisé qu'en développement (rechargement à chaud).
 * Les seuls cadres externes autorisés sont les aperçus YouTube (nocookie) et Google Drive (F12).
 */
const isDev = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self' https://www.youtube-nocookie.com https://drive.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Ignoré en HTTP simple ; impose le HTTPS une fois l'application servie derrière un proxy TLS.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Image Docker : sortie autonome (voir Dockerfile). `next start` reste utilisable sans cette option.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: {
    // Dépôt de fichiers par Server Action : 100 Mo (RG8) + marge pour les autres champs du formulaire.
    serverActions: { bodySizeLimit: "101mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Les pages ne peuvent pas être intégrées ailleurs (clickjacking)…
      { source: "/((?!api/files/).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
      // … mais les fichiers peuvent l'être par l'application elle-même (aperçu PDF, F12).
      { source: "/api/files/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;
