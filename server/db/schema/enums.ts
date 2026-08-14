/**
 * §10.2 — Enums.
 *
 * For Neon (PostgreSQL) we use real `pgEnum` types. For Bun SQLite we use the
 * `text({ enum: [...] })` shorthand so values are validated on insert and the
 * inferred TS type is the union (matching the pg enum behaviour).
 *
 * Both pg enums and the TS const arrays are exported so other schema files can
 * reference either depending on the dialect.
 */

import { pgEnum } from "drizzle-orm/pg-core";

/* ── onboarding_status ──────────────────────────────────────────────── */
export const ONBOARDING_STATUS = [
  "not_started",
  "role_selected",
  "profile_completed",
  "completed",
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUS)[number];
export const onboardingStatusEnum = pgEnum("onboarding_status", [
  ...ONBOARDING_STATUS,
]);

/* ── gender ──────────────────────────────────────────────── */
export const GENDER_VALUES = ["male", "female"] as const;
export type UserGender = (typeof GENDER_VALUES)[number];
export const userGenderEnum = pgEnum("user_gender", [...GENDER_VALUES]);

/* ── user_role ──────────────────────────────────────────────── */
export const USER_ROLE_VALUES = [
  "student",
  "teacher",
  "school_admin",
  "parent",
  "tutor",
  "platform_admin",
  "content_moderator",
  "support",
] as const;
export type UserRoleValue = (typeof USER_ROLE_VALUES)[number];
export const userRoleEnum = pgEnum("user_role", [...USER_ROLE_VALUES]);

/* ── level ───────────────────────────────────────────────────── */
export const LEVEL_VALUES = [
  "6e",
  "5e",
  "4e",
  "3e",
  "2nde",
  "1ere",
  "Tle",
] as const;
export type LevelValue = (typeof LEVEL_VALUES)[number];
export const levelEnum = pgEnum("level", [...LEVEL_VALUES]);

/* ── series ──────────────────────────────────────────────────── */
export const SERIES_VALUES = ["A", "B", "C", "D", "E", "F", "G", "TI"] as const;
export type SeriesValue = (typeof SERIES_VALUES)[number];
export const seriesEnum = pgEnum("series", [...SERIES_VALUES]);

/* ── content_type ────────────────────────────────────────────── */
export const CONTENT_TYPE_VALUES = [
  "epreuve",
  "corrige",
  "resume",
  "fiche",
  "video",
  "exercice",
  "devoir_modele",
  "sujet_blanc",
] as const;
export type ContentTypeValue = (typeof CONTENT_TYPE_VALUES)[number];
export const contentTypeEnum = pgEnum("content_type", [...CONTENT_TYPE_VALUES]);

/* ── content_visibility ─────────────────────────────────────── */
export const CONTENT_VISIBILITY_VALUES = [
  "public",
  "school_private",
  "class_private",
  "unlisted",
  "draft",
  "archived",
] as const;
export type ContentVisibilityValue = (typeof CONTENT_VISIBILITY_VALUES)[number];
export const contentVisibilityEnum = pgEnum("content_visibility", [
  ...CONTENT_VISIBILITY_VALUES,
]);

/* ── subscription_status ─────────────────────────────────────── */
export const SUBSCRIPTION_STATUS_VALUES = [
  "free",
  "active",
  "past_due",
  "expired",
  "cancelled",
] as const;
export type SubscriptionStatusValue =
  (typeof SUBSCRIPTION_STATUS_VALUES)[number];
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  ...SUBSCRIPTION_STATUS_VALUES,
]);

/* ── assignment_status ───────────────────────────────────────── */
export const ASSIGNMENT_STATUS_VALUES = [
  "draft",
  "scheduled",
  "published",
  "closed",
  "archived",
] as const;
export type AssignmentStatusValue = (typeof ASSIGNMENT_STATUS_VALUES)[number];
export const assignmentStatusEnum = pgEnum("assignment_status", [
  ...ASSIGNMENT_STATUS_VALUES,
]);

