#!/usr/bin/env node
/**
 * Danaël — Phase 0
 * Génère l'arborescence complète du projet conformément au cahier des charges §8.
 * Usage : npm run scaffold
 * Idempotent : ne jamais écraser un fichier existant.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SRC = join(process.cwd(), "");

// ── Dossiers sans fichiers (remplis par les phases suivantes) ──────────────
const DIRS = [
  // components/
  "components/ui",
  "components/layout",
  "components/dashboard",
  "components/forms",
  "components/content",
  "components/assignments",
  "components/quiz",
  "components/competitions",
  "components/gamification",
  "components/messaging",
  "components/notifications",
  "components/charts",
  "components/tables",
  "components/shared",
  // features/
  "features/auth",
  "features/users",
  "features/schools",
  "features/classes",
  "features/contents",
  "features/assignments",
  "features/quiz",
  "features/competitions",
  "features/gamification",
  "features/progress",
  "features/messaging",
  "features/notifications",
  "features/subscriptions",
  "features/tutoring",
  "features/admin",
  "features/analytics",
  // server/ (§8)
  "server/db/migrations",
  "server/services",
  "server/actions",
  "server/permissions",
  "server/validators",
  "server/jobs",
  "server/providers",
  // app/api/ (implémentées dans leurs phases respectives)
  "app/api/webhooks/clerk",
  "app/api/webhooks/payments",
  "app/api/files/upload-url",
  "app/api/files/confirm-upload",
  "app/api/files/download-url",
  "app/api/search",
  "app/api/exports",
  "app/api/notifications/sse",
];

// ── Pages placeholder §8 : chemin relatif à app/ → titre affiché ───────────
const PAGES = {
  "(public)/page": "Danaël",
  "(public)/pricing/page": "Tarifs",
  "(public)/testimonials/page": "Témoignages",
  "(public)/schools/page": "Établissements partenaires",
  "(public)/contact/page": "Contact",
  "(auth)/sign-in/page": "Connexion",
  "(auth)/sign-up/page": "Inscription",
  "(auth)/onboarding/role/page": "Onboarding — Choix du rôle",
  "(auth)/onboarding/student/page": "Onboarding — Élève",
  "(auth)/onboarding/teacher/page": "Onboarding — Enseignant",
  "(auth)/onboarding/school/page": "Onboarding — Établissement",
  "(auth)/onboarding/parent/page": "Onboarding — Parent",
  "student/today/page": "Aujourd'hui",
  "student/dashboard/page": "Tableau de bord élève",
  "student/library/page": "Bibliothèque",
  "student/contents/[id]/page": "Détail du contenu",
  "student/assignments/page": "Devoirs",
  "student/assignments/[id]/page": "Détail du devoir",
  "student/quiz/page": "Quiz",
  "student/quiz/session/[id]/page": "Session de quiz",
  "student/competitions/page": "Concours",
  "student/progress/page": "Progression",
  "student/badges/page": "Badges",
  "student/messages/page": "Messages",
  "student/settings/page": "Paramètres",
  "teacher/dashboard/page": "Tableau de bord enseignant",
  "teacher/classes/page": "Classes",
  "teacher/classes/[id]/page": "Détail de la classe",
  "teacher/assignments/page": "Devoirs",
  "teacher/gradebook/page": "Cahier de notes",
  "teacher/attendance/page": "Présence",
  "teacher/contents/page": "Contenus",
  "teacher/students/page": "Élèves",
  "teacher/messages/page": "Messages",
  "teacher/settings/page": "Paramètres",
  "school/dashboard/page": "Tableau de bord établissement",
  "school/teachers/page": "Enseignants",
  "school/students/page": "Élèves",
  "school/classes/page": "Classes",
  "school/contents/page": "Contenus",
  "school/analytics/page": "Analytique",
  "school/billing/page": "Facturation",
  "school/settings/page": "Paramètres",
  "parent/dashboard/page": "Tableau de bord parent",
  "parent/children/page": "Enfants",
  "parent/billing/page": "Paiements",
  "parent/messages/page": "Messages",
  "tutor/dashboard/page": "Tableau de bord tuteur",
  "tutor/profile/page": "Profil tuteur",
  "tutor/bookings/page": "Réservations",
  "tutor/earnings/page": "Revenus",
  "tutor/reviews/page": "Avis",
  "admin/dashboard/page": "Admin — Vue globale",
  "admin/users/page": "Admin — Utilisateurs",
  "admin/schools/page": "Admin — Écoles",
  "admin/contents/page": "Admin — Contenus",
  "admin/subscriptions/page": "Admin — Abonnements",
  "admin/payments/page": "Admin — Paiements",
  "admin/moderation/page": "Admin — Modération",
  "admin/analytics/page": "Admin — Analytique",
};

// ── Stubs de stores (§13.1) et hooks (§8) ───────────────────────────────────
const STUBS = {
  "stores/theme-store.ts": "theme (Phase 1)",
  "stores/ui-store.ts": "sidebar / command palette (Phase 1)",
  "stores/filters-store.ts": "filtres persistants bibliothèque (Phase 4)",
  "stores/quiz-store.ts": "état local de session quiz (Phase 6)",
  "stores/onboarding-store.ts": "état d'onboarding (Phase 2)",
  "hooks/use-current-user.ts": "utilisateur courant (Phase 2)",
  "hooks/use-role.ts": "rôle courant (Phase 2)",
  "hooks/use-permissions.ts": "permissions côté client (Phase 2)",
};

const pageTemplate = (title, url) => `export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">${title}</h1>
        <p className="text-sm opacity-60">
          Route <code>${url}</code> — placeholder Phase 0.
        </p>
      </div>
    </main>
  )
}
`;

let created = 0;
let skipped = 0;

for (const dir of DIRS) {
  const path = join(SRC, dir);
  mkdirSync(path, { recursive: true });
  const keep = join(path, ".gitkeep");
  if (!existsSync(keep)) writeFileSync(keep, "");
}

for (const [route, title] of Object.entries(PAGES)) {
  const file = join(SRC, "app", `${route}.tsx`);
  if (existsSync(file)) {
    skipped++;
    continue;
  }
  const url =
    "/" + route.replace(/^\([^)]+\)\//, "").replace(/(^|\/)page$/, "");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, pageTemplate(title, url));
  created++;
}

for (const [file, phase] of Object.entries(STUBS)) {
  const path = join(SRC, file);
  if (existsSync(path)) {
    skipped++;
    continue;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `// §8 — Implémentation prévue : ${phase}.\nexport {}\n`);
  created++;
}

console.log(
  `✅ Arborescence §8 générée (${created} fichiers créés, ${skipped} existants conservés).`,
);
