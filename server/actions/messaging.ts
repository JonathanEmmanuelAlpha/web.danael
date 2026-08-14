"use server";

/**
 * §5.11 — Messaging server actions.
 *
 * Wraps the messaging service with auth + RBAC + Zod validation. Each action
 * returns a typed ApiResponse<T>.
 *
 * Permission model (§5.11 security rules):
 *  - listThreads / getThread / sendMessage : must be authenticated
 *      + (for sendMessage) be a participant of the thread
 *  - createThread                          : any authenticated user (pair
 *      validation enforced inside the service)
 *  - addParticipant / removeParticipant   : only the existing participants,
 *      the school admin, or a platform admin
 *  - markRead                              : participant of the thread
 *  - createAnnouncement                    : school_admin / teacher /
 *      platform_admin (with proper context)
 *  - listAnnouncements                     : any authenticated user (filtered
 *      by their memberships)
 *  - deleteAnnouncement                    : author or admin
 */

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray } from "drizzle-orm";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getDb } from "@/server/db";
import {
  classes,
  classMembers,
  schools,
  schoolMembers,
  users,
  tutorProfiles,
  tutorBookings,
  parentStudentRelations,
  conversationThreads,
  conversationParticipants,
} from "@/server/db/schema";
import {
  createThreadSchema,
  sendMessageSchema,
  listMessagesQuerySchema,
  listThreadsQuerySchema,
  addParticipantSchema,
  removeParticipantSchema,
  createAnnouncementSchema,
  listAnnouncementsQuerySchema,
  type CreateThreadInput,
  type SendMessageInput,
  type ListMessagesQuery,
  type ListThreadsQuery,
  type CreateAnnouncementInput,
  type ListAnnouncementsQuery,
} from "@/server/validators/messaging";
import * as messagingService from "@/server/services/messaging";
import type {
  ThreadWithRelations,
  ThreadListResult,
  MessageWithSender,
  Announcement,
  AnnouncementListResult,
} from "@/server/services/messaging";

/* ── Helpers ───────────────────────────────────────────────── */

async function requireThreadParticipant(
  threadId: string,
): Promise<{ userId: string }> {
  const session = await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) throw AppError.notFound("User profile not found");

  const isParticipant = await messagingService.isThreadParticipant(
    threadId,
    dbUser.id,
  );
  if (!isParticipant && dbUser.role !== "platform_admin") {
    throw AppError.unauthorized("You are not a participant of this thread");
  }
  return { userId: dbUser.id };
}

/* ── Threads ──────────────────────────────────────────────── */

export async function listThreadsAction(
  query?: Partial<ListThreadsQuery>,
): Promise<ApiResponse<ThreadListResult>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = listThreadsQuerySchema.safeParse({
      search: query?.search,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 50,
    });
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const result = await messagingService.listUserThreads(
      dbUser.id,
      parsed.data,
    );
    logger.debug("listThreadsAction", {
      userId: dbUser.id,
      count: result.items.length,
      clerkId: session.clerkId,
    });
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listThreadsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list threads" },
    };
  }
}

export async function getThreadAction(
  threadId: string,
): Promise<ApiResponse<ThreadWithRelations>> {
  try {
    await requireThreadParticipant(threadId);
    const thread = await messagingService.getThreadById(threadId);
    return { success: true, data: thread };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getThreadAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load thread" },
    };
  }
}

export async function createThreadAction(
  input: CreateThreadInput,
): Promise<ApiResponse<ThreadWithRelations>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = createThreadSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const thread = await messagingService.createThread(parsed.data, dbUser.id);
    logger.info("Thread created", {
      threadId: thread.id,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/messages");
    return { success: true, data: thread };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("createThreadAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not create thread" },
    };
  }
}

