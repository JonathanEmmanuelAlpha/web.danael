/**
 * §10.4 — Career Horizon service.
 *
 * Matches a student's North Star skill with real-world careers
 * using a curated knowledge base of skill → career mappings.
 *
 * In production this would use NLP embeddings (z-ai-sdk) to match
 * against a career database (ROME / O*NET). For the MVP we ship a
 * curated mapping for common skills + a heuristic scoring.
 */

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  subjectSkills,
  subjects,
  careerMatches,
  talentProfiles,
} from "@/server/db/schema";
import type { CareerMatch } from "@/server/db/schema/talent";

/* ── Curated career knowledge base ─────────────────────────── */

interface CareerEntry {
  code: string;
  title: string;
  /** Keywords that map this career to a skill (matched on skill name
   * and subject name, case-insensitive, substring match). */
  keywords: string[];
  /** Short description shown to the student. */
  description: string;
  /** Median salary range (informational). */
  salaryRange?: string;
  /** Required education level. */
  educationLevel?: string;
}

const CAREER_DATABASE: CareerEntry[] = [
  // Math / Geometry / Algebra
  {
    code: "M1201",
    title: "Ingénieur en modélisation mathématique",
    keywords: ["algèbre", "géométrie", "analyse", "mathématiques", "statistiques"],
    description:
      "Conçoit des modèles mathématiques pour résoudre des problèmes industriels, financiers ou scientifiques.",
    salaryRange: "45k-90k €/an",
    educationLevel: "Bac+5 (Master ingénieur)",
  },
  {
    code: "M1202",
    title: "Actuaire",
    keywords: ["statistiques", "probabilités", "analyse", "mathématiques"],
    description:
      "Analyse les risques financiers et conçoit des contrats d'assurance.",
    salaryRange: "40k-80k €/an",
    educationLevel: "Bac+5 (Master actuariat)",
  },
  {
    code: "M1203",
    title: "Chercheur en mathématiques",
    keywords: ["algèbre", "géométrie", "analyse", "mathématiques", "topologie"],
    description:
      "Mène des recherches fondamentales en mathématiques pures ou appliquées.",
    salaryRange: "35k-70k €/an",
    educationLevel: "Bac+8 (Doctorat)",
  },
  {
    code: "M1204",
    title: "Data Scientist",
    keywords: ["statistiques", "analyse", "probabilités", "algorithmique"],
    description:
      "Analyse de grandes masses de données pour en extraire des insights actionnables.",
    salaryRange: "40k-75k €/an",
    educationLevel: "Bac+5 (Master data science)",
  },
  {
    code: "M1205",
    title: "Architecte",
    keywords: ["géométrie", "dessin", "physique"],
    description:
      "Conçoit des bâtiments en combinant esthétique, géométrie et contraintes techniques.",
    salaryRange: "35k-70k €/an",
    educationLevel: "Bac+5 (Master architecture)",
  },

  // Physics
  {
    code: "P2201",
    title: "Ingénieur en énergie renouvelable",
    keywords: ["physique", "mécanique", "thermodynamique"],
    description:
      "Conçoit des systèmes de production d'énergie solaire, éolienne ou hydraulique.",
    salaryRange: "40k-75k €/an",
    educationLevel: "Bac+5",
  },
  {
    code: "P2202",
    title: "Astrophysicien",
    keywords: ["physique", "mécanique", "optique"],
    description:
      "Étudie les étoiles, galaxies et phénomènes cosmiques.",
    salaryRange: "35k-70k €/an",
    educationLevel: "Bac+8 (Doctorat)",
  },

  // Chemistry
  {
    code: "C3201",
    title: "Ingénieur chimiste",
    keywords: ["chimie", "physique", "biochimie"],
    description:
      "Développe de nouveaux matériaux, médicaments ou procédés industriels.",
    salaryRange: "38k-72k €/an",
    educationLevel: "Bac+5",
  },
  {
    code: "C3202",
    title: "Pharmacien",
    keywords: ["chimie", "biochimie", "biologie"],
    description:
      "Prépare et dispense des médicaments, conseille les patients.",
    salaryRange: "40k-80k €/an",
    educationLevel: "Bac+6 (Diplôme d'État)",
  },

  // Biology
  {
    code: "B4201",
    title: "Biologiste médical",
    keywords: ["biologie", "biochimie", "svt"],
    description:
      "Analyse des échantillons biologiques pour aider au diagnostic.",
    salaryRange: "30k-55k €/an",
    educationLevel: "Bac+5",
  },
  {
    code: "B4202",
    title: "Médecin",
    keywords: ["biologie", "biochimie", "svt", "chimie"],
    description:
      "Diagnostique et traite les maladies chez les patients.",
    salaryRange: "45k-120k €/an",
    educationLevel: "Bac+9",
  },

  // Languages / Literature
  {
    code: "L5201",
    title: "Rédacteur / Éditeur",
    keywords: ["français", "littérature", "langues", "rédaction"],
    description:
      "Rédige, corrige et publie des contenus (livres, articles, sites web).",
    salaryRange: "25k-50k €/an",
    educationLevel: "Bac+3",
  },
  {
    code: "L5202",
    title: "Traducteur",
    keywords: ["langues", "français", "anglais", "espagnol"],
    description:
      "Traduit des textes d'une langue à une autre en préservant le sens et le style.",
    salaryRange: "25k-45k €/an",
    educationLevel: "Bac+3",
  },
  {
    code: "L5203",
    title: "Avocat",
    keywords: ["français", "philosophie", "histoire"],
    description:
      "Conseille et représente des clients dans des affaires juridiques.",
    salaryRange: "40k-100k €/an",
    educationLevel: "Bac+5",
  },

  // Computer Science
  {
    code: "I6201",
    title: "Développeur logiciel",
    keywords: ["algorithmique", "informatique", "logique"],
    description:
      "Conçoit et développe des applications logicielles.",
    salaryRange: "35k-75k €/an",
    educationLevel: "Bac+3 à Bac+5",
  },
  {
    code: "I6202",
    title: "Ingénieur en intelligence artificielle",
    keywords: ["algorithmique", "mathématiques", "statistiques", "logique"],
    description:
      "Conçoit des modèles d'IA pour résoudre des problèmes complexes.",
    salaryRange: "45k-90k €/an",
    educationLevel: "Bac+5",
  },
  {
    code: "I6203",
    title: "Cybersécurité expert",
    keywords: ["informatique", "algorithmique", "logique"],
    description:
      "Protège les systèmes informatiques contre les attaques.",
    salaryRange: "40k-85k €/an",
    educationLevel: "Bac+5",
  },

  // History / Geography
  {
    code: "H7201",
    title: "Archéologue",
    keywords: ["histoire", "géographie"],
    description:
      "Fouille et étudie les vestiges des civilisations passées.",
    salaryRange: "25k-45k €/an",
    educationLevel: "Bac+5",
  },
  {
    code: "H7202",
    title: "Géomaticien",
    keywords: ["géographie", "mathématiques"],
    description:
      "Analyse des données géographiques avec des outils SIG.",
    salaryRange: "30k-55k €/an",
    educationLevel: "Bac+5",
  },

  // Philosophy
  {
    code: "P8201",
    title: "Consultant en éthique",
    keywords: ["philosophie", "français"],
    description:
      "Aide les organisations à prendre des décisions éthiques éclairées.",
    salaryRange: "35k-70k €/an",
    educationLevel: "Bac+5",
  },

  // Creative / Arts
  {
    code: "A9201",
    title: "Designer UX/UI",
    keywords: ["dessin", "arts", "créativité"],
    description:
      "Conçoit des interfaces numériques intuitives et esthétiques.",
    salaryRange: "30k-60k €/an",
    educationLevel: "Bac+3 à Bac+5",
  },
  {
    code: "A9202",
    title: "Réalisateur",
    keywords: ["arts", "français", "créativité"],
    description:
      "Dirige la création de films, séries ou vidéos.",
    salaryRange: "30k-80k €/an",
    educationLevel: "Bac+3 à Bac+5",
  },

  // Economics
  {
    code: "E10201",
    title: "Analyste financier",
    keywords: ["économie", "mathématiques", "statistiques"],
    description:
      "Analyse les marchés et conseille les investisseurs.",
    salaryRange: "40k-90k €/an",
    educationLevel: "Bac+5",
  },
  {
    code: "E10202",
    title: "Entrepreneur",
    keywords: ["économie", "créativité", "logique"],
    description:
      "Crée et dirige sa propre entreprise.",
    salaryRange: "Variable",
    educationLevel: "Variable",
  },
];

