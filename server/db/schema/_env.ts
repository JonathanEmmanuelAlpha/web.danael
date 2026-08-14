/**
 * Shared dual-mode constants & helpers used by every schema file.
 *
 * The project ships with TWO database backends:
 *  - Neon PostgreSQL (production) when `DATABASE_URL` starts with `postgres://`
 *  - Bun SQLite (local sandbox dev) otherwise
 *
 * Each table file defines a `pgX` and a `sqliteX` variant and exports the
 * right one based on `isNeon`. The exported value's TypeScript type becomes
 * `typeof pgX | typeof sqliteX`, which means cross-table FK references
 * (`.references(() => otherTable.id, ...)`) end up with a union of
 * `PgColumn | SQLiteColumn` — incompatible with both `AnyPgColumn` and
 * `AnySQLiteColumn`. The `pgRef` / `sqliteRef` helpers below cast away the
 * union in a controlled, centralised way so every FK compiles.
 */

import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const rawDatabaseUrl = process.env.DATABASE_URL ?? "";

/** True when the configured DATABASE_URL points at Neon (PostgreSQL). */
export const isNeon = /^postgres(ql)?:\/\//i.test(rawDatabaseUrl);

/**
 * Tiny helper used to type JSON columns consistently across dialects.
 * PostgreSQL uses `jsonb`, SQLite uses `text({ mode: "json" })`.
 */
export type JsonRecord = Record<string, unknown>;

/**
 * Cast a (possibly unioned) column to `AnyPgColumn` for use in pg FK
 * references. Runtime behaviour is unchanged — the cast only satisfies
 * TypeScript.
 */
export function pgRef<T>(col: T): AnyPgColumn {
  return col as unknown as AnyPgColumn;
}

/**
 * Cast a (possibly unioned) column to `AnySQLiteColumn` for use in sqlite
 * FK references.
 */
export function sqliteRef<T>(col: T): AnySQLiteColumn {
  return col as unknown as AnySQLiteColumn;
}
