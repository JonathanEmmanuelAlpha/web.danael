/**
 * §5.16 — Feature flag service.
 *
 * Per-flag kill-switch / opt-in. Read-then-write logic with a tiny in-memory
 * cache (5s TTL) to avoid hammering the DB on hot `isFlagEnabled` checks.
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 */

import { desc, eq } from "drizzle-orm";

import { getDb } from "@/server/db";
import { featureFlags } from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type { FeatureFlag } from "@/server/db/schema/admin";
import type {
  CreateFlagInput,
  SetFlagInput,
  GetFlagInput,
} from "@/server/validators/admin";

/* ── Types ─────────────────────────────────────────────────── */

export type { FeatureFlag };

/* ── In-memory cache (5s TTL) ──────────────────────────────── */

const CACHE_TTL_MS = 5_000;
const _cache = new Map<string, { value: boolean; expiresAt: number }>();

function cacheGet(key: string): boolean | undefined {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet(key: string, value: boolean): void {
  _cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function cacheInvalidate(key: string): void {
  _cache.delete(key);
}

/* ── Mutations ─────────────────────────────────────────────── */

export async function createFlag(
  input: CreateFlagInput,
): Promise<FeatureFlag> {
  const db = await getDb();
  const existing = await db
    .select({ id: featureFlags.id })
    .from(featureFlags)
    .where(eq(featureFlags.key, input.key))
    .limit(1);
  if (existing.length > 0) {
    throw AppError.conflict(`Flag "${input.key}" already exists`);
  }
  const [row] = await db
    .insert(featureFlags)
    .values({
      key: input.key,
      description: input.description ?? null,
      enabled: input.enabled,
    })
    .returning();
  if (!row) throw AppError.internal("Failed to create flag");
  cacheSet(row.key, row.enabled);
  return row;
}

export async function setFlag(
  input: SetFlagInput,
): Promise<FeatureFlag> {
  const db = await getDb();
  const [row] = await db
    .update(featureFlags)
    .set({ enabled: input.enabled })
    .where(eq(featureFlags.key, input.key))
    .returning();
  if (!row) {
    throw AppError.notFound(`Flag "${input.key}" not found`);
  }
  cacheSet(row.key, row.enabled);
  return row;
}

/* ── Queries ───────────────────────────────────────────────── */

export async function listFlags(): Promise<FeatureFlag[]> {
  const db = await getDb();
  return db
    .select()
    .from(featureFlags)
    .orderBy(desc(featureFlags.updatedAt));
}

export async function getFlag(
  input: GetFlagInput,
): Promise<FeatureFlag> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.key, input.key))
    .limit(1);
  const row = rows.at(0);
  if (!row) {
    throw AppError.notFound(`Flag "${input.key}" not found`);
  }
  return row;
}

/**
 * Returns true if the flag is enabled. Defaults to `false` when the flag
 * doesn't exist (fail-closed). Uses a 5s in-memory cache.
 */
export async function isFlagEnabled(key: string): Promise<boolean> {
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  const db = await getDb();
  const rows = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.key, key))
    .limit(1);
  const enabled = rows.at(0)?.enabled ?? false;
  cacheSet(key, enabled);
  return enabled;
}

/**
 * Invalidate the in-memory cache for a key (useful after explicit admin
 * toggle when we want subsequent reads to go straight to DB).
 */
export function invalidateFlagCache(key: string): void {
  cacheInvalidate(key);
}
