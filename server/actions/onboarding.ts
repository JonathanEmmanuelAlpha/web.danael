"use server";

/**
 * §5.2 — Onboarding server actions.
 *
 * Multi-step onboarding for each role. Each action:
 *  1. Requires an authenticated session.
 *  2. Validates the input with Zod.
 *  3. Updates the user row in the DB.
 *  4. Returns a typed result.
 */

import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentDbUser, getSessionUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import type { UserRole, Level, Series } from "@/types";
import { createSchool, getSchoolById } from "../services/schools";
import { CreateSchoolInput } from "../validators";
import { getAccessRequestAction } from "./school-access";

/* ── Schemas ───────────────────────────────────────────────── */

const roleSchema = z.enum([
  "student",
  "teacher",
  "school_admin",
  "parent",
  "tutor",
  "platform_admin",
  "content_moderator",
  "support",
]);

const genderSchema = z.enum(["male", "female"]);

const profileOnboardingSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  gender: genderSchema,
  addressCity: z.string(),
  addressRegion: z.string(),
  addressCountry: z.string(),
  addressQuarter: z.string().optional(),
  birthDate: z.date().optional(),
});

const studentOnboardingSchema = z.object({
  level: z.enum(["6e", "5e", "4e", "3e", "2nde", "1ere", "Tle"]),
  series: z.enum(["A", "B", "C", "D", "E", "F", "G", "TI"]).optional(),
  weeklyGoal: z.number().int().min(1).max(50).default(5),
});

const teacherOnboardingSchema = z.object({
  subjects: z.array(z.string()).min(1, "Sélectionnez au moins une matière"),
});

const schoolOnboardingSchema = z.object({
  schoolName: z.string().min(2, "Le nom de l'établissement est requis"),
  city: z.string().min(2, "La ville est requise"),
  region: z.string().min(2, "La région est requise"),
  schoolType: z.enum(["public", "private", "parochial", "other"]),
});

const parentOnboardingSchema = z.object({
  childCode: z
    .string()
    .min(6, "Le code doit contenir au moins 6 caractères")
    .optional()
    .or(z.literal("")),
});

const tutorOnboardingSchema = z.object({
  bio: z.string().min(20, "Décrivez votre parcours en quelques phrases"),
  hourlyRate: z.number().min(500, "Le tarif minimum est de 500 FCFA"),
  location: z.string().min(2, "Indiquez votre zone"),
  subjects: z.array(z.string()).min(1, "Sélectionnez au moins une matière"),
});

/* ── Actions ──────────────────────────────────────────────── */

export async function setRoleAction(
  role: UserRole,
): Promise<ApiResponse<{ role: UserRole }>> {
  try {
    const sessionUser = await requireSession();

    const parsed = roleSchema.safeParse(role);
    if (!parsed.success) {
      throw AppError.validation("Invalid role", parsed.error.flatten());
    }

    const db = await getDb();
    const [dbUser] = await db
      .insert(users)
      .values({
        role: parsed.data,
        updatedAt: new Date(),
        onboardingStatus: "role_selected",
        email: sessionUser.email,
        firstName: sessionUser.firstName,
        lastName: sessionUser.lastName,
        clerkId: sessionUser.clerkId,
      })
      .returning();

    logger.info("Onboarding: role set", {
      userId: dbUser.id,
      role: parsed.data,
    });
    revalidatePath("/onboarding");

    return { success: true, data: { role: parsed.data as UserRole } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("setRoleAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not set role" },
    };
  }
}

export async function completeProfileAction(
  input: z.infer<typeof profileOnboardingSchema>,
): Promise<ApiResponse> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = profileOnboardingSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const db = await getDb();
    await db
      .update(users)
      .set({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        gender: parsed.data.gender,
        address: {
          city: parsed.data.addressCity,
          region: parsed.data.addressRegion,
          country: parsed.data.addressCountry,
          quater: parsed.data.addressQuarter,
        },
        birthDate: parsed.data.birthDate
          ? new Date(parsed.data.birthDate)
          : undefined,
        onboardingStatus: "profile_completed",
      })
      .where(eq(users.id, dbUser.id));

    logger.info("Onboarding: profile completed", { userId: dbUser.id });
    revalidatePath("/dashboard");

    return { success: true, data: { completed: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("completeProfileAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not complete onboarding",
      },
    };
  }
}

export async function completeStudentOnboardingAction(
  input: z.infer<typeof studentOnboardingSchema>,
): Promise<ApiResponse<{ completed: boolean; redirectTo?: string }>> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = studentOnboardingSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const db = await getDb();
    await db
      .update(users)
      .set({
        level: parsed.data.level as Level,
        series: (parsed.data.series ?? null) as Series | null,
        weeklyGoal: parsed.data.weeklyGoal,
        onboardingStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id));

    logger.info("Onboarding: student completed", { userId: dbUser.id });
    revalidatePath("/dashboard");

    // After completing onboarding, students are redirected to the
    // Talent Discovery Assessment (TDA) — see /student/talent/assessment.
    // The redirect is handled client-side in the onboarding page.
    return {
      success: true,
      data: { completed: true, redirectTo: "/student/talent/assessment" },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("completeStudentOnboardingAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not complete onboarding",
      },
    };
  }
}

export async function completeTeacherOnboardingAction(
  input: z.infer<typeof teacherOnboardingSchema>,
): Promise<ApiResponse<{ completed: boolean }>> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = teacherOnboardingSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const db = await getDb();
    await db
      .update(users)
      .set({
        onboardingStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id));

    logger.info("Onboarding: teacher completed", {
      userId: dbUser.id,
      subjects: parsed.data.subjects,
    });
    revalidatePath("/dashboard");

    return { success: true, data: { completed: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("completeTeacherOnboardingAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not complete onboarding",
      },
    };
  }
}

