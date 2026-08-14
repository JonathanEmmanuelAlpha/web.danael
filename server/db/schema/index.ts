/**
 * §10 — Complete Danaël Drizzle schema (dual-mode Neon PG + Bun SQLite).
 *
 * Each domain table is defined in its own module and re-exported here so the
 * runtime DB client (`src/server/db/index.ts`) can `import * as schema` once
 * and get every table, type, and enum.
 *
 * Enum constants & pg enums live in `./enums`. The dual-mode switch helper
 * lives in `./_env`.
 */

export { isNeon, rawDatabaseUrl } from "./_env";

/* ── Enums (constants + pgEnum builders) ─────────────────── */
export * from "./enums";

/* ── Domain tables ───────────────────────────────────────── */
export * from "./users";
export * from "./schools";
export * from "./contents";
export * from "./assignments";
export * from "./quizzes";
export * from "./competitions";
export * from "./messaging";
export * from "./payments";
export * from "./tutoring";
export * from "./admin";
export * from "./learning";