export async function addParticipantAction(input: {
  threadId: string;
  userId: string;
}): Promise<ApiResponse<{ added: boolean }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = addParticipantSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Only existing participants, school admins, or platform admins can add.
    const isParticipant = await messagingService.isThreadParticipant(
      parsed.data.threadId,
      dbUser.id,
    );
    if (
      !isParticipant &&
      dbUser.role !== "platform_admin" &&
      dbUser.role !== "school_admin" &&
      dbUser.role !== "support"
    ) {
      throw AppError.unauthorized(
        "Only existing participants can add members to this thread",
      );
    }

    const result = await messagingService.addParticipant(
      parsed.data.threadId,
      parsed.data.userId,
    );
    logger.info("Participant added", {
      threadId: parsed.data.threadId,
      addedUserId: parsed.data.userId,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath(`/messages/${parsed.data.threadId}`);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("addParticipantAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not add participant" },
    };
  }
}

export async function removeParticipantAction(input: {
  threadId: string;
  userId: string;
}): Promise<ApiResponse<{ removed: boolean }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = removeParticipantSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Self-removal is allowed. Otherwise only admins / existing participants.
    const isSelf = parsed.data.userId === dbUser.id;
    if (!isSelf) {
      const isParticipant = await messagingService.isThreadParticipant(
        parsed.data.threadId,
        dbUser.id,
      );
      if (
        !isParticipant &&
        dbUser.role !== "platform_admin" &&
        dbUser.role !== "school_admin"
      ) {
        throw AppError.unauthorized(
          "Only admins or existing participants can remove members",
        );
      }
    }

    const result = await messagingService.removeParticipant(
      parsed.data.threadId,
      parsed.data.userId,
    );
    logger.info("Participant removed", {
      threadId: parsed.data.threadId,
      removedUserId: parsed.data.userId,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath(`/messages/${parsed.data.threadId}`);
    revalidatePath("/messages");
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("removeParticipantAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not remove participant",
      },
    };
  }
}

/* ── Messages ────────────────────────────────────────────── */

export async function sendMessageAction(
  input: SendMessageInput,
): Promise<ApiResponse<MessageWithSender>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = sendMessageSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const isParticipant = await messagingService.isThreadParticipant(
      parsed.data.threadId,
      dbUser.id,
    );
    if (!isParticipant) {
      throw AppError.unauthorized(
        "You can only send messages in threads you belong to",
      );
    }

    const message = await messagingService.sendMessage(parsed.data, dbUser.id);
    logger.info("Message sent", {
      messageId: message.id,
      threadId: parsed.data.threadId,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath(`/messages/${parsed.data.threadId}`);
    revalidatePath("/messages");
    return { success: true, data: message };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("sendMessageAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not send message" },
    };
  }
}

export async function listMessagesAction(
  query: ListMessagesQuery,
): Promise<ApiResponse<{ items: MessageWithSender[]; hasMore: boolean }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = listMessagesQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const isParticipant = await messagingService.isThreadParticipant(
      parsed.data.threadId,
      dbUser.id,
    );
    if (!isParticipant && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized(
        "You can only read messages in threads you belong to",
      );
    }

    const result = await messagingService.listMessages(parsed.data);
    logger.debug("listMessagesAction", {
      threadId: parsed.data.threadId,
      userId: dbUser.id,
      clerkId: session.clerkId,
      count: result.items.length,
    });
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listMessagesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list messages" },
    };
  }
}

export async function markReadAction(
  threadId: string,
): Promise<ApiResponse<{ marked: boolean }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const isParticipant = await messagingService.isThreadParticipant(
      threadId,
      dbUser.id,
    );
    if (!isParticipant) {
      throw AppError.unauthorized("You can only mark your own threads as read");
    }

    const result = await messagingService.markThreadAsRead(threadId, dbUser.id);
    logger.debug("markReadAction", {
      threadId,
      userId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/messages");
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("markReadAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not mark thread as read",
      },
    };
  }
}

/**
 * Start (or resume) a direct conversation with another user.
 *
 * NOTE: This function is also defined at the top of this file (added by
 * another agent). That version uses `messagingService.findDirectThread`,
 * which is the canonical implementation. We keep only that one to avoid
 * a duplicate export.
 */

