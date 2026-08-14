CREATE TYPE "public"."onboarding_status" AS ENUM('not_started', 'role_selected', 'profile_completed', 'completed');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_status" "onboarding_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "onboarding_completed";