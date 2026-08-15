/**
 * §5.11 — Messaging service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 *
 * Responsibilities:
 *  - Threads (direct / group / class / school / support) CRUD + participants
 *  - Messages (send, list, read cursors)
 *  - Announcements (broadcast from school_admin / teachers)
 *
 * Security rules (§5.11):
 *  - No free student-to-student messaging by default.
 *  - Allowed pairs:
 *      teacher ↔ student
 *      teacher ↔ parent
 *      school_admin ↔ parent
 *      student ↔ tutor
 *      support ↔ anyone
 *      platform_admin ↔ anyone
 */

import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  conversationThreads,
  conversationParticipants,
  messages,
  announcements,
  users,
  schools,
  classes,
  classMembers,
  schoolMembers,
  files,
  notifications,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { publishLiveNotification } from "@/server/services/notifications";
import type {
  CreateThreadInput,
  SendMessageInput,
  ListMessagesQuery,
  ListThreadsQuery,
  CreateAnnouncementInput,
  ListAnnouncementsQuery,
} from "@/server/validators/messaging";
import type {
  ConversationThread,
  ConversationParticipant,
  Message,
  Announcement,
} from "@/server/db/schema/messaging";
import type { User } from "@/server/db/schema/users";
import type { UserRole } from "@/types";

/* -- Types --------------------------------------------------- */

export type {
  ConversationThread,
  ConversationParticipant,
  Message,
  Announcement,
};

export type UserSummary = Pick<
  User,
  "id" | "firstName" | "lastName" | "email" | "avatarUrl" | "role"
>;

export type MessageWithSender = Message & {
  sender: Pick<User, "id" | "firstName" | "lastName" | "avatarUrl">;
  attachment: {
    id: string;
    originalName: string;
    contentType: string;
    size: number;
    key: string;
    bucket: string;
  } | null;
};

export type ThreadWithRelations = ConversationThread & {
  participants: (ConversationParticipant & {
    user: Pick<User, "id" | "firstName" | "lastName" | "avatarUrl" | "role">;
  })[];
  lastMessage: MessageWithSender | null;
};

export type ThreadListItem = {
  id: string;
  type: ConversationThread["type"];
  schoolId: string | null;
  classId: string | null;
  updatedAt: Date;
  /** Other participants (excluding the requesting user) — used to render the avatar/title. */
  peers: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    role: UserRole;
  }[];
  lastMessage: {
    id: string;
    body: string;
    createdAt: Date;
    senderId: string;
  } | null;
  unreadCount: number;
  lastReadAt: Date | null;
};

export type ThreadListResult = {
  items: ThreadListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AnnouncementWithRelations = Announcement & {
  author: Pick<User, "id" | "firstName" | "lastName" | "avatarUrl">;
  school: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
};

export type AnnouncementListResult = {
  items: AnnouncementWithRelations[];
  total: number;
  page: number;
  pageSize: number;
};

/* -- Messaging rules (§5.11) -------------------------------- */

/**
 * Returns true if a direct conversation between `aRole` and `bRole` is allowed.
 * Student ↔ student is NOT allowed by default.
 */
export function isAllowedDirectPair(aRole: UserRole, bRole: UserRole): boolean {
  if (aRole === bRole && aRole === "student") return false;
  // platform_admin / support / content_moderator can talk to anyone.
  if (
    aRole === "platform_admin" ||
    bRole === "platform_admin" ||
    aRole === "support" ||
    bRole === "support"
  ) {
    return true;
  }
  const pair = [aRole, bRole].sort().join("|");
  const allowed = new Set<string>([
    "school_admin|parent",
    "student|teacher",
    "student|tutor",
    "teacher|parent",
  ]);
  return allowed.has(pair);
}

/* -- Threads ------------------------------------------------ */

/**
 * Find an existing direct ("direct" type) thread between two users.
 * Returns the thread id, or null if no such thread exists yet.
 *
 * Used by `startConversationAction` so we don't spawn duplicate 1-on-1
 * threads between the same two users.
 */
export async function findDirectThread(
  userA: string,
  userB: string,
): Promise<string | null> {
  const db = await getDb();

  // Threads where userA is a participant.
  const aRows = await db
    .select({ threadId: conversationParticipants.threadId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userA));

  if (aRows.length === 0) return null;

  // Among those, threads where userB is also a participant.
  const bRows = await db
    .select({ threadId: conversationParticipants.threadId })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.userId, userB),
        inArray(
          conversationParticipants.threadId,
          aRows.map((r) => r.threadId),
        ),
      ),
    );
  if (bRows.length === 0) return null;

  // Restrict to "direct" threads and pick the first.
  const directRows = await db
    .select({ id: conversationThreads.id })
    .from(conversationThreads)
    .where(
      and(
        eq(conversationThreads.type, "direct"),
        inArray(
          conversationThreads.id,
          bRows.map((r) => r.threadId),
        ),
      ),
    )
    .limit(1);

  return directRows.at(0)?.id ?? null;
}

