Je vais commencer par lire tous les fichiers que vous avez uploadés pour bien comprendre le cahier des charges et l'état actuel du projet.
Maintenant je vais lire les autres fichiers uploadés et explorer la structure du projet existant.
Maintenant je vais lire le reste du cahier des charges et explorer la structure du projet.
Le cahier des charges est volumineux. Je vais le lire en plusieurs parties pour bien tout comprendre.
J'ai maintenant lu l'intégralité du cahier des charges. C'est un projet massif. Vérifions la configuration existante du projet et le PDF.
J'ai lu l'intégralité du cahier des charges (3130 lignes), les fichiers d'auth existants, et la configuration du projet. Je comprends parfaitement l'ampleur du projet **Danaël**.

Avant de rédiger le plan, laissez-moi faire quelques recherches en ligne clés sur les points techniques sensibles que vous avez soulevés (Next.js 16 `proxy.ts`, Clerk, Drizzle+Neon, Uploadthing, next-intl) pour m'assurer que le plan repose sur les API les plus récentes.
Lançons les recherches en ligne sur les points techniques sensibles en parallèle.
Mes recherches sont terminées. Voici les points techniques clés confirmés :

- ✅ **Next.js 16** : `middleware.ts` → `proxy.ts`, `export function middleware` → `export function proxy` (codemod officiel)
- ✅ **Clerk v7** : la doc officielle référence désormais `proxy.ts` avec `clerkMiddleware()`. ⚠️ Attention au bug connu #8302 (boucles de redirection avec `auth.protect()` en runtime Node) — j'utiliserai un pattern sûr.
- ✅ **Uploadthing** : compatible App Router, ⚠️ souci de compilation connu en mode Turbopack Next 16 → j'adapterai.
- ✅ **TanStack Form + Zod** : depuis Zod 3.24, **plus besoin d'adapter** (Standard Schema natif).
- ✅ **Tailwind v4** : tout dans `globals.css` via `@theme`, pas de `tailwind.config.ts`.

Je vais maintenant établir le plan de travail complet.
# 📋 Plan de Travail — Plateforme Danaël

Bonjour ! J'ai bien reçu et lu **l'intégralité** de vos fichiers :
- ✅ `Cahier-Technique.md` (3130 lignes — lu en entier)
- ✅ `Projet Danaël 1.0.pdf` (cahier des charges produit)
- ✅ Les 3 pages d'auth existantes (`page.tsx`, `sign-up-page.tsx`, `verify-account-page.tsx`)
- ✅ Les composants `AuthLayout.tsx`, `auth-panel.tsx`, `input.tsx`, `password-input.tsx`, `password-strength.tsx`
- ✅ La config du projet existant (Next.js 16, Tailwind v4, shadcn New York, Prisma, etc.)

J'ai aussi effectué les **recherches en ligne** demandées sur les points sensibles. Voici le plan de travail complet.

---

## 1. Stack & versions cibles (confirmées par recherche en ligne)

| Domaine | Technologie | Version | Notes |
|---|---|---|---|
| Framework | **Next.js App Router** | 16.x | `proxy.ts` remplace `middleware.ts` ✅ |
| UI | React | 19.x | Server Components par défaut |
| Langage | TypeScript | 5.x strict | |
| Auth | **`@clerk/nextjs`** | v7+ | `clerkMiddleware()` dans `proxy.ts` |
| DB | **Neon PostgreSQL** + **Drizzle ORM** | derniers | `@neondatabase/serverless` + `drizzle-orm` |
| Stockage | **Cloudflare R2** + **Uploadthing** | — | Bascule via `STORAGE_PROVIDER` env var |
| Formulaires | **TanStack Form** + **Zod** | derniers | Zod Standard Schema natif (sans adapter) |
| Server state | TanStack Query | v5 | |
| Client state | Zustand | v5 | |
| Styling | **Tailwind CSS v4** + shadcn/ui | — | Uniquement `globals.css`, **pas de `tailwind.config.ts`** |
| i18n | **next-intl** | dernier | `en.json` + `fr.json`, FR par défaut |
| Charts | Recharts | dernier | |
| Notifications | sonner | | |

> **Note Prisma → Drizzle** : le projet a actuellement Prisma. Le cahier demande Drizzle + Neon. Je vais migrer vers Drizzle (la couche `@/lib/db` sera l'unique point d'accès, donc la migration est isolée).

---

## 2. Principes d'ingénierie appliqués à chaque phase