export async function getUnreadMessagesCountAction(): Promise<
  ApiResponse<{ count: number }>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const count = await messagingService.getUnreadCount(dbUser.id);
    logger.debug("getUnreadMessagesCountAction", {
      userId: dbUser.id,
      clerkId: session.clerkId,
      count,
    });
    return { success: true, data: { count } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getUnreadMessagesCountAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not get unread count" },
    };
  }
}

/* ── Announcements ───────────────────────────────────────── */

export async function createAnnouncementAction(
  input: CreateAnnouncementInput,
): Promise<ApiResponse<Announcement>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = createAnnouncementSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Permission: school_admin, teacher, platform_admin can publish.
    if (
      dbUser.role !== "school_admin" &&
      dbUser.role !== "teacher" &&
      dbUser.role !== "platform_admin"
    ) {
      throw AppError.unauthorized(
        "Only school admins, teachers and platform admins can publish announcements",
      );
    }

    const created = await messagingService.createAnnouncement(
      parsed.data,
      dbUser.id,
    );
    logger.info("Announcement created", {
      announcementId: created.id,
      audience: created.audience,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/announcements");
    revalidatePath("/messages");
    return { success: true, data: created };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("createAnnouncementAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not create announcement",
      },
    };
  }
}

export async function listAnnouncementsAction(
  query?: Partial<ListAnnouncementsQuery>,
): Promise<ApiResponse<AnnouncementListResult>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = listAnnouncementsQuerySchema.safeParse({
      schoolId: query?.schoolId,
      classId: query?.classId,
      audience: query?.audience,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    });
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const result = await messagingService.listAnnouncementsForUser(
      dbUser.id,
      parsed.data,
    );
    logger.debug("listAnnouncementsAction", {
      userId: dbUser.id,
      clerkId: session.clerkId,
      count: result.items.length,
    });
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listAnnouncementsAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not list announcements",
      },
    };
  }
}

export async function listManagedAnnouncementsAction(
  query?: Partial<ListAnnouncementsQuery>,
): Promise<ApiResponse<AnnouncementListResult>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = listAnnouncementsQuerySchema.safeParse({
      schoolId: query?.schoolId,
      classId: query?.classId,
      audience: query?.audience,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    });
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const result = await messagingService.listManagedAnnouncements(
      dbUser.id,
      parsed.data,
    );
    logger.debug("listManagedAnnouncementsAction", {
      userId: dbUser.id,
      clerkId: session.clerkId,
      count: result.items.length,
    });
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listManagedAnnouncementsAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not list announcements",
      },
    };
  }
}

export async function deleteAnnouncementAction(
  id: string,
): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // Authors can delete their own; platform_admin / school_admin can delete any.
    // We don't have a getAnnouncementById service; fetch the announcement row.
    const { getDb } = await import("@/server/db");
    const { announcements } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    const rows = await db
      .select()
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1);
    const ann = rows.at(0);
    if (!ann) throw AppError.notFound("Announcement not found");

    const canDelete =
      ann.authorId === dbUser.id ||
      dbUser.role === "platform_admin" ||
      dbUser.role === "school_admin";
    if (!canDelete) {
      throw AppError.unauthorized(
        "You can only delete your own announcements or be an admin",
      );
    }

    const result = await messagingService.deleteAnnouncement(id, dbUser.id);
    logger.info("Announcement deleted", {
      announcementId: id,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/announcements");
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("deleteAnnouncementAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not delete announcement",
      },
    };
  }
}

/* ── New conversation helpers ─────────────────────────────── */

/** Public types returned by the new-conversation actions. */
export type ClassForMessaging = {
  id: string;
  name: string;
  schoolId: string;
  schoolName: string;
  level: string | null;
  memberCount: number;
};

export type ClassMemberForMessaging = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
  roleInClass: "teacher" | "student" | "admin" | "parent" | "staff";
};

export type ChildForMessaging = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
  relationship: string;
};

export type TutoringStudentForMessaging = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
};

/**
 * Get classes the current user is a member of (for student/teacher/school_admin).
 */
