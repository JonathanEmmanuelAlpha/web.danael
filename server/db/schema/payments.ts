/**
 * §10.3 — Subscriptions, payments & invoices.
 *
 * - subscriptions (per-user or per-school recurring plan)
 * - payments (individual transactions, supports mobile money + card)
 * - invoices (one per billing period, issued to schools)
 */

import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  boolean as pgBoolean,
  integer,
  numeric,
  jsonb,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";

import { type JsonRecord, pgRef } from "./_env";
import { users } from "./users";
import { schools } from "./schools";
import {
  subscriptionStatusEnum,
  planTypeEnum,
  paymentProviderEnum,
  paymentStatusEnum,
  invoiceStatusEnum,
} from "./enums";

/* -------------------------------------------------------------
 * subscriptions
 * ------------------------------------------------------------ */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => pgRef(users.id), {
      onDelete: "cascade",
    }),
    schoolId: uuid("school_id").references(() => pgRef(schools.id), {
      onDelete: "cascade",
    }),
    planType: planTypeEnum("plan_type").notNull().default("free"),
    status: subscriptionStatusEnum("status").notNull().default("free"),
    /** Amount in smallest currency unit (XOF has 0 decimals; we store integers). */
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: pgText("currency").notNull().default("XOF"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    autoRenew: pgBoolean("auto_renew").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    userIdx: pgIndex("subscriptions_user_id_idx").on(t.userId),
    schoolIdx: pgIndex("subscriptions_school_id_idx").on(t.schoolId),
    statusIdx: pgIndex("subscriptions_status_idx").on(t.status),
    endsAtIdx: pgIndex("subscriptions_ends_at_idx").on(t.endsAt),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

/* -------------------------------------------------------------
 * payments
 * ------------------------------------------------------------ */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subscriptionId: uuid("subscription_id").references(
      () => pgRef(subscriptions.id),
      {
        onDelete: "cascade",
      },
    ),
    provider: paymentProviderEnum("provider").notNull(),
    /** Provider transaction reference returned by the gateway. */
    providerTransactionId: pgText("provider_transaction_id"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: pgText("currency").notNull().default("XOF"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    metadata: jsonb("metadata").$type<JsonRecord>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    subscriptionIdx: pgIndex("payments_subscription_id_idx").on(
      t.subscriptionId,
    ),
    providerIdx: pgIndex("payments_provider_idx").on(t.provider),
    statusIdx: pgIndex("payments_status_idx").on(t.status),
    providerTxIdx: pgIndex("payments_provider_transaction_id_idx").on(
      t.providerTransactionId,
    ),
  }),
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

/* -------------------------------------------------------------
 * invoices
 * ------------------------------------------------------------ */

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").references(() => pgRef(schools.id), {
      onDelete: "cascade",
    }),
    subscriptionId: uuid("subscription_id").references(
      () => pgRef(subscriptions.id),
      {
        onDelete: "set null",
      },
    ),
    /** Human-readable invoice number (e.g. "INV-2025-0001"). */
    number: pgText("number").notNull().unique(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    numberIdx: pgUniqueIndex("invoices_number_uniq").on(t.number),
    schoolIdx: pgIndex("invoices_school_id_idx").on(t.schoolId),
    subscriptionIdx: pgIndex("invoices_subscription_id_idx").on(
      t.subscriptionId,
    ),
    statusIdx: pgIndex("invoices_status_idx").on(t.status),
  }),
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