| Règle | Application |
|---|---|
| **SOLID / DRY** | Logique métier **jamais dans les composants** → UI → Server Actions → `server/services` → Drizzle → providers |
| **Validation systématique** | Schémas Zod partagés client/serveur (`server/validators`) |
| **Permissions server-side** | Chaque action vérifie auth + rôle + contexte (`server/permissions`) |
| **Format API unifié** | Réponses `{ success, data, meta }` / `{ success, error }` (§14.3) |
| **Typage strict** | TypeScript strict bout-en-bout, types inférés depuis Drizzle |
| **i18n dès le départ** | Tous les textes dans `messages/en.json` + `messages/fr.json` |
| **Pas de TODO** | Code complet et fonctionnel à chaque livraison |
| **Composants réutilisables** | Extraction systématique (Input, FormField, Card, Chart, DataTable, FileUploader…) |

---

## 3. Découpage en 17 phases

### 🔹 Phase 0 — Socle & Configuration `(priorité haute)`
**Réf. §7, §8, §26**

- Migration Prisma → **Drizzle + Neon** (`src/server/db/`, `drizzle.config.ts`)
- `.env.example` complet (Clerk, Neon, R2, Uploadthing, app)
- **Arborescence §8 complète** : `app/`, `features/`, `server/`, `stores/`, `hooks/`, `lib/`, `types/`, `messages/`
- Adaptateurs : `lib/db.ts`, `lib/r2.ts`, `lib/uploadthing.ts`, `lib/clerk.ts`, `lib/query-client.ts`
- `proxy.ts` initial (Clerk) — **pattern sûr anti-boucle** (cf. recherche)
- Format réponse API standardisé + erreurs typées
- Suppression de `tailwind.config.ts` (migration vers `globals.css` pur v4)

### 🔹 Phase 1 — Design System & Composants `(priorité haute)`
**Réf. §6**