export async function getMyClassesForMessagingAction(): Promise<
  ApiResponse<ClassForMessaging[]>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const db = await getDb();

    // 1. Class rows where the user is a member.
    const memberRows = await db
      .select({
        classId: classMembers.classId,
        className: classes.name,
        schoolId: classes.schoolId,
        schoolName: schools.name,
        level: classes.level,
      })
      .from(classMembers)
      .innerJoin(classes, eq(classes.id, classMembers.classId))
      .leftJoin(schools, eq(schools.id, classes.schoolId))
      .where(eq(classMembers.userId, dbUser.id));

    if (memberRows.length === 0) {
      return { success: true, data: [] };
    }

    const classIds = memberRows.map((r) => r.classId);

    // 2. Member counts per class (single query grouped by class).
    const countRows = await db
      .select({
        classId: classMembers.classId,
        memberCount: count(),
      })
      .from(classMembers)
      .where(inArray(classMembers.classId, classIds))
      .groupBy(classMembers.classId);
    const countMap = new Map(
      countRows.map((r) => [r.classId, Number(r.memberCount)]),
    );

    const items: ClassForMessaging[] = memberRows.map((r) => ({
      id: r.classId,
      name: r.className,
      schoolId: r.schoolId,
      schoolName: r.schoolName ?? "",
      level: r.level,
      memberCount: countMap.get(r.classId) ?? 0,
    }));

    logger.debug("getMyClassesForMessagingAction", {
      userId: dbUser.id,
      clerkId: session.clerkId,
      count: items.length,
    });
    return { success: true, data: items };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getMyClassesForMessagingAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list classes" },
    };
  }
}

/**
 * Get members of a class (for starting a conversation).
 *
 * Permission: requester must be a member of the class, or be a school_admin
 * of the class's school, or be a platform_admin.
 */
export async function getClassMembersAction(
  classId: string,
): Promise<ApiResponse<ClassMemberForMessaging[]>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const db = await getDb();

    // Verify the class exists.
    const classRows = await db
      .select({ id: classes.id, schoolId: classes.schoolId })
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);
    const cls = classRows.at(0);
    if (!cls) throw AppError.notFound("Class not found");

    // Permission check.
    const isMember =
      dbUser.role === "platform_admin" ||
      dbUser.role === "support" ||
      (
        await db
          .select({ id: classMembers.id })
          .from(classMembers)
          .where(
            and(
              eq(classMembers.classId, classId),
              eq(classMembers.userId, dbUser.id),
            ),
          )
          .limit(1)
      ).length > 0;

    if (!isMember && dbUser.role === "school_admin" && cls.schoolId) {
      // School admins can browse members of any class in their school.
      const adminRow = await db
        .select({ id: schoolMembers.id })
        .from(schoolMembers)
        .where(
          and(
            eq(schoolMembers.schoolId, cls.schoolId),
            eq(schoolMembers.userId, dbUser.id),
            eq(schoolMembers.roleInSchool, "admin"),
            eq(schoolMembers.status, "active"),
          ),
        )
        .limit(1);
      if (adminRow.length === 0) {
        throw AppError.unauthorized(
          "You must be a member of this class or a school admin",
        );
      }
    } else if (!isMember) {
      throw AppError.unauthorized(
        "You must be a member of this class to list its members",
      );
    }

    // Fetch members.
    const memberRows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        roleInClass: classMembers.role,
      })
      .from(classMembers)
      .innerJoin(users, eq(users.id, classMembers.userId))
      .where(eq(classMembers.classId, classId));

    // Exclude the requesting user — they cannot start a conversation with themselves.
    const items: ClassMemberForMessaging[] = memberRows
      .filter((r) => r.id !== dbUser.id)
      .map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        avatarUrl: r.avatarUrl,
        roleInClass: r.roleInClass,
      }));

    logger.debug("getClassMembersAction", {
      classId,
      userId: dbUser.id,
      clerkId: session.clerkId,
      count: items.length,
    });
    return { success: true, data: items };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getClassMembersAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not list class members",
      },
    };
  }
}