/* ── submission_status ───────────────────────────────────────── */
export const SUBMISSION_STATUS_VALUES = [
  "not_started",
  "submitted",
  "late",
  "graded",
  "returned",
] as const;
export type SubmissionStatusValue = (typeof SUBMISSION_STATUS_VALUES)[number];
export const submissionStatusEnum = pgEnum("submission_status", [
  ...SUBMISSION_STATUS_VALUES,
]);

/* ── attendance_status ───────────────────────────────────────── */
export const ATTENDANCE_STATUS_VALUES = [
  "present",
  "absent",
  "late",
  "excused",
] as const;
export type AttendanceStatusValue = (typeof ATTENDANCE_STATUS_VALUES)[number];
export const attendanceStatusEnum = pgEnum("attendance_status", [
  ...ATTENDANCE_STATUS_VALUES,
]);

/* ── competition_scope ───────────────────────────────────────── */
export const COMPETITION_SCOPE_VALUES = [
  "class",
  "school",
  "regional",
  "national",
] as const;
export type CompetitionScopeValue = (typeof COMPETITION_SCOPE_VALUES)[number];
export const competitionScopeEnum = pgEnum("competition_scope", [
  ...COMPETITION_SCOPE_VALUES,
]);

/* ── Member statuses (school_members, school_member_status) ── */
export const MEMBER_STATUS_VALUES = ["pending", "active", "revoked"] as const;
export type MemberStatusValue = (typeof MEMBER_STATUS_VALUES)[number];
export const memberStatusEnum = pgEnum("member_status", [
  ...MEMBER_STATUS_VALUES,
]);

/* ── Role-in-school (used by school_members & class_members) ─ */
export const ROLE_IN_SCHOOL_VALUES = [
  "admin",
  "teacher",
  "student",
  "parent",
  "staff",
] as const;
export type RoleInSchoolValue = (typeof ROLE_IN_SCHOOL_VALUES)[number];
export const roleInSchoolEnum = pgEnum("role_in_school", [
  ...ROLE_IN_SCHOOL_VALUES,
]);

/* ── School type (public / private / etc.) ──────────────────── */
export const SCHOOL_TYPE_VALUES = [
  "public",
  "private",
  "parochial",
  "other",
] as const;
export type SchoolTypeValue = (typeof SCHOOL_TYPE_VALUES)[number];
export const schoolTypeEnum = pgEnum("school_type", [...SCHOOL_TYPE_VALUES]);

/* ── File status ────────────────────────────────────────────── */
export const FILE_STATUS_VALUES = [
  "pending",
  "uploaded",
  "processing",
  "ready",
  "failed",
  "deleted",
] as const;
export type FileStatusValue = (typeof FILE_STATUS_VALUES)[number];
export const fileStatusEnum = pgEnum("file_status", [...FILE_STATUS_VALUES]);

/* ── Content publication_status ─────────────────────────────── */
export const PUBLICATION_STATUS_VALUES = [
  "draft",
  "in_review",
  "published",
  "rejected",
  "archived",
] as const;
export type PublicationStatusValue = (typeof PUBLICATION_STATUS_VALUES)[number];
export const publicationStatusEnum = pgEnum("publication_status", [
  ...PUBLICATION_STATUS_VALUES,
]);

/* ── Content report status ──────────────────────────────────── */
export const REPORT_STATUS_VALUES = [
  "open",
  "in_review",
  "resolved",
  "dismissed",
] as const;
export type ReportStatusValue = (typeof REPORT_STATUS_VALUES)[number];
export const reportStatusEnum = pgEnum("report_status", [
  ...REPORT_STATUS_VALUES,
]);

/* ── Assignment item type ───────────────────────────────────── */
export const ASSIGNMENT_ITEM_TYPE_VALUES = [
  "content",
  "url",
  "quiz",
  "text",
] as const;
export type AssignmentItemTypeValue =
  (typeof ASSIGNMENT_ITEM_TYPE_VALUES)[number];
export const assignmentItemTypeEnum = pgEnum("assignment_item_type", [
  ...ASSIGNMENT_ITEM_TYPE_VALUES,
]);