/**
 * Create a new conversation thread + add the creator + participants.
 * Returns the created thread (with participants).
 */
export async function createThread(
  input: CreateThreadInput,
  creatorUserId: string,
): Promise<ThreadWithRelations> {
  const db = await getDb();

  const allIds = Array.from(new Set([creatorUserId, ...input.participantIds]));
  const userRows = await db
    .select({
      id: users.id,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, allIds));
  if (userRows.length !== allIds.length) {
    throw AppError.validation("One or more participants do not exist");
  }

  const roleById = new Map(userRows.map((u) => [u.id, u.role as UserRole]));
  const creatorRole = roleById.get(creatorUserId);

  // For direct threads, validate the pair is allowed.
  if (input.type === "direct" && allIds.length === 2) {
    const otherId = allIds.find((id) => id !== creatorUserId);
    const otherRole = otherId ? roleById.get(otherId) : undefined;
    if (
      creatorRole &&
      otherRole &&
      !isAllowedDirectPair(creatorRole, otherRole)
    ) {
      throw AppError.unauthorized(
        "This conversation is not allowed by the messaging policy",
      );
    }
  }

  const [created] = await db
    .insert(conversationThreads)
    .values({
      type: input.type,
      schoolId: input.schoolId ?? null,
      classId: input.classId ?? null,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create thread");

  const participantRows = allIds.map((uid) => ({
    threadId: created.id,
    userId: uid,
    // creator starts with lastReadAt = now (no unread for themselves).
    lastReadAt: uid === creatorUserId ? new Date() : null,
  }));
  await db.insert(conversationParticipants).values(participantRows);

  return getThreadById(created.id);
}

/**
 * Returns a thread with its participants + last message.
 */
export async function getThreadById(id: string): Promise<ThreadWithRelations> {
  const db = await getDb();

  const threadRows = await db
    .select()
    .from(conversationThreads)
    .where(eq(conversationThreads.id, id))
    .limit(1);
  const thread = threadRows.at(0);
  if (!thread) throw AppError.notFound("Thread not found");

  const participantRows = await db
    .select({
      participant: conversationParticipants,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
        role: users.role,
      },
    })
    .from(conversationParticipants)
    .innerJoin(users, eq(users.id, conversationParticipants.userId))
    .where(eq(conversationParticipants.threadId, id));

  const lastMessageRows = await db
    .select({
      message: messages,
      sender: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      },
      attachment: {
        id: files.id,
        originalName: files.originalName,
        contentType: files.contentType,
        size: files.size,
        key: files.key,
        bucket: files.bucket,
      },
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.senderId))
    .leftJoin(files, eq(files.id, messages.attachmentFileId))
    .where(eq(messages.threadId, id))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  const lastMessage = lastMessageRows.at(0);

  return {
    ...thread,
    participants: participantRows.map((r) => ({
      ...r.participant,
      user: r.user,
    })),
    lastMessage: lastMessage
      ? {
          ...lastMessage.message,
          sender: lastMessage.sender!,
          attachment: lastMessage.attachment?.id
            ? lastMessage.attachment
            : null,
        }
      : null,
  };
}

/**
 * Returns true if `userId` is a participant of the given thread.
 */
