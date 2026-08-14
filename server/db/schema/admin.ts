/**
 * §10.3 — Admin, audit & feature flags.
 *
 * - audit_logs (append-only audit trail of every privileged action)
 * - feature_flags (per-flag kill-switch / opt-in)
 * - moderation_reports (community moderation queue — distinct from content_reports)
 */
import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  boolean,
  jsonb,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";

import { type JsonRecord, pgRef } from "./_env";
import { users } from "./users";
import { reportStatusEnum } from "./enums";

/* ─────────────────────────────────────────────────────────────
 * audit_logs
 * ──────────────────────────────────────────────────────────── */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => pgRef(users.id), {
      onDelete: "set null",
    }),
    /** Short stable action code (e.g. "user.invite", "content.delete"). */
    action: pgText("action").notNull(),
    /** Polymorphic target type ("content", "user", "class"...). */
    entityType: pgText("entity_type").notNull(),
    entityId: pgText("entity_id").notNull(),
    metadata: jsonb("metadata").$type<JsonRecord>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    actorIdx: pgIndex("audit_logs_actor_id_idx").on(t.actorId),
    actionIdx: pgIndex("audit_logs_action_idx").on(t.action),
    entityIdx: pgIndex("audit_logs_entity_idx").on(t.entityType, t.entityId),
    createdIdx: pgIndex("audit_logs_created_at_idx").on(t.createdAt),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * feature_flags
 * ──────────────────────────────────────────────────────────── */

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Stable identifier (e.g. "competitions.enabled"). */
    key: pgText("key").notNull().unique(),
    description: pgText("description"),
    enabled: boolean("enabled").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    keyIdx: pgUniqueIndex("feature_flags_key_uniq").on(t.key),
  }),
);

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * moderation_reports — generic community reports queue
 * (distinct from content_reports which is content-specific)
 * ──────────────────────────────────────────────────────────── */

export const moderationReports = pgTable(
  "moderation_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Polymorphic target ("message", "user", "review"...). */
    targetType: pgText("target_type").notNull(),
    targetId: pgText("target_id").notNull(),
    reason: pgText("reason").notNull(),
    status: reportStatusEnum("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => pgRef(users.id), {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    reporterIdx: pgIndex("moderation_reports_reporter_id_idx").on(t.reporterId),
    targetIdx: pgIndex("moderation_reports_target_idx").on(
      t.targetType,
      t.targetId,
    ),
    statusIdx: pgIndex("moderation_reports_status_idx").on(t.status),
    resolvedByIdx: pgIndex("moderation_reports_resolved_by_idx").on(
      t.resolvedBy,
    ),
  }),
);

export type ModerationReport = typeof moderationReports.$inferSelect;
export type NewModerationReport = typeof moderationReports.$inferInsert;