/* ── Grade period (term/semester) ───────────────────────────── */
export const GRADE_PERIOD_VALUES = [
  "T1",
  "T2",
  "T3",
  "S1",
  "S2",
  "annual",
] as const;
export type GradePeriodValue = (typeof GRADE_PERIOD_VALUES)[number];
export const gradePeriodEnum = pgEnum("grade_period", [...GRADE_PERIOD_VALUES]);

/* ── Quiz type ──────────────────────────────────────────────── */
export const QUIZ_TYPE_VALUES = [
  "practice",
  "exam",
  "homework",
  "diagnostic",
] as const;
export type QuizTypeValue = (typeof QUIZ_TYPE_VALUES)[number];
export const quizTypeEnum = pgEnum("quiz_type", [...QUIZ_TYPE_VALUES]);

/* ── Quiz question type ─────────────────────────────────────── */
export const QUIZ_QUESTION_TYPE_VALUES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "short_answer",
  "essay",
] as const;
export type QuizQuestionTypeValue = (typeof QUIZ_QUESTION_TYPE_VALUES)[number];
export const quizQuestionTypeEnum = pgEnum("quiz_question_type", [
  ...QUIZ_QUESTION_TYPE_VALUES,
]);

/* ── Quiz session status ────────────────────────────────────── */
export const QUIZ_SESSION_STATUS_VALUES = [
  "in_progress",
  "completed",
  "abandoned",
  "expired",
] as const;
export type QuizSessionStatusValue =
  (typeof QUIZ_SESSION_STATUS_VALUES)[number];
export const quizSessionStatusEnum = pgEnum("quiz_session_status", [
  ...QUIZ_SESSION_STATUS_VALUES,
]);

/* ── Difficulty ─────────────────────────────────────────────── */
export const DIFFICULTY_VALUES = ["easy", "medium", "hard", "expert"] as const;
export type DifficultyValue = (typeof DIFFICULTY_VALUES)[number];
export const difficultyEnum = pgEnum("difficulty", [...DIFFICULTY_VALUES]);

/* ── Competition status ─────────────────────────────────────── */
export const COMPETITION_STATUS_VALUES = [
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
] as const;
export type CompetitionStatusValue = (typeof COMPETITION_STATUS_VALUES)[number];
export const competitionStatusEnum = pgEnum("competition_status", [
  ...COMPETITION_STATUS_VALUES,
]);

/* ── Notification type ──────────────────────────────────────── */
export const NOTIFICATION_TYPE_VALUES = [
  "info",
  "assignment",
  "grade",
  "announcement",
  "social",
  "reminder",
  "system",
] as const;
export type NotificationTypeValue = (typeof NOTIFICATION_TYPE_VALUES)[number];
export const notificationTypeEnum = pgEnum("notification_type", [
  ...NOTIFICATION_TYPE_VALUES,
]);

/* ── Conversation thread type ────────────────────────────────── */
export const THREAD_TYPE_VALUES = [
  "direct",
  "group",
  "class",
  "school",
  "support",
] as const;
export type ThreadTypeValue = (typeof THREAD_TYPE_VALUES)[number];
export const threadTypeEnum = pgEnum("thread_type", [...THREAD_TYPE_VALUES]);

/* ── Message status ─────────────────────────────────────────── */
export const MESSAGE_STATUS_VALUES = ["sent", "delivered", "read"] as const;
export type MessageStatusValue = (typeof MESSAGE_STATUS_VALUES)[number];
export const messageStatusEnum = pgEnum("message_status", [
  ...MESSAGE_STATUS_VALUES,
]);

/* ── Announcement audience ───────────────────────────────────── */
export const AUDIENCE_VALUES = [
  "school",
  "class",
  "teachers",
  "students",
  "parents",
  "public",
] as const;
export type AudienceValue = (typeof AUDIENCE_VALUES)[number];
export const audienceEnum = pgEnum("audience", [...AUDIENCE_VALUES]);