/* ── Matching algorithm ──────────────────────────────────── */

/**
 * Match a student's North Star skill with careers.
 * Returns ranked matches with a score 0-1 and human-readable reason.
 */
export async function matchCareersForStudent(
  studentId: string,
): Promise<CareerMatch[]> {
  const db = await getDb();

  // Get the student's profile + North Star.
  const profile = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.studentId, studentId))
    .limit(1);
  if (!profile.at(0) || !profile[0]!.northStarSkillId) {
    return [];
  }

  // Get the skill + subject names.
  const skillRows = await db
    .select({
      skillId: subjectSkills.id,
      skillName: subjectSkills.name,
      subjectId: subjectSkills.subjectId,
      subjectName: subjects.name,
    })
    .from(subjectSkills)
    .leftJoin(subjects, eq(subjects.id, subjectSkills.subjectId))
    .where(eq(subjectSkills.id, profile[0]!.northStarSkillId))
    .limit(1);
  const skill = skillRows.at(0);
  if (!skill) return [];

  // Match against the career database.
  const skillName = (skill.skillName ?? "").toLowerCase();
  const subjectName = (skill.subjectName ?? "").toLowerCase();
  const allKeywords = [skillName, subjectName].filter(Boolean);

  const matches: Array<{
    career: CareerEntry;
    score: number;
    reason: string;
  }> = [];

  for (const career of CAREER_DATABASE) {
    let hits = 0;
    const matchedKeywords: string[] = [];
    for (const kw of career.keywords) {
      if (allKeywords.some((k) => k.includes(kw) || kw.includes(k))) {
        hits++;
        matchedKeywords.push(kw);
      }
    }
    if (hits === 0) continue;

    // Score = 0.4 + 0.2 * hits (capped at 1.0).
    const score = Math.min(1, 0.4 + 0.2 * hits);
    const reason = `Match fort sur ${matchedKeywords.join(", ")}${
      profile[0]!.overallTalentScore > 0.7
        ? " — ton talent est confirmé"
        : ""
    }`;

    matches.push({ career, score, reason });
  }

  matches.sort((a, b) => b.score - a.score);
  const topMatches = matches.slice(0, 6);

  // Persist to DB (replace existing).
  await db
    .delete(careerMatches)
    .where(eq(careerMatches.studentId, studentId));

  const created: CareerMatch[] = [];
  for (const m of topMatches) {
    const [row] = await db
      .insert(careerMatches)
      .values({
        studentId,
        careerCode: m.career.code,
        careerTitle: m.career.title,
        matchScore: m.score,
        reason: m.reason,
        skillId: profile[0]!.northStarSkillId,
      })
      .returning();
    if (row) created.push(row);
  }

  return created;
}

/**
 * List career matches for a student.
 */
export async function listCareerMatches(
  studentId: string,
): Promise<CareerMatch[]> {
  const db = await getDb();
  return db
    .select()
    .from(careerMatches)
    .where(eq(careerMatches.studentId, studentId))
    .orderBy(desc(careerMatches.matchScore));
}

/**
 * Bookmark / unbookmark a career match.
 */
export async function bookmarkCareer(
  careerMatchId: string,
  isBookmarked: boolean,
): Promise<void> {
  const db = await getDb();
  await db
    .update(careerMatches)
    .set({ isBookmarked, updatedAt: new Date() })
    .where(eq(careerMatches.id, careerMatchId));
}
