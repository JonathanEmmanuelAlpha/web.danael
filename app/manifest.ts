import type { MetadataRoute } from "next";

/**
 * PWA manifest (§21 PWA).
 * Served at /manifest.webmanifest by Next.js.
 *
 * Icons reference the dynamically generated /icon (with ?id= query)
 * and /apple-icon routes produced by app/icon.tsx and app/apple-icon.tsx.
 *
 * NOTE: Next.js 16 handles service worker registration differently —
 * we don't ship a service worker file. The manifest alone enables
 * installability, theme color, and standalone display.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Danaël — Plateforme scolaire",
    short_name: "Danaël",
    description:
      "La plateforme scolaire qui révèle votre potentiel. Suivi moderne pour élèves, enseignants, écoles et parents.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1b43",
    theme_color: "#93d91a",
    orientation: "portrait-primary",
    categories: ["education", "productivity", "social"],
    lang: "fr",
    dir: "ltr",
    scope: "/",
    icons: [
      {
        src: "/icon?id=32",
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon?id=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon?id=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon?id=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Tableau de bord",
        short_name: "Dashboard",
        description: "Accéder à votre tableau de bord",
        url: "/dashboard",
      },
      {
        name: "Bibliothèque",
        short_name: "Library",
        description: "Parcourir la bibliothèque de ressources",
        url: "/library",
      },
      {
        name: "Tarifs",
        short_name: "Pricing",
        description: "Voir les offres Danaël",
        url: "/pricing",
      },
    ],
    screenshots: [],
  };
}
