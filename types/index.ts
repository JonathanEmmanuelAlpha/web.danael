/**
 * Shared application types (§4, §10).
 */

/* -- Roles (§4.1) ------------------------------------------- */
export type UserRole =
  | "student"
  | "teacher"
  | "school_admin"
  | "parent"
  | "tutor"
  | "platform_admin"
  | "content_moderator"
  | "support";

export const USER_ROLES: UserRole[] = [
  "student",
  "teacher",
  "school_admin",
  "parent",
  "tutor",
  "platform_admin",
  "content_moderator",
  "support",
];

/* -- Levels (§10.2) ----------------------------------------- */
export type Level = "6e" | "5e" | "4e" | "3e" | "2nde" | "1ere" | "Tle";
export const LEVELS: Level[] = ["6e", "5e", "4e", "3e", "2nde", "1ere", "Tle"];

/* -- Series (§10.2) ----------------------------------------- */
export type Series = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "TI";
export const SERIES: Series[] = ["A", "B", "C", "D", "E", "F", "G", "TI"];

/* -- Content types (§10.2) ---------------------------------- */
export type ContentType =
  | "epreuve"
  | "corrige"
  | "resume"
  | "fiche"
  | "video"
  | "exercice"
  | "devoir_modele"
  | "sujet_blanc";

/* -- Content visibility (§10.2) ------------------------------ */
export type ContentVisibility =
  | "public"
  | "school_private"
  | "class_private"
  | "unlisted"
  | "draft"
  | "archived";

/* -- Subscription status (§10.2) ----------------------------- */
export type SubscriptionStatus =
  | "free"
  | "active"
  | "past_due"
  | "expired"
  | "cancelled";

/* -- Assignment status (§10.2) ------------------------------- */
export type AssignmentStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "closed"
  | "archived";

/* -- Submission status (§10.2) ------------------------------- */
export type SubmissionStatus =
  | "not_started"
  | "submitted"
  | "late"
  | "graded"
  | "returned";

/* -- Attendance status (§10.2) ------------------------------- */
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

/* -- Competition scope (§10.2) ------------------------------- */
export type CompetitionScope = "class" | "school" | "regional" | "national";

/* -- Clerk error shape (used by auth pages) ------------------ */
export interface ClerkError {
  errors?: Array<{ code?: string; longMessage?: string; message?: string }>;
}

/* -- OAuth strategies --------------------------------------- */
export type OAuthStrategy = "oauth_google" | "oauth_apple" | "oauth_facebook";

/* -- Address --------------------------------------- */
export type Address = {
  country: string;
  region: string;
  city: string;
  quater?: string;
};
