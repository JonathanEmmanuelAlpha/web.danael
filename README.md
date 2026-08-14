# Danaël 🎓

Plateforme de suivi scolaire (élèves, enseignants, établissements, parents, tuteurs) — Next.js 16 fullstack.

## Stack

Next.js 16 (App Router) · TypeScript strict · Clerk · Neon PostgreSQL · Drizzle ORM · Cloudflare R2 · TanStack Form/Query · Zustand · shadcn/ui · Tailwind CSS v4

## Démarrage

1. `npm install`
2. `cp .env.example .env.local` et renseigner les variables (§26 du cahier des charges)
3. `npm run scaffold` (arborescence §8, idempotent)
4. `npm run dev` → http://localhost:3000
5. Health check : http://localhost:3000/api/health

## Scripts

| Script                | Description                    |
| --------------------- | ------------------------------ |
| `npm run dev`         | Développement (Turbopack)      |
| `npm run build`       | Build production               |
| `npm run lint`        | ESLint 9 (flat config)         |
| `npm run format`      | Prettier                       |
| `npm run db:generate` | Générer les migrations Drizzle |
| `npm run db:migrate`  | Appliquer les migrations       |
| `npm run db:studio`   | Drizzle Studio                 |

## Architecture

Monolithe modulaire (§7.2) : la logique métier vit dans `server/services`, `server/actions`, `server/permissions`, `server/validators` — jamais dans les composants.
