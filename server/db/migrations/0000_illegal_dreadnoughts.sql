CREATE TYPE "public"."activity_type" AS ENUM('view_content', 'download_content', 'submit_assignment', 'complete_quiz', 'earn_badge', 'join_class', 'post_message', 'rate_content');--> statement-breakpoint
CREATE TYPE "public"."assignment_item_type" AS ENUM('content', 'url', 'quiz', 'text');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('draft', 'scheduled', 'published', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'late', 'excused');--> statement-breakpoint
CREATE TYPE "public"."audience" AS ENUM('school', 'class', 'teachers', 'students', 'parents', 'public');--> statement-breakpoint
CREATE TYPE "public"."competition_scope" AS ENUM('class', 'school', 'regional', 'national');--> statement-breakpoint
CREATE TYPE "public"."competition_status" AS ENUM('draft', 'scheduled', 'active', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('epreuve', 'corrige', 'resume', 'fiche', 'video', 'exercice', 'devoir_modele', 'sujet_blanc');--> statement-breakpoint
CREATE TYPE "public"."content_visibility" AS ENUM('public', 'school_private', 'class_private', 'unlisted', 'draft', 'archived');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard', 'expert');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('pending', 'uploaded', 'processing', 'ready', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."goal_period" AS ENUM('daily', 'weekly', 'monthly', 'term');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'completed', 'missed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('xp', 'streak', 'contents_viewed', 'quizzes_passed', 'submissions_on_time');--> statement-breakpoint
CREATE TYPE "public"."grade_period" AS ENUM('T1', 'T2', 'T3', 'S1', 'S2', 'annual');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'void', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."level" AS ENUM('6e', '5e', '4e', '3e', '2nde', '1ere', 'Tle');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('sent', 'delivered', 'read');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('info', 'assignment', 'grade', 'announcement', 'social', 'reminder', 'system');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'orange_money', 'mtn_money', 'wave', 'flutterwave');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('free', 'essential', 'premium', 'institution');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('draft', 'in_review', 'published', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."quiz_question_type" AS ENUM('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay');--> statement-breakpoint
CREATE TYPE "public"."quiz_session_status" AS ENUM('in_progress', 'completed', 'abandoned', 'expired');--> statement-breakpoint
CREATE TYPE "public"."quiz_type" AS ENUM('practice', 'exam', 'homework', 'diagnostic');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'in_review', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."role_in_school" AS ENUM('admin', 'teacher', 'student', 'parent', 'staff');--> statement-breakpoint
CREATE TYPE "public"."school_type" AS ENUM('public', 'private', 'parochial', 'other');--> statement-breakpoint
CREATE TYPE "public"."series" AS ENUM('A', 'B', 'C', 'D', 'E', 'F', 'G', 'TI');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('not_started', 'submitted', 'late', 'graded', 'returned');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('free', 'active', 'past_due', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."thread_type" AS ENUM('direct', 'group', 'class', 'school', 'support');--> statement-breakpoint
CREATE TYPE "public"."tutor_booking_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'teacher', 'school_admin', 'parent', 'tutor', 'platform_admin', 'content_moderator', 'support');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "moderation_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"type" "assignment_item_type" DEFAULT 'content' NOT NULL,
	"content_id" uuid,
	"url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"class_id" uuid NOT NULL,
	"subject_id" uuid,
	"teacher_id" uuid NOT NULL,
	"due_at" timestamp with time zone,
	"points" integer,
	"allow_late_submission" boolean DEFAULT false NOT NULL,
	"status" "assignment_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"status" "attendance_status" DEFAULT 'present' NOT NULL,
	"reason" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid,
	"subject_id" uuid,
	"assignment_id" uuid,
	"score" numeric(6, 2) NOT NULL,
	"max_score" numeric(6, 2) DEFAULT '20' NOT NULL,
	"period" "grade_period" DEFAULT 'T1' NOT NULL,
	"comment" text,
	"graded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "submission_status" DEFAULT 'not_started' NOT NULL,
	"submitted_at" timestamp with time zone,
	"score" numeric(6, 2),
	"feedback" text,
	"graded_by" uuid,
	"graded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon_url" text,
	"category" text NOT NULL,
	"condition" text,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badges_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "competition_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"rank" integer,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"scope" "competition_scope" DEFAULT 'class' NOT NULL,
	"level" "level",
	"series" "series",
	"school_id" uuid,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "competition_status" DEFAULT 'draft' NOT NULL,
	"prize_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"change_note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "content_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"subject_id" uuid,
	"level" "level",
	"series" "series",
	"school_id" uuid,
	"class_id" uuid,
	"visibility" "content_visibility" DEFAULT 'public' NOT NULL,
	"publication_status" "publication_status" DEFAULT 'draft' NOT NULL,
	"file_id" uuid,
	"thumbnail_file_id" uuid,
	"year" integer,
	"difficulty" "difficulty",
	"duration_minutes" integer,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"downloads_count" integer DEFAULT 0 NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT '0',
	"rating_count" integer DEFAULT 0 NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"key" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_type" "activity_type" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "goal_type" NOT NULL,
	"target_value" integer NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"period" "goal_period" NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"level" "level",
	"series" "series",
	"language" text DEFAULT 'fr' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"weekly_goal" integer DEFAULT 5 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "class_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role_in_school" DEFAULT 'student' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"coefficient" integer DEFAULT 1 NOT NULL,
	"teacher_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"level" "level",
	"series" "series",
	"academic_year" text,
	"head_teacher_id" uuid,
	"invite_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_student_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"relationship" text DEFAULT 'parent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_in_school" "role_in_school" NOT NULL,
	"status" "member_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "school_type",
	"city" text,
	"region" text,
	"logo_url" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "question_banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid,
	"level" "level",
	"series" "series",
	"label" text NOT NULL,
	"difficulty" "difficulty" DEFAULT 'medium',
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_text" text,
	"selected_option_id" uuid,
	"is_correct" boolean,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"time_spent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"type" "quiz_question_type" DEFAULT 'single_choice' NOT NULL,
	"label" text NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"explanation" text,
	"difficulty" "difficulty" DEFAULT 'medium',
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "quiz_session_status" DEFAULT 'in_progress' NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"max_score" integer DEFAULT 0 NOT NULL,
	"time_spent" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"subject_id" uuid,
	"level" "level",
	"series" "series",
	"type" "quiz_type" DEFAULT 'practice' NOT NULL,
	"time_limit_minutes" integer,
	"passing_score" integer DEFAULT 50,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"class_id" uuid,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"audience" "audience" DEFAULT 'school' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversation_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "thread_type" DEFAULT 'direct' NOT NULL,
	"school_id" uuid,
	"class_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"attachment_file_id" uuid,
	"status" "message_status" DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channels" jsonb DEFAULT '["in_app","email"]'::jsonb NOT NULL,
	"frequency" text DEFAULT 'immediate' NOT NULL,
	"categories" jsonb DEFAULT '["assignments","grades","announcements","messages","reminders","social","system","billing"]'::jsonb NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"metadata" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"subscription_id" uuid,
	"number" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"provider" "payment_provider" NOT NULL,
	"provider_transaction_id" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'XOF' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"school_id" uuid,
	"plan_type" "plan_type" DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'free' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'XOF' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_availabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_profile_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_profile_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"booked_by" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "tutor_booking_status" DEFAULT 'pending' NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bio" text,
	"hourly_rate" integer,
	"location" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT '0',
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_profile_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"level" "level",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_items" ADD CONSTRAINT "assignment_items_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_items" ADD CONSTRAINT "assignment_items_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_notes" ADD CONSTRAINT "content_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_notes" ADD CONSTRAINT "content_notes_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_thumbnail_file_id_files_id_fk" FOREIGN KEY ("thumbnail_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_goals" ADD CONSTRAINT "user_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_points" ADD CONSTRAINT "user_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_head_teacher_id_users_id_fk" FOREIGN KEY ("head_teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_relations" ADD CONSTRAINT "parent_student_relations_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_relations" ADD CONSTRAINT "parent_student_relations_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_members" ADD CONSTRAINT "school_members_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_members" ADD CONSTRAINT "school_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_session_id_quiz_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question_options" ADD CONSTRAINT "quiz_question_options_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_thread_id_conversation_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."conversation_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_conversation_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."conversation_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_attachment_file_id_files_id_fk" FOREIGN KEY ("attachment_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_availabilities" ADD CONSTRAINT "tutor_availabilities_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_bookings" ADD CONSTRAINT "tutor_bookings_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_bookings" ADD CONSTRAINT "tutor_bookings_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_bookings" ADD CONSTRAINT "tutor_bookings_booked_by_users_id_fk" FOREIGN KEY ("booked_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_reviews" ADD CONSTRAINT "tutor_reviews_booking_id_tutor_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."tutor_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_reviews" ADD CONSTRAINT "tutor_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_tutor_profile_id_tutor_profiles_id_fk" FOREIGN KEY ("tutor_profile_id") REFERENCES "public"."tutor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flags_key_uniq" ON "feature_flags" USING btree ("key");--> statement-breakpoint
CREATE INDEX "moderation_reports_reporter_id_idx" ON "moderation_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "moderation_reports_target_idx" ON "moderation_reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "moderation_reports_status_idx" ON "moderation_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "moderation_reports_resolved_by_idx" ON "moderation_reports" USING btree ("resolved_by");--> statement-breakpoint
CREATE INDEX "assignment_items_assignment_id_idx" ON "assignment_items" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "assignment_items_content_id_idx" ON "assignment_items" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "assignments_class_id_idx" ON "assignments" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "assignments_subject_id_idx" ON "assignments" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "assignments_teacher_id_idx" ON "assignments" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "assignments_status_idx" ON "assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assignments_due_at_idx" ON "assignments" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "attendance_class_id_idx" ON "attendance" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "attendance_student_id_idx" ON "attendance" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "attendance_class_student_date_idx" ON "attendance" USING btree ("class_id","student_id","date");--> statement-breakpoint
CREATE INDEX "grades_student_id_idx" ON "grades" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "grades_class_id_idx" ON "grades" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "grades_subject_id_idx" ON "grades" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "grades_assignment_id_idx" ON "grades" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "grades_period_idx" ON "grades" USING btree ("period");--> statement-breakpoint
CREATE INDEX "submission_files_submission_id_idx" ON "submission_files" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_files_file_id_idx" ON "submission_files" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_assignment_student_uniq" ON "submissions" USING btree ("assignment_id","student_id");--> statement-breakpoint
CREATE INDEX "submissions_student_id_idx" ON "submissions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "badges_slug_uniq" ON "badges" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "badges_category_idx" ON "badges" USING btree ("category");--> statement-breakpoint
CREATE INDEX "badges_is_active_idx" ON "badges" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "competition_participants_uniq" ON "competition_participants" USING btree ("competition_id","user_id");--> statement-breakpoint
CREATE INDEX "competition_participants_user_id_idx" ON "competition_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "competition_participants_rank_idx" ON "competition_participants" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "competitions_scope_idx" ON "competitions" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "competitions_level_idx" ON "competitions" USING btree ("level");--> statement-breakpoint
CREATE INDEX "competitions_series_idx" ON "competitions" USING btree ("series");--> statement-breakpoint
CREATE INDEX "competitions_school_id_idx" ON "competitions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "competitions_status_idx" ON "competitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "competitions_start_end_idx" ON "competitions" USING btree ("start_at","end_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_badges_user_badge_uniq" ON "user_badges" USING btree ("user_id","badge_id");--> statement-breakpoint
CREATE INDEX "user_badges_badge_id_idx" ON "user_badges" USING btree ("badge_id");--> statement-breakpoint
CREATE INDEX "content_notes_user_content_idx" ON "content_notes" USING btree ("user_id","content_id");--> statement-breakpoint
CREATE INDEX "content_reports_content_id_idx" ON "content_reports" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "content_reports_status_idx" ON "content_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_versions_content_id_idx" ON "content_versions" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "content_versions_file_id_idx" ON "content_versions" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "contents_type_idx" ON "contents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "contents_subject_id_idx" ON "contents" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "contents_level_idx" ON "contents" USING btree ("level");--> statement-breakpoint
CREATE INDEX "contents_school_id_idx" ON "contents" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "contents_class_id_idx" ON "contents" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "contents_visibility_idx" ON "contents" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "contents_publication_status_idx" ON "contents" USING btree ("publication_status");--> statement-breakpoint
CREATE INDEX "contents_uploaded_by_idx" ON "contents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_content_uniq" ON "favorites" USING btree ("user_id","content_id");--> statement-breakpoint
CREATE INDEX "favorites_content_id_idx" ON "favorites" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "files_owner_id_idx" ON "files" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "files_key_idx" ON "files" USING btree ("key");--> statement-breakpoint
CREATE INDEX "files_status_idx" ON "files" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_activities_user_id_idx" ON "user_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_activities_entity_idx" ON "user_activities" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "user_activities_created_at_idx" ON "user_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_goals_user_id_idx" ON "user_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_goals_status_idx" ON "user_goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_points_user_id_idx" ON "user_points" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_points_level_idx" ON "user_points" USING btree ("level");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_level_idx" ON "users" USING btree ("level");--> statement-breakpoint
CREATE INDEX "users_clerk_id_idx" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "class_members_class_user_uniq" ON "class_members" USING btree ("class_id","user_id");--> statement-breakpoint
CREATE INDEX "class_members_user_id_idx" ON "class_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "class_subjects_class_subject_uniq" ON "class_subjects" USING btree ("class_id","subject_id");--> statement-breakpoint
CREATE INDEX "class_subjects_teacher_id_idx" ON "class_subjects" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "classes_school_id_idx" ON "classes" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "classes_level_idx" ON "classes" USING btree ("level");--> statement-breakpoint
CREATE INDEX "classes_invite_code_idx" ON "classes" USING btree ("invite_code");--> statement-breakpoint
CREATE UNIQUE INDEX "parent_student_relations_uniq" ON "parent_student_relations" USING btree ("parent_id","student_id");--> statement-breakpoint
CREATE INDEX "parent_student_relations_student_id_idx" ON "parent_student_relations" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_members_school_user_uniq" ON "school_members" USING btree ("school_id","user_id");--> statement-breakpoint
CREATE INDEX "school_members_user_id_idx" ON "school_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "school_members_status_idx" ON "school_members" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "schools_slug_uniq" ON "schools" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "schools_type_idx" ON "schools" USING btree ("type");--> statement-breakpoint
CREATE INDEX "schools_city_idx" ON "schools" USING btree ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_code_uniq" ON "subjects" USING btree ("code");--> statement-breakpoint
CREATE INDEX "question_banks_subject_id_idx" ON "question_banks" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "question_banks_level_idx" ON "question_banks" USING btree ("level");--> statement-breakpoint
CREATE INDEX "question_banks_series_idx" ON "question_banks" USING btree ("series");--> statement-breakpoint
CREATE INDEX "question_banks_difficulty_idx" ON "question_banks" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "quiz_answers_session_id_idx" ON "quiz_answers" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "quiz_answers_question_id_idx" ON "quiz_answers" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_answers_session_question_uniq" ON "quiz_answers" USING btree ("session_id","question_id");--> statement-breakpoint
CREATE INDEX "quiz_question_options_question_id_idx" ON "quiz_question_options" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "quiz_questions_quiz_id_idx" ON "quiz_questions" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "quiz_questions_position_idx" ON "quiz_questions" USING btree ("position");--> statement-breakpoint
CREATE INDEX "quiz_sessions_quiz_id_idx" ON "quiz_sessions" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_user_id_idx" ON "quiz_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_status_idx" ON "quiz_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quizzes_subject_id_idx" ON "quizzes" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "quizzes_level_idx" ON "quizzes" USING btree ("level");--> statement-breakpoint
CREATE INDEX "quizzes_series_idx" ON "quizzes" USING btree ("series");--> statement-breakpoint
CREATE INDEX "quizzes_is_published_idx" ON "quizzes" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "quizzes_created_by_idx" ON "quizzes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "announcements_school_id_idx" ON "announcements" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "announcements_class_id_idx" ON "announcements" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "announcements_author_id_idx" ON "announcements" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "announcements_audience_idx" ON "announcements" USING btree ("audience");--> statement-breakpoint
CREATE INDEX "announcements_published_at_idx" ON "announcements" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_participants_uniq" ON "conversation_participants" USING btree ("thread_id","user_id");--> statement-breakpoint
CREATE INDEX "conversation_participants_user_id_idx" ON "conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversation_threads_type_idx" ON "conversation_threads" USING btree ("type");--> statement-breakpoint
CREATE INDEX "conversation_threads_school_id_idx" ON "conversation_threads" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "conversation_threads_class_id_idx" ON "conversation_threads" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "messages_thread_id_idx" ON "messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "messages_sender_id_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_uniq" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notifications_read_at_idx" ON "notifications" USING btree ("read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_uniq" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "invoices_school_id_idx" ON "invoices" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "invoices_subscription_id_idx" ON "invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_subscription_id_idx" ON "payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "payments_provider_idx" ON "payments" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_provider_transaction_id_idx" ON "payments" USING btree ("provider_transaction_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_school_id_idx" ON "subscriptions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_ends_at_idx" ON "subscriptions" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "tutor_availabilities_tutor_profile_id_idx" ON "tutor_availabilities" USING btree ("tutor_profile_id");--> statement-breakpoint
CREATE INDEX "tutor_availabilities_day_of_week_idx" ON "tutor_availabilities" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "tutor_bookings_tutor_profile_id_idx" ON "tutor_bookings" USING btree ("tutor_profile_id");--> statement-breakpoint
CREATE INDEX "tutor_bookings_student_id_idx" ON "tutor_bookings" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "tutor_bookings_status_idx" ON "tutor_bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tutor_bookings_scheduled_at_idx" ON "tutor_bookings" USING btree ("scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_profiles_user_id_uniq" ON "tutor_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tutor_profiles_is_verified_idx" ON "tutor_profiles" USING btree ("is_verified");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_reviews_booking_id_uniq" ON "tutor_reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "tutor_reviews_reviewer_id_idx" ON "tutor_reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "tutor_reviews_rating_idx" ON "tutor_reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "tutor_subjects_tutor_profile_id_idx" ON "tutor_subjects" USING btree ("tutor_profile_id");--> statement-breakpoint
CREATE INDEX "tutor_subjects_subject_id_idx" ON "tutor_subjects" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "tutor_subjects_level_idx" ON "tutor_subjects" USING btree ("level");