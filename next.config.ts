import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/** §19.6 — Headers de sécurité applicative */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    serverActions: {
      bodySizeLimit: "4mb", // soumissions de fichiers texte + métadonnées (les binaires passent par R2, §11.4)
      allowedOrigins: [],
    },
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      // ⚠️ À VÉRIFIER : domaine public R2 (si activé — sinon tout passera par URLs signées)
      { protocol: "https", hostname: "**.r2.dev" },
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.ufs.sh",
        pathname: "/**",
      },
    ],
  },

  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
