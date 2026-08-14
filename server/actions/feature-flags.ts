"use server";

/**
 * §5.16 — Feature flag server actions.
 *
 * Wraps the feature-flags service with auth + RBAC (platform_admin only).
 * Toggles emit an audit log entry.
 */

import { revalidatePath } from "next/cache";

import { requireDbUser } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requireRole } from "@/server/permissions";

import * as flagsService from "@/server/services/feature-flags";
import { logAction } from "@/server/services/audit";
import {
  createFlagSchema,
  setFlagSchema,
  getFlagSchema,
} from "@/server/validators/admin";
import type { FeatureFlag } from "@/server/db/schema/admin";

/* ── Helpers ─────────────────────────────────────────────── */

function handleErr(err: unknown, label: string): ApiResponse<never> {
  if (err instanceof AppError) {
    return { success: false, error: { code: err.code, message: err.message } };
  }
  logger.error(`${label} failed`, { error: String(err) });
  return {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  };
}

/* ── Mutations ─────────────────────────────────────────────── */

export async function createFlagAction(
  input: unknown,
): Promise<ApiResponse<FeatureFlag>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin");
    const parsed = createFlagSchema.parse(input);
    const flag = await flagsService.createFlag(parsed);

    await logAction(user.id, "feature_flag.create", "feature_flag", flag.id, {
      key: parsed.key,
      enabled: parsed.enabled,
    });
    revalidatePath("/admin/feature-flags");
    return { success: true, data: flag };
  } catch (err) {
    return handleErr(err, "createFlagAction");
  }
}

export async function setFlagAction(
  input: unknown,
): Promise<ApiResponse<FeatureFlag>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin");
    const parsed = setFlagSchema.parse(input);
    const flag = await flagsService.setFlag(parsed);

    await logAction(
      user.id,
      "feature_flag.toggle",
      "feature_flag",
      flag.id,
      { key: parsed.key, enabled: parsed.enabled },
    );
    revalidatePath("/admin/feature-flags");
    return { success: true, data: flag };
  } catch (err) {
    return handleErr(err, "setFlagAction");
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function listFlagsAction(): Promise<ApiResponse<FeatureFlag[]>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin");
    const flags = await flagsService.listFlags();
    return { success: true, data: flags };
  } catch (err) {
    return handleErr(err, "listFlagsAction");
  }
}

export async function getFlagAction(
  input: unknown,
): Promise<ApiResponse<FeatureFlag>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin");
    const parsed = getFlagSchema.parse(input);
    const flag = await flagsService.getFlag(parsed);
    return { success: true, data: flag };
  } catch (err) {
    return handleErr(err, "getFlagAction");
  }
}