/**
 * Get all classes of a school (for school_admin "All School Classes" section).
 *
 * Permission: requester must be an active admin of the school, or be a platform_admin.
 */
export async function getSchoolClassesAction(
  schoolId: string,
): Promise<ApiResponse<ClassForMessaging[]>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const db = await getDb();

    // Permission: platform_admin OR active school admin of this school.
    let canAccess =
      dbUser.role === "platform_admin" || dbUser.role === "support";
    if (!canAccess) {
      if (dbUser.role !== "school_admin") {
        throw AppError.unauthorized(
          "Only school admins can list all classes of a school",
        );
      }
      const adminRow = await db
        .select({ id: schoolMembers.id })
        .from(schoolMembers)
        .where(
          and(
            eq(schoolMembers.schoolId, schoolId),
            eq(schoolMembers.userId, dbUser.id),
            eq(schoolMembers.roleInSchool, "admin"),
            eq(schoolMembers.status, "active"),
          ),
        )
        .limit(1);
      canAccess = adminRow.length > 0;
      if (!canAccess) {
        throw AppError.unauthorized("You are not an admin of this school");
      }
    }

    const classRows = await db
      .select({
        id: classes.id,
        name: classes.name,
        schoolId: classes.schoolId,
        schoolName: schools.name,
        level: classes.level,
      })
      .from(classes)
      .leftJoin(schools, eq(schools.id, classes.schoolId))
      .where(eq(classes.schoolId, schoolId));

    if (classRows.length === 0) {
      return { success: true, data: [] };
    }

    const classIds = classRows.map((r) => r.id);
    const countRows = await db
      .select({
        classId: classMembers.classId,
        memberCount: count(),
      })
      .from(classMembers)
      .where(inArray(classMembers.classId, classIds))
      .groupBy(classMembers.classId);
    const countMap = new Map(
      countRows.map((r) => [r.classId, Number(r.memberCount)]),
    );

    const items: ClassForMessaging[] = classRows.map((r) => ({
      id: r.id,
      name: r.name,
      schoolId: r.schoolId,
      schoolName: r.schoolName ?? "",
      level: r.level,
      memberCount: countMap.get(r.id) ?? 0,
    }));

    logger.debug("getSchoolClassesAction", {
      schoolId,
      userId: dbUser.id,
      clerkId: session.clerkId,
      count: items.length,
    });
    return { success: true, data: items };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getSchoolClassesAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not list school classes",
      },
    };
  }
}

/**
 * Get children linked to the current parent user.
 */
export async function getMyChildrenAction(): Promise<
  ApiResponse<ChildForMessaging[]>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "parent" && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized("Only parents can list their children");
    }

    const db = await getDb();
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        relationship: parentStudentRelations.relationship,
      })
      .from(parentStudentRelations)
      .innerJoin(users, eq(users.id, parentStudentRelations.studentId))
      .where(eq(parentStudentRelations.parentId, dbUser.id));

    const items: ChildForMessaging[] = rows.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      avatarUrl: r.avatarUrl,
      relationship: r.relationship,
    }));

    logger.debug("getMyChildrenAction", {
      userId: dbUser.id,
      clerkId: session.clerkId,
      count: items.length,
    });
    return { success: true, data: items };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getMyChildrenAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list children" },
    };
  }
}

/**
 * Get students the current tutor has bookings with (distinct list).
 */
