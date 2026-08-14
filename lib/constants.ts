/**
 * App-wide constants.
 */

export const APP_NAME = "Danaël";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const RESEND_OTP_COOLDOWN_SECONDS = 60;

export const PASSWORD_MIN_LENGTH = 8;

export const FILE_SIZE_LIMITS = {
  avatar: 2 * 1024 * 1024, // 2 MB
  document: 32 * 1024 * 1024, // 32 MB
  video: 256 * 1024 * 1024, // 256 MB
  submission: 25 * 1024 * 1024, // 32 MB
} as const;

export const ALLOWED_MIME_TYPES = {
  documents: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  images: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  videos: ["video/mp4", "video/webm", "video/quicktime"],
} as const;

export const STORAGE_PATHS = {
  content: (contentId: string) => `contents/${contentId}`,
  submission: (submissionId: string) => `submissions/${submissionId}`,
  avatar: (userId: string) => `avatars/${userId}`,
  export: (schoolId: string) => `exports/${schoolId}`,
} as const;

export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  verifyAccount: "/verify-account",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  ssoCallback: "/sso-callback",
  onboardingRole: "/onboarding/role",
  dashboard: "/dashboard",
  // Role dashboards
  studentDashboard: "/dashboard",
  teacherDashboard: "/dashboard",
  schoolDashboard: "/dashboard",
  parentDashboard: "/dashboard",
  tutorDashboard: "/dashboard",
  adminDashboard: "/admin/dashboard",
} as const;
