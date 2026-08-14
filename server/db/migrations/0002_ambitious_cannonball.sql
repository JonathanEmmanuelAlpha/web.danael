CREATE TYPE "public"."user_gender" AS ENUM('male', 'female');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "birth_date" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" "user_gender";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" jsonb;