export async function getMyTutoringStudentsAction(): Promise<
  ApiResponse<TutoringStudentForMessaging[]>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "tutor" && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized("Only tutors can list their students");
    }

    const db = await getDb();

    // Resolve the tutor profile for this user.
    const profileRows = await db
      .select({ id: tutorProfiles.id })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.userId, dbUser.id))
      .limit(1);
    const profile = profileRows.at(0);
    if (!profile) {
      return { success: true, data: [] };
    }

    // Distinct studentIds across this tutor's bookings.
    const bookingRows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(tutorBookings)
      .innerJoin(users, eq(users.id, tutorBookings.studentId))
      .where(eq(tutorBookings.tutorProfileId, profile.id));

    // Deduplicate by student id (a tutor may have multiple bookings with the same student).
    const seen = new Set<string>();
    const items: TutoringStudentForMessaging[] = [];
    for (const r of bookingRows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      items.push({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        avatarUrl: r.avatarUrl,
      });
    }

    logger.debug("getMyTutoringStudentsAction", {
      userId: dbUser.id,
      clerkId: session.clerkId,
      count: items.length,
    });
    return { success: true, data: items };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getMyTutoringStudentsAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not list tutoring students",
      },
    };
  }
}

/**
 * Start (or find) a direct conversation with another user.
 *
 * - If a `direct` thread already exists between the two users, returns its ID.
 * - Otherwise, creates a new direct thread with both users as participants.
 * - Optional `classId` / `schoolId` provide additional scoping metadata on the
 *   created thread (e.g. for context-bound student↔teacher chats).
 *
 * Permission rules (delegated to `messagingService.createThread`):
 *  - student↔student is NOT allowed.
 *  - Allowed pairs: teacher↔student, teacher↔parent, school_admin↔parent,
 *    student↔tutor, support↔anyone, platform_admin↔anyone.
 */
export async function startConversationAction(input: {
  participantId: string;
  classId?: string;
  schoolId?: string;
}): Promise<ApiResponse<{ threadId: string }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // Basic input validation (UUID-ish, non-empty).
    if (
      !input?.participantId ||
      typeof input.participantId !== "string" ||
      input.participantId.length < 8
    ) {
      throw AppError.validation("A valid participantId is required");
    }

    const db = await getDb();

    // Cannot start a conversation with yourself.
    if (input.participantId === dbUser.id) {
      throw AppError.validation(
        "You cannot start a conversation with yourself",
      );
    }

    // Verify the target user exists.
    const targetRows = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, input.participantId))
      .limit(1);
    const target = targetRows.at(0);
    if (!target) throw AppError.notFound("Recipient not found");

    // 1. Look for an existing direct thread with both participants.
    // Strategy: fetch thread IDs where the requester is a participant AND
    // type='direct', then check whether the target is also a participant of
    // any of those threads.
    const myDirectThreadRows = await db
      .select({ threadId: conversationParticipants.threadId })
      .from(conversationParticipants)
      .innerJoin(
        conversationThreads,
        eq(conversationThreads.id, conversationParticipants.threadId),
      )
      .where(
        and(
          eq(conversationParticipants.userId, dbUser.id),
          eq(conversationThreads.type, "direct"),
        ),
      );

    if (myDirectThreadRows.length > 0) {
      const threadIds = myDirectThreadRows.map((r) => r.threadId);
      const sharedRows = await db
        .select({ threadId: conversationParticipants.threadId })
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.userId, input.participantId),
            inArray(conversationParticipants.threadId, threadIds),
          ),
        )
        .limit(1);
      const existing = sharedRows.at(0);
      if (existing) {
        logger.info("Reusing existing direct thread", {
          threadId: existing.threadId,
          userId: dbUser.id,
          participantId: input.participantId,
          clerkId: session.clerkId,
        });
        revalidatePath("/messages");
        return { success: true, data: { threadId: existing.threadId } };
      }
    }

    // 2. No existing thread — create a new direct one.
    //    Delegates pair-validation + participant creation to the messaging service.
    const created = await messagingService.createThread(
      {
        type: "direct",
        classId: input.classId,
        schoolId: input.schoolId,
        participantIds: [input.participantId],
      },
      dbUser.id,
    );

    logger.info("Started new direct conversation", {
      threadId: created.id,
      byUserId: dbUser.id,
      participantId: input.participantId,
      clerkId: session.clerkId,
    });
    revalidatePath("/messages");
    return { success: true, data: { threadId: created.id } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("startConversationAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not start conversation",
      },
    };
  }
}