export async function completeSchoolOnboardingAction(
  schoolId: string,
): Promise<ApiResponse<{ completed: boolean }>> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const db = await getDb();

    const school = await getSchoolById(schoolId);
    if (!school || !school.id || school.clerkOrgId !== dbUser.id)
      throw AppError.notFound("No school associated to your account");

    await db
      .update(users)
      .set({
        onboardingStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id));

    logger.info("Onboarding: school completed", {
      userId: dbUser.id,
      schoolName: school.name,
    });
    revalidatePath("/school/dashboard");

    return { success: true, data: { completed: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("completeSchoolOnboardingAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not complete onboarding",
      },
    };
  }
}

export async function completeJoinSchoolOnboardingAction(
  requestId: string,
  schoolId: string,
): Promise<ApiResponse<{ completed: boolean }>> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const db = await getDb();

    const result = await getAccessRequestAction(requestId, schoolId);
    if (!result.success)
      throw AppError.notFound("School join request failed to finalize");

    await db
      .update(users)
      .set({
        onboardingStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id));

    logger.info("Onboarding: join school completed", {
      userId: dbUser.id,
    });
    revalidatePath("/dashboard");

    return { success: true, data: { completed: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("completeSchoolOnboardingAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not complete onboarding",
      },
    };
  }
}

export async function completeParentOnboardingAction(
  input: z.infer<typeof parentOnboardingSchema>,
): Promise<ApiResponse<{ completed: boolean }>> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = parentOnboardingSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const db = await getDb();
    await db
      .update(users)
      .set({
        onboardingStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id));

    logger.info("Onboarding: parent completed", { userId: dbUser.id });
    revalidatePath("/dashboard");

    return { success: true, data: { completed: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("completeParentOnboardingAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not complete onboarding",
      },
    };
  }
}

export async function completeTutorOnboardingAction(
  input: z.infer<typeof tutorOnboardingSchema>,
): Promise<ApiResponse<{ completed: boolean }>> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = tutorOnboardingSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const db = await getDb();
    await db
      .update(users)
      .set({
        onboardingStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id));

    logger.info("Onboarding: tutor completed", { userId: dbUser.id });
    revalidatePath("/dashboard");

    return { success: true, data: { completed: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("completeTutorOnboardingAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not complete onboarding",
      },
    };
  }
}

/* ── Admin roles onboarding (platform_admin / content_moderator / support) ── */

const adminRoleSchema = z.enum([
  "platform_admin",
  "content_moderator",
  "support",
]);

const adminCodeSchema = z.object({
  code: z.string().min(8, "Le code doit contenir au moins 8 caractères"),
  role: adminRoleSchema,
});

const completeAdminOnboardingSchema = z.object({
  role: adminRoleSchema,
  authorizationCode: z
    .string()
    .min(8, "Le code doit contenir au moins 8 caractères"),
});

/**
 * Validate an admin authorization code.
 *
 * at least 8 characters. In production, you would check against an
 * `admin_authorization_codes` table or an env variable.
 */
export async function validateAdminCodeAction(input: {
  code: string;
  role: "platform_admin" | "content_moderator" | "support";
}): Promise<ApiResponse<{ valid: boolean; message?: string }>> {
  try {
    await requireSession();

    const parsed = adminCodeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: true,
        data: {
          valid: false,
          message:
            parsed.error.issues[0]?.message ?? "Code d'autorisation invalide",
        },
      };
    }

    // Production mode: check against env variable ADMIN_AUTHORIZATION_CODES
    // (format: "platform_admin:CODE1,content_moderator:CODE2,support:CODE3").
    const codesEnv = process.env.ADMIN_AUTHORIZATION_CODES ?? "";
    const expected = codesEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .find((entry) => entry.startsWith(`${parsed.data.role}:`));
    if (!expected) {
      return {
        success: true,
        data: { valid: false, message: "Code d'autorisation invalide" },
      };
    }
    const expectedCode = expected.split(":").slice(1).join(":").trim();
    if (
      expectedCode.length < 8 ||
      expectedCode.toUpperCase() !== parsed.data.code
    ) {
      return {
        success: true,
        data: {
          valid: false,
          message: "Votre Code d'autorisation est invalide",
        },
      };
    }

    return { success: true, data: { valid: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("validateAdminCodeAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not validate authorization code",
      },
    };
  }
}

/**
 * Complete onboarding for admin roles (with code validation).
 *
 * Activates the user's account by validating the authorization code provided
 * by the platform administrator, then marks the user's onboarding as
 * completed and sets their role to the requested admin role.
 */
export async function completeAdminOnboardingAction(input: {
  role: "platform_admin" | "content_moderator" | "support";
  authorizationCode: string;
}): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const sessionUser = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = completeAdminOnboardingSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Re-validate the code (do not trust the client).
    const codeCheck = await validateAdminCodeAction({
      code: parsed.data.authorizationCode,
      role: parsed.data.role,
    });
    if (!codeCheck.success) {
      throw AppError.internal(
        codeCheck.error.message ?? "Could not validate authorization code",
      );
    }
    if (!codeCheck.data.valid) {
      throw AppError.forbidden(
        codeCheck.data.message ?? "Code d'autorisation invalide",
      );
    }

    const db = await getDb();
    await db
      .update(users)
      .set({
        role: parsed.data.role,
        onboardingStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id));

    logger.info("Onboarding: admin role activated", {
      userId: dbUser.id,
      role: parsed.data.role,
      clerkId: sessionUser.clerkId,
    });
    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard");

    return { success: true, data: { success: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("completeAdminOnboardingAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not complete admin onboarding",
      },
    };
  }
}