export async function isThreadParticipant(
  threadId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.threadId, threadId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Lists threads the user is a participant of, with their last message + unread count.
 */
export async function listUserThreads(
  userId: string,
  query: ListThreadsQuery,
): Promise<ThreadListResult> {
  const db = await getDb();

  // 1. Total count of threads for this user.
  const totalRow = await db
    .select({ c: count() })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));
  const total = totalRow.at(0)?.c ?? 0;

  // 2. Thread ids the user participates in, paginated by thread.updatedAt desc.
  const participantRows = await db
    .select({
      threadId: conversationParticipants.threadId,
      lastReadAt: conversationParticipants.lastReadAt,
      threadUpdatedAt: conversationThreads.updatedAt,
      threadType: conversationThreads.type,
      threadSchoolId: conversationThreads.schoolId,
      threadClassId: conversationThreads.classId,
    })
    .from(conversationParticipants)
    .innerJoin(
      conversationThreads,
      eq(conversationThreads.id, conversationParticipants.threadId),
    )
    .where(eq(conversationParticipants.userId, userId))
    .orderBy(desc(conversationThreads.updatedAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  if (participantRows.length === 0) {
    return {
      items: [],
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  const threadIds = participantRows.map((r) => r.threadId);

  // 3. Peers (other participants).
  const peerRows = await db
    .select({
      threadId: conversationParticipants.threadId,
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(conversationParticipants)
    .innerJoin(users, eq(users.id, conversationParticipants.userId))
    .where(inArray(conversationParticipants.threadId, threadIds));

  // 4. Last message per thread.
  const lastMessageRows = await db
    .select({
      threadId: messages.threadId,
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
    })
    .from(messages)
    .where(inArray(messages.threadId, threadIds))
    .orderBy(desc(messages.createdAt));

  const lastByThread = new Map<string, (typeof lastMessageRows)[number]>();
  for (const row of lastMessageRows) {
    if (!lastByThread.has(row.threadId)) {
      lastByThread.set(row.threadId, row);
    }
  }

  // 5. Unread counts (one query per thread; threads are typically few).
  const unreadPromises = participantRows.map(async (p) => {
    const cond = p.lastReadAt
      ? and(
          eq(messages.threadId, p.threadId),
          gt(messages.createdAt, p.lastReadAt),
          ne(messages.senderId, userId),
        )
      : and(eq(messages.threadId, p.threadId), ne(messages.senderId, userId));
    const r = await db.select({ c: count() }).from(messages).where(cond);
    return [p.threadId, r.at(0)?.c ?? 0] as const;
  });
  const unreadResults = await Promise.all(unreadPromises);
  const unreadMap = new Map(unreadResults);

  const items: ThreadListItem[] = participantRows.map((p) => {
    const peers = peerRows
      .filter((r) => r.threadId === p.threadId && r.userId !== userId)
      .map((r) => ({
        id: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        avatarUrl: r.avatarUrl,
        role: r.role as UserRole,
      }));
    const last = lastByThread.get(p.threadId);
    return {
      id: p.threadId,
      type: p.threadType,
      schoolId: p.threadSchoolId,
      classId: p.threadClassId,
      updatedAt: p.threadUpdatedAt,
      peers,
      lastMessage: last
        ? {
            id: last.id,
            body: last.body,
            createdAt: last.createdAt,
            senderId: last.senderId,
          }
        : null,
      unreadCount: unreadMap.get(p.threadId) ?? 0,
      lastReadAt: p.lastReadAt,
    };
  });

  return { items, total, page: query.page, pageSize: query.pageSize };
}

/* -- Participants ------------------------------------------- */

export async function addParticipant(
  threadId: string,
  userId: string,
): Promise<{ added: boolean }> {
  const db = await getDb();

  const threadRows = await db
    .select({ id: conversationThreads.id, type: conversationThreads.type })
    .from(conversationThreads)
    .where(eq(conversationThreads.id, threadId))
    .limit(1);
  if (threadRows.length === 0) {
    throw AppError.notFound("Thread not found");
  }

  const existing = await db
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.threadId, threadId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  if (existing.length > 0) return { added: false };

  await db.insert(conversationParticipants).values({
    threadId,
    userId,
    lastReadAt: null,
  });

  return { added: true };
}

export async function removeParticipant(
  threadId: string,
  userId: string,
): Promise<{ removed: boolean }> {
  const db = await getDb();
  await db
    .delete(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.threadId, threadId),
        eq(conversationParticipants.userId, userId),
      ),
    );
  return { removed: true };
}

/* -- Messages ----------------------------------------------- */

/**
 * Send a message in a thread + notify all other participants.
 * Caller must ensure `senderId` is a participant.
 */
export async function sendMessage(
  input: SendMessageInput,
  senderId: string,
): Promise<MessageWithSender> {
  const db = await getDb();

  if (input.attachmentFileId) {
    const fileRow = await db
      .select({ id: files.id })
      .from(files)
      .where(eq(files.id, input.attachmentFileId))
      .limit(1);
    if (fileRow.length === 0) {
      throw AppError.validation("Attachment file not found");
    }
  }

  const [created] = await db
    .insert(messages)
    .values({
      threadId: input.threadId,
      senderId,
      body: input.body,
      attachmentFileId: input.attachmentFileId ?? null,
      status: "sent",
    })
    .returning();
  if (!created) throw AppError.internal("Failed to send message");

  // Bump thread.updatedAt so the thread reorders in the list.
  await db
    .update(conversationThreads)
    .set({ updatedAt: new Date() })
    .where(eq(conversationThreads.id, input.threadId));

  // Notify other participants (in-app notification).
  try {
    const participants = await db
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.threadId, input.threadId),
          ne(conversationParticipants.userId, senderId),
        ),
      );
    const senderRow = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, senderId))
      .limit(1);
    const sender = senderRow.at(0);
    const senderName =
      ([sender?.firstName, sender?.lastName].filter(Boolean).join(" ") ||
        sender?.id.slice(0, 6)) ??
      "Quelqu'un";

    const notifValues = participants.map((p) => ({
      userId: p.userId,
      type: "social" as const,
      title: `Nouveau message de ${senderName}`,
      body: input.body.slice(0, 180),
      link: `/messages/${input.threadId}`,
      metadata: { threadId: input.threadId, messageId: created.id },
    }));
    if (notifValues.length > 0) {
      await db.insert(notifications).values(notifValues);
    }
    // Push live SSE events for the participants (best-effort).
    for (const p of participants) {
      notifyLive(p.userId, {
        id: created.id,
        userId: p.userId,
        type: "social",
        title: `Nouveau message de ${senderName}`,
        body: input.body.slice(0, 180),
        link: `/messages/${input.threadId}`,
        metadata: { threadId: input.threadId, messageId: created.id },
        readAt: null,
        createdAt: created.createdAt,
      }).catch(() => {
        /* swallow — SSE is best-effort */
      });
    }
  } catch (err) {
    logger.warn("sendMessage: failed to enqueue notifications", {
      error: String(err),
    });
  }

  // Build the response shape with sender + attachment.
  const senderInfo = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, senderId))
    .limit(1)
    .then((r) => r.at(0)!);

  const attachment = input.attachmentFileId
    ? await db
        .select({
          id: files.id,
          originalName: files.originalName,
          contentType: files.contentType,
          size: files.size,
          key: files.key,
          bucket: files.bucket,
        })
        .from(files)
        .where(eq(files.id, input.attachmentFileId))
        .limit(1)
        .then((r) => r.at(0) ?? null)
    : null;

  return {
    ...created,
    sender: senderInfo,
    attachment,
  };
}

/**
 * List messages in a thread (newest first or paginated by `before` cursor).
 */
export async function listMessages(
  query: ListMessagesQuery,
): Promise<{ items: MessageWithSender[]; hasMore: boolean }> {
  const db = await getDb();

  const beforeDate = query.before ? new Date(query.before) : undefined;
  const cond = beforeDate
    ? and(
        eq(messages.threadId, query.threadId),
        lt(messages.createdAt, beforeDate),
      )
    : eq(messages.threadId, query.threadId);

  const rows = await db
    .select({
      message: messages,
      sender: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      },
      attachment: {
        id: files.id,
        originalName: files.originalName,
        contentType: files.contentType,
        size: files.size,
        key: files.key,
        bucket: files.bucket,
      },
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.senderId))
    .leftJoin(files, eq(files.id, messages.attachmentFileId))
    .where(cond)
    .orderBy(desc(messages.createdAt))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const sliced = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    items: sliced.map((r) => ({
      ...r.message,
      sender: r.sender!,
      attachment: r.attachment?.id ? r.attachment : null,
    })),
    hasMore,
  };
}

/**
 * Mark all messages in the thread as read for `userId` (sets lastReadAt = now).
 */
export async function markThreadAsRead(
  threadId: string,
  userId: string,
): Promise<{ marked: boolean }> {
  const db = await getDb();
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipants.threadId, threadId),
        eq(conversationParticipants.userId, userId),
      ),
    );
  return { marked: true };
}