/* ── Payment provider ────────────────────────────────────────── */
export const PAYMENT_PROVIDER_VALUES = [
  "stripe",
  "orange_money",
  "mtn_money",
  "wave",
  "flutterwave",
] as const;
export type PaymentProviderValue = (typeof PAYMENT_PROVIDER_VALUES)[number];
export const paymentProviderEnum = pgEnum("payment_provider", [
  ...PAYMENT_PROVIDER_VALUES,
]);

/* ── Payment status ─────────────────────────────────────────── */
export const PAYMENT_STATUS_VALUES = [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "disputed",
] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUS_VALUES)[number];
export const paymentStatusEnum = pgEnum("payment_status", [
  ...PAYMENT_STATUS_VALUES,
]);

/* ── Invoice status ─────────────────────────────────────────── */
export const INVOICE_STATUS_VALUES = [
  "draft",
  "issued",
  "paid",
  "void",
  "overdue",
] as const;
export type InvoiceStatusValue = (typeof INVOICE_STATUS_VALUES)[number];
export const invoiceStatusEnum = pgEnum("invoice_status", [
  ...INVOICE_STATUS_VALUES,
]);

/* ── Subscription plan ──────────────────────────────────────── */
export const PLAN_TYPE_VALUES = [
  "free",
  "essential",
  "premium",
  "institution",
] as const;
export type PlanTypeValue = (typeof PLAN_TYPE_VALUES)[number];
export const planTypeEnum = pgEnum("plan_type", [...PLAN_TYPE_VALUES]);

/* ── Tutor booking status ───────────────────────────────────── */
export const TUTOR_BOOKING_STATUS_VALUES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type TutorBookingStatusValue =
  (typeof TUTOR_BOOKING_STATUS_VALUES)[number];
export const tutorBookingStatusEnum = pgEnum("tutor_booking_status", [
  ...TUTOR_BOOKING_STATUS_VALUES,
]);

/* ── User goal type ─────────────────────────────────────────── */
export const GOAL_TYPE_VALUES = [
  "xp",
  "streak",
  "contents_viewed",
  "quizzes_passed",
  "submissions_on_time",
] as const;
export type GoalTypeValue = (typeof GOAL_TYPE_VALUES)[number];
export const goalTypeEnum = pgEnum("goal_type", [...GOAL_TYPE_VALUES]);

/* ── Goal period ────────────────────────────────────────────── */
export const GOAL_PERIOD_VALUES = [
  "daily",
  "weekly",
  "monthly",
  "term",
] as const;
export type GoalPeriodValue = (typeof GOAL_PERIOD_VALUES)[number];
export const goalPeriodEnum = pgEnum("goal_period", [...GOAL_PERIOD_VALUES]);

/* ── Goal status ────────────────────────────────────────────── */
export const GOAL_STATUS_VALUES = [
  "active",
  "completed",
  "missed",
  "cancelled",
] as const;
export type GoalStatusValue = (typeof GOAL_STATUS_VALUES)[number];
export const goalStatusEnum = pgEnum("goal_status", [...GOAL_STATUS_VALUES]);

/* ── Activity type ──────────────────────────────────────────── */
export const ACTIVITY_TYPE_VALUES = [
  "view_content",
  "download_content",
  "submit_assignment",
  "complete_quiz",
  "earn_badge",
  "join_class",
  "post_message",
  "rate_content",
] as const;
export type ActivityTypeValue = (typeof ACTIVITY_TYPE_VALUES)[number];
export const activityTypeEnum = pgEnum("activity_type", [
  ...ACTIVITY_TYPE_VALUES,
]);

/* ── Invitation status (in-app invitations) ──────────────────── */
export const INVITATION_STATUS_VALUES = [
  "pending",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
] as const;
export type InvitationStatusValue = (typeof INVITATION_STATUS_VALUES)[number];
export const invitationStatusEnum = pgEnum("invitation_status", [
  ...INVITATION_STATUS_VALUES,
]);

/* ── Join request status (request-to-join workflow) ─────────── */
export const JOIN_REQUEST_STATUS_VALUES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type JoinRequestStatusValue =
  (typeof JOIN_REQUEST_STATUS_VALUES)[number];