- **`globals.css`** : tokens de couleurs de marque (vert lime + bleu nuit), dark mode, rayons, typographie `font-display`
- shadcn/ui : **personnalisation via `className` uniquement** (composants déjà installés, je n'en recrée pas)
- Composants réutilisables extraits : `Logo`, `Button` (variant `brand`), `Card`, `FormField` (wrapper TanStack Form), `Input`, `PasswordInput`, `PasswordStrength`, `OTPInput`, `DataTable`, `FileUploader`, `EmptyState`, `Skeleton`, `PageHeader`, `StatCard`, `SectionCard`
- **i18n** : `messages/en.json` + `messages/fr.json` (structure complète) + `NextIntlClientProvider`
- Layouts globaux : `AuthLayout` (refactor), `DashboardLayout` (sidebar par rôle + topbar), `PublicLayout`
- Animations Framer Motion (fade-up, float, halos)

### 🔹 Phase 2 — Authentification, RBAC & Onboarding `(priorité haute)`
**Réf. §5.2, §9 | Acceptation §28.1, §28.2, §28.10**

- **Clerk** : email + password, OTP email, OAuth (Google, Apple, Facebook), récupération
- **`proxy.ts`** : protection des routes par rôle (pattern sûr, cf. recherche — pas de `auth.protect()` en runtime Node qui cause des boucles)
- **Refactor des 3 pages existantes** :
  - Extraction de `AuthPanel`, `PasswordInput`, `PasswordStrength`, `GoogleIcon`, `OAuthButtons`, `AuthHeader` en composants réutilisables
  - **Suppression de `useAuthRedirect`** → `router.push()` explicite après succès auth
  - Sign-in → `router.push("/dashboard")` (ou onboarding si incomplet)
  - Sign-up → `router.push("/verify-account")`
  - Verify-account → `router.push("/onboarding/role")` (correction typo `/oboarding`)
- **Webhook Clerk** → sync table `users` (idempotent, signature vérifiée)
- **Moteur RBAC** (`server/permissions`) : matrice §4.2 + vérification contextuelle
- **Onboarding multi-rôles** en étapes : élève, enseignant, école, parent, tuteur — avec reprise possible (Zustand `onboarding-store`)

### 🔹 Phase 3 — Base de données Drizzle complète `(priorité haute)`
**Réf. §10**

- Schéma Drizzle complet : toutes les tables §10.3 (~40 tables) + enums §10.2
- Conventions : UUID PK, `created_at`/`updated_at`, `deleted_at` soft delete, indexes, snake_case
- Migrations Neon
- `server/services` : services CRUD génériques par entité
- `server/validators` : schémas Zod par entité

### 🔹 Phase 4 — Stockage fichiers (R2 + Uploadthing) `(priorité moyenne)`
**Réf. §11**

- **Abstraction `StorageProvider`** : interface unifiée `upload`, `download`, `delete`, `getSignedUrl`
- Implémentation R2 (`@aws-sdk/client-s3`) + implémentation Uploadthing
- **Bascule via `STORAGE_PROVIDER=r2|uploadthing`** (env var)
- Flux presigned upload 5 étapes (§11.4) + validation MIME/taille par rôle
- Composant `FileUploader` réutilisable (drag & drop, preview, progression)

### 🔹 Phase 5 — Layouts dashboards & navigation `(priorité moyenne)`
**Réf. §6.3**

- `DashboardLayout` : sidebar par rôle, topbar (notifications, recherche, profil), command palette, breadcrumbs
- Navigation mobile (sheet), raccourcis clavier
- `theme-store` Zustand (dark/light/système) + `ui-store` (sidebar collapsed, command palette)

### 🔹 Phase 6 — Gestion scolaire `(priorité moyenne)`
**Réf. §5.3 | §28.3**

- Écoles, classes, matières, membres, invitations par code/email
- UI école (admin), UI enseignant (classes), UI élève (rejoindre par code)

### 🔹 Phase 7 — Bibliothèque de contenus `(priorité moyenne)`
**Réf. §5.4, §11 | §28.4**

- Catalogue, filtres, recherche FTS PostgreSQL, favoris, annotations, signalements
- Lecteur PDF inline, téléchargement sécurisé, visibilités

### 🔹 Phase 8 — Devoirs & soumissions `(priorité moyenne)`
**Réf. §5.5 | §28.5**

- Création enseignant (multi-items), soumission élève, correction, notes, feedback, statuts, retard

### 🔹 Phase 9 — Quiz & évaluations `(priorité basse)`
**Réf. §5.6 | §28.6**

- 8 types de questions, banque, minuteur, sessions, correction auto/manuelle, anti-fraude

### 🔹 Phase 10 — Gamification & concours `(priorité basse)`
**Réf. §5.7, §5.8, §29 | §28.7**

- XP, niveaux, badges, streaks (+ freeze), objectifs, classements éthiques, jobs cron

### 🔹 Phase 11 — Dashboards par rôle `(priorité basse)`
**Réf. §5.9, §5.10**

- 6 dashboards (élève, enseignant, école, parent, tuteur, admin) + charts Recharts + exports

### 🔹 Phase 12 — Messagerie & notifications `(priorité basse)`
**Réf. §5.11, §5.12, §15 | §28.9**

- Canaux encadrés (anti-harcèlement mineurs), annonces, SSE notifications, préférences

### 🔹 Phase 13 — Abonnements & paiements `(priorité basse)`
**Réf. §5.13, §17 | §28.8**

- MTN MoMo, Orange Money, carte — webhooks idempotents, entitlements, factures

### 🔹 Phase 14 — Espace parent & tutorat `(priorité basse)`
**Réf. §5.14, §5.15**

- Liaison parent↔enfant, rapports, tuteurs, réservations, avis, commission

### 🔹 Phase 15 — Administration & modération `(priorité basse)`
**Réf. §5.16, §5.17**

- Back-office admin, CMS contenus, modération, audit logs, feature flags

### 🔹 Phase 16 — Site public, SEO, PWA, perf `(priorité basse)`
**Réf. §5.1, §6.5, §20, §21, §22**

- Landing magnifique, tarifs, témoignages, FAQ, légal, SEO, PWA, accessibilité, Web Vitals

---

## 4. Décisions techniques importantes (issues de mes recherches)

| # | Décision | Raison |
|---|---|---|
| 1 | **`proxy.ts`** avec `clerkMiddleware()` + matcher manuel | Évite le bug #8302 (`auth.protect()` en runtime Node → boucles) |
| 2 | **Drizzle remplace Prisma** | Conforme au cahier §7.1 ; couche `@/lib/db` isolée |
| 3 | **Uploadthing + R2** derrière interface `StorageProvider` | Bascule via `STORAGE_PROVIDER` env var |
| 4 | **Zod Standard Schema natif** (pas d'adapter TanStack) | Depuis Zod 3.24, `validators: { onChange: schema }` suffit |
| 5 | **`globals.css` seul** (suppression `tailwind.config.ts`) | Tailwind v4 natif |
| 6 | **Refactor auth** : suppression `useAuthRedirect`, `router.push` explicite | Conforme à votre demande |
| 7 | **Composants shadcn existants** personnalisés via `className` | Pas de recréation, conforme à votre demande |

---

## 5. Méthode de travail

Pour chaque phase, je suivrai cet ordre :
1. **Recherche en ligne** des dernières API (si nouveau package/pattern)
2. **Schéma/migrations** (si données)
3. **Services + validators + permissions** (logique métier isolée)
4. **Server Actions / Route Handlers**
5. **UI** (TanStack Form/Query, shadcn/ui personnalisé)
6. **Vérification navigateur** (Agent Browser) — le site doit être interactif, pas juste compiler
7. **Lint + dev.log** propres

---

## 6. Démarrage immédiat

Ce projet est **massif** (40+ tables, 8 rôles, ~18 modules). Je vais travailler **phase par phase**, en livrant du code complet et fonctionnel à chaque étape, sans TODO.

Je commence par la **Phase 0 (Socle & Configuration)** dès votre confirmation.

👉 **Voulez-vous que je démarre la Phase 0 maintenant ?** Répondez simplement « oui » (ou « go » / « ok ») et je commence immédiatement l'installation et la configuration du socle technique.