import type { NextConfig } from "next";

/**
 * Configuration Next.js.
 * - Les en-têtes de sécurité s'appliquent à toutes les routes.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: {
    // Dépôt de fichiers par Server Action : 100 Mo (RG8) + marge pour les autres champs du formulaire.
    serverActions: { bodySizeLimit: "101mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