export const joinRequestStatusEnum = pgEnum("join_request_status", [
  ...JOIN_REQUEST_STATUS_VALUES,
]);

/* ── Invitation/Request target type (school vs class) ───────── */
export const INVITATION_TARGET_VALUES = ["school", "class"] as const;
export type InvitationTargetValue = (typeof INVITATION_TARGET_VALUES)[number];
export const invitationTargetEnum = pgEnum("invitation_target", [
  ...INVITATION_TARGET_VALUES,
]);

/* ── Question source (verified by teacher vs generated by AI) ── */
export const QUESTION_SOURCE_VALUES = ["verified", "generated"] as const;
export type QuestionSourceValue = (typeof QUESTION_SOURCE_VALUES)[number];
export const questionSourceEnum = pgEnum("question_source", [
  ...QUESTION_SOURCE_VALUES,
]);

/* ── Skill node type (knowledge graph hierarchy) ────────────── */
export const SKILL_NODE_TYPE_VALUES = ["domain", "topic", "skill", "subskill"] as const;
export type SkillNodeTypeValue = (typeof SKILL_NODE_TYPE_VALUES)[number];
export const skillNodeTypeEnum = pgEnum("skill_node_type", [
  ...SKILL_NODE_TYPE_VALUES,
]);

/* ── Learning event type (activity tracking) ────────────────── */
export const LEARNING_EVENT_TYPE_VALUES = [
  "view_content",
  "complete_quiz",
  "answer_question",
  "submit_assignment",
  "practice_skill",
  "watch_video",
  "read_summary",
  "play_competition",
] as const;
export type LearningEventTypeValue = (typeof LEARNING_EVENT_TYPE_VALUES)[number];
export const learningEventTypeEnum = pgEnum("learning_event_type", [
  ...LEARNING_EVENT_TYPE_VALUES,
]);

/* ── Plan task status ───────────────────────────────────────── */
export const PLAN_TASK_STATUS_VALUES = [
  "pending",
  "in_progress",
  "completed",
  "skipped",
  "expired",
] as const;
export type PlanTaskStatusValue = (typeof PLAN_TASK_STATUS_VALUES)[number];
export const planTaskStatusEnum = pgEnum("plan_task_status", [
  ...PLAN_TASK_STATUS_VALUES,
]);

/* ── Plan task type ─────────────────────────────────────────── */
export const PLAN_TASK_TYPE_VALUES = [
  "diagnostic",
  "practice_quiz",
  "read_content",
  "watch_video",
  "warmup",
  "review_weakness",
  "maintain_strength",
  "explore_new",
] as const;
export type PlanTaskTypeValue = (typeof PLAN_TASK_TYPE_VALUES)[number];
export const planTaskTypeEnum = pgEnum("plan_task_type", [
  ...PLAN_TASK_TYPE_VALUES,
]);

/* ── Diagnostic session status ──────────────────────────────── */
export const DIAGNOSTIC_STATUS_VALUES = [
  "in_progress",
  "completed",
  "abandoned",
] as const;
export type DiagnosticStatusValue = (typeof DIAGNOSTIC_STATUS_VALUES)[number];
export const diagnosticStatusEnum = pgEnum("diagnostic_status", [
  ...DIAGNOSTIC_STATUS_VALUES,
]);

/* ── Emotional state (weekly check-in) ──────────────────────── */
export const EMOTIONAL_STATE_VALUES = [
  "great",
  "good",
  "okay",
  "stressed",
  "overwhelmed",
] as const;
export type EmotionalStateValue = (typeof EMOTIONAL_STATE_VALUES)[number];
export const emotionalStateEnum = pgEnum("emotional_state", [
  ...EMOTIONAL_STATE_VALUES,
]);

/* ── Warm-up session status ─────────────────────────────────── */
export const WARMUP_STATUS_VALUES = ["pending", "completed", "skipped"] as const;
export type WarmupStatusValue = (typeof WARMUP_STATUS_VALUES)[number];
export const warmupStatusEnum = pgEnum("warmup_status", [
  ...WARMUP_STATUS_VALUES,
]);