/**
 * Total unread messages across all threads for the user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({
      lastReadAt: conversationParticipants.lastReadAt,
      threadId: conversationParticipants.threadId,
    })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));

  if (rows.length === 0) return 0;

  const conds = rows.map((r) =>
    r.lastReadAt
      ? and(
          eq(messages.threadId, r.threadId),
          gt(messages.createdAt, r.lastReadAt),
          ne(messages.senderId, userId),
        )
      : and(eq(messages.threadId, r.threadId), ne(messages.senderId, userId)),
  );
  const totalRow = await db
    .select({ c: count() })
    .from(messages)
    .where(or(...conds));
  return totalRow.at(0)?.c ?? 0;
}

/* -- Announcements ----------------------------------------- */

/**
 * Create + (optionally) publish an announcement.
 */
export async function createAnnouncement(
  input: CreateAnnouncementInput,
  authorId: string,
): Promise<Announcement> {
  const db = await getDb();

  const [created] = await db
    .insert(announcements)
    .values({
      schoolId: input.schoolId ?? null,
      classId: input.classId ?? null,
      authorId,
      title: input.title,
      body: input.body,
      audience: input.audience,
      publishedAt: input.publish ? new Date() : null,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create announcement");

  // Notify members of the school / class about the announcement (best-effort).
  try {
    let recipientIds: string[] = [];
    if (input.classId) {
      const members = await db
        .select({ userId: classMembers.userId })
        .from(classMembers)
        .where(eq(classMembers.classId, input.classId));
      recipientIds = members.map((m) => m.userId);
    } else if (input.schoolId) {
      const members = await db
        .select({ userId: schoolMembers.userId })
        .from(schoolMembers)
        .where(
          and(
            eq(schoolMembers.schoolId, input.schoolId),
            eq(schoolMembers.status, "active"),
          ),
        );
      recipientIds = members.map((m) => m.userId);
    }
    recipientIds = recipientIds.filter((id) => id !== authorId);

    const notifValues = recipientIds.map((uid) => ({
      userId: uid,
      type: "announcement" as const,
      title: input.title,
      body: input.body.slice(0, 180),
      link: input.classId ? `/classes/${input.classId}` : "/messages",
      metadata: {
        announcementId: created.id,
        audience: input.audience,
        schoolId: input.schoolId,
        classId: input.classId,
      },
    }));
    if (notifValues.length > 0) {
      await db.insert(notifications).values(notifValues);
      for (const n of notifValues) {
        notifyLive(n.userId, {
          id: crypto.randomUUID(),
          userId: n.userId,
          type: "announcement",
          title: n.title,
          body: n.body ?? null,
          link: n.link ?? null,
          metadata: n.metadata ?? null,
          readAt: null,
          createdAt: created.createdAt,
        }).catch(() => {
          /* swallow */
        });
      }
    }
  } catch (err) {
    logger.warn("createAnnouncement: failed to enqueue notifications", {
      error: String(err),
    });
  }

  return created;
}

/**
 * Returns announcements visible to the given user.
 *
 * Visibility rules:
 *  - audience=public → anyone
 *  - audience=school → user must be a member of the school
 *  - audience=class → user must be a member of the class
 *  - audience=teachers/students/parents → user must be a member of the school
 *    (the action layer further filters by role if desired).
 */
export async function listAnnouncementsForUser(
  userId: string,
  query: ListAnnouncementsQuery,
): Promise<AnnouncementListResult> {
  const db = await getDb();

  // Build the list of school / class memberships the user has.
  const schoolRows = await db
    .select({ schoolId: schoolMembers.schoolId })
    .from(schoolMembers)
    .where(
      and(eq(schoolMembers.userId, userId), eq(schoolMembers.status, "active")),
    );
  const schoolIds = schoolRows.map((r) => r.schoolId);

  const classRows = await db
    .select({ classId: classMembers.classId })
    .from(classMembers)
    .where(eq(classMembers.userId, userId));
  const classIds = classRows.map((r) => r.classId);

  // Compose the visibility WHERE clause.
  const visibleParts: ReturnType<typeof eq>[] = [
    eq(announcements.audience, "public") as unknown as ReturnType<typeof eq>,
  ];
  if (schoolIds.length > 0) {
    visibleParts.push(
      and(
        inArray(announcements.audience, [
          "school",
          "teachers",
          "students",
          "parents",
        ]),
        inArray(announcements.schoolId, schoolIds),
      ) as unknown as ReturnType<typeof eq>,
    );
  }
  if (classIds.length > 0) {
    visibleParts.push(
      and(
        eq(announcements.audience, "class"),
        inArray(announcements.classId, classIds),
      ) as unknown as ReturnType<typeof eq>,
    );
  }
  const visibility = and(
    sql`${announcements.publishedAt} IS NOT NULL`,
    or(...visibleParts),
  );

  const filterConds = [
    visibility,
    query.schoolId ? eq(announcements.schoolId, query.schoolId) : undefined,
    query.classId ? eq(announcements.classId, query.classId) : undefined,
    query.audience ? eq(announcements.audience, query.audience) : undefined,
  ];

  const rows = await db
    .select({
      announcement: announcements,
      author: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      },
      school: {
        id: schools.id,
        name: schools.name,
      },
      class: {
        id: classes.id,
        name: classes.name,
      },
    })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.authorId))
    .leftJoin(schools, eq(schools.id, announcements.schoolId))
    .leftJoin(classes, eq(classes.id, announcements.classId))
    .where(and(...(filterConds.filter(Boolean) as ReturnType<typeof eq>[])))
    .orderBy(desc(announcements.publishedAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const totalRow = await db
    .select({ c: count() })
    .from(announcements)
    .where(and(...(filterConds.filter(Boolean) as ReturnType<typeof eq>[])));

  return {
    items: rows.map((r) => ({
      ...r.announcement,
      author: r.author!,
      school: r.school,
      class: r.class,
    })),
    total: totalRow.at(0)?.c ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Lists announcements authored by the given user (managed list).
 */
export async function listManagedAnnouncements(
  userId: string,
  query: ListAnnouncementsQuery,
): Promise<AnnouncementListResult> {
  const db = await getDb();
  const filterConds = [
    eq(announcements.authorId, userId),
    query.schoolId ? eq(announcements.schoolId, query.schoolId) : undefined,
    query.classId ? eq(announcements.classId, query.classId) : undefined,
    query.audience ? eq(announcements.audience, query.audience) : undefined,
  ];

  const rows = await db
    .select({
      announcement: announcements,
      author: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      },
      school: {
        id: schools.id,
        name: schools.name,
      },
      class: {
        id: classes.id,
        name: classes.name,
      },
    })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.authorId))
    .leftJoin(schools, eq(schools.id, announcements.schoolId))
    .leftJoin(classes, eq(classes.id, announcements.classId))
    .where(and(...(filterConds.filter(Boolean) as ReturnType<typeof eq>[])))
    .orderBy(desc(announcements.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const totalRow = await db
    .select({ c: count() })
    .from(announcements)
    .where(eq(announcements.authorId, userId));

  return {
    items: rows.map((r) => ({
      ...r.announcement,
      author: r.author!,
      school: r.school,
      class: r.class,
    })),
    total: totalRow.at(0)?.c ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Soft delete an announcement (only author or platform_admin/school_admin).
 */
export async function deleteAnnouncement(
  id: string,
  _userId: string,
): Promise<{ deleted: boolean }> {
  const db = await getDb();
  await db.delete(announcements).where(eq(announcements.id, id));
  return { deleted: true };
}

/* -- Live SSE relay (delegates to notifications service for shared pub/sub) -- */

export type LiveNotificationPayload = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * Push a live notification to all subscribers for the user.
 * Delegates to notifications.publishLiveNotification.
 */
async function notifyLive(
  userId: string,
  n: LiveNotificationPayload,
): Promise<void> {
  await publishLiveNotification(userId, n);
}
