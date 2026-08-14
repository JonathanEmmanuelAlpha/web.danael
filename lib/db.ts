/**
 * §7.1 — Database access point (re-export of Drizzle client).
 *
 * The project migrated from Prisma to Drizzle ORM in Phase 0.
 * Canonical import path: `import { getDb, schema } from "@/lib/db"`.
 *
 * Always use `const db = await getDb()` — the client is lazily initialized
 * to support both Neon (PostgreSQL) and Bun SQLite (sandbox dev).
 */

export { getDb, schema, type Database } from "@/server/db";
