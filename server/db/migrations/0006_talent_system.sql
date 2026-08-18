-- 0006_talent_system.sql
-- SDPT — Système de Détection & Promotion des Talents
-- Adds the full talent discovery, scoring, track, mentor, cohort,
-- career and showcase subsystem.

-- ────────────────────────────────────────────────────────────────────
-- talent_assessment_sessions
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "talent_assessment_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'in_progress',
  "current_phase" text NOT NULL DEFAULT 'cognitive',
  "total_questions" integer DEFAULT 0 NOT NULL,
  "correct_answers" integer DEFAULT 0 NOT NULL,
  "time_spent_sec" integer DEFAULT 0 NOT NULL,
  "phase_data" jsonb,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "talent_assessment_sessions_student_id_idx" ON "talent_assessment_sessions" ("student_id");
CREATE INDEX IF NOT EXISTS "talent_assessment_sessions_status_idx" ON "talent_assessment_sessions" ("status");

-- ────────────────────────────────────────────────────────────────────
-- talent_assessment_answers
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "talent_assessment_answers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "talent_assessment_sessions"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "phase" text NOT NULL,
  "domain" text NOT NULL,
  "skill_id" uuid,
  "question_id" uuid,
  "answer" text,
  "is_correct" boolean,
  "difficulty" real,
  "time_spent_sec" integer DEFAULT 0 NOT NULL,
  "ability_estimate" real,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "talent_assessment_answers_session_id_idx" ON "talent_assessment_answers" ("session_id");
CREATE INDEX IF NOT EXISTS "talent_assessment_answers_student_id_idx" ON "talent_assessment_answers" ("student_id");
CREATE INDEX IF NOT EXISTS "talent_assessment_answers_phase_idx" ON "talent_assessment_answers" ("phase");
CREATE INDEX IF NOT EXISTS "talent_assessment_answers_domain_idx" ON "talent_assessment_answers" ("domain");

-- ────────────────────────────────────────────────────────────────────
-- talent_profiles
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "talent_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "version" integer DEFAULT 1 NOT NULL,
  "cognitive_scores" jsonb,
  "domain_scores" jsonb,
  "creativity_score" real DEFAULT 0 NOT NULL,
  "engagement_score" real DEFAULT 0 NOT NULL,
  "detected_zones" text[] DEFAULT '{}' NOT NULL,
  "growth_zones" text[] DEFAULT '{}' NOT NULL,
  "north_star_skill_id" uuid REFERENCES "subject_skills"("id"),
  "north_star_tier" text DEFAULT 'seedling' NOT NULL,
  "overall_talent_score" real DEFAULT 0 NOT NULL,
  "assessment_session_id" uuid,
  "is_public_showcase" boolean DEFAULT false NOT NULL,
  "mentor_match_consent" boolean DEFAULT false NOT NULL,
  "cohort_match_consent" boolean DEFAULT false NOT NULL,
  "ai_mentor_consent" boolean DEFAULT true NOT NULL,
  "last_floor_alert_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "talent_profiles_student_uniq" UNIQUE ("student_id")
);
CREATE INDEX IF NOT EXISTS "talent_profiles_north_star_idx" ON "talent_profiles" ("north_star_skill_id");
CREATE INDEX IF NOT EXISTS "talent_profiles_is_public_showcase_idx" ON "talent_profiles" ("is_public_showcase");

-- ────────────────────────────────────────────────────────────────────
-- student_talent_zones
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "student_talent_zones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "skill_id" uuid NOT NULL REFERENCES "subject_skills"("id") ON DELETE CASCADE,
  "zone_type" text NOT NULL DEFAULT 'talent',
  "talent_score" real DEFAULT 0 NOT NULL,
  "confidence" real DEFAULT 0.286 NOT NULL,
  "velocity" real DEFAULT 0 NOT NULL,
  "transfer_score" real DEFAULT 0 NOT NULL,
  "joy_score" real DEFAULT 0.5 NOT NULL,
  "tier" text DEFAULT 'seedling' NOT NULL,
  "alpha" real DEFAULT 2 NOT NULL,
  "beta" real DEFAULT 5 NOT NULL,
  "observation_count" integer DEFAULT 0 NOT NULL,
  "detected_at" timestamptz DEFAULT now() NOT NULL,
  "last_recalculated_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "student_talent_zones_student_skill_uniq" UNIQUE ("student_id", "skill_id")
);
CREATE INDEX IF NOT EXISTS "student_talent_zones_student_id_idx" ON "student_talent_zones" ("student_id");
CREATE INDEX IF NOT EXISTS "student_talent_zones_skill_id_idx" ON "student_talent_zones" ("skill_id");
CREATE INDEX IF NOT EXISTS "student_talent_zones_zone_type_idx" ON "student_talent_zones" ("zone_type");
CREATE INDEX IF NOT EXISTS "student_talent_zones_tier_idx" ON "student_talent_zones" ("tier");

-- ────────────────────────────────────────────────────────────────────
-- talent_challenges
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "talent_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "skill_id" uuid NOT NULL REFERENCES "subject_skills"("id") ON DELETE CASCADE,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "difficulty" integer DEFAULT 5 NOT NULL,
  "estimated_minutes" integer DEFAULT 30 NOT NULL,
  "type" text NOT NULL DEFAULT 'problem_set',
  "required_tier" text DEFAULT 'seedling' NOT NULL,
  "payload" jsonb,
  "solution_hint" text,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "is_user_generated" boolean DEFAULT false NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "completions_count" integer DEFAULT 0 NOT NULL,
  "rating_avg" real DEFAULT 0 NOT NULL,
  "rating_count" integer DEFAULT 0 NOT NULL,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "talent_challenges_skill_id_idx" ON "talent_challenges" ("skill_id");
CREATE INDEX IF NOT EXISTS "talent_challenges_subject_id_idx" ON "talent_challenges" ("subject_id");
CREATE INDEX IF NOT EXISTS "talent_challenges_type_idx" ON "talent_challenges" ("type");
CREATE INDEX IF NOT EXISTS "talent_challenges_required_tier_idx" ON "talent_challenges" ("required_tier");
CREATE INDEX IF NOT EXISTS "talent_challenges_is_published_idx" ON "talent_challenges" ("is_published");
CREATE INDEX IF NOT EXISTS "talent_challenges_created_by_idx" ON "talent_challenges" ("created_by");

-- ────────────────────────────────────────────────────────────────────
-- talent_tracks
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "talent_tracks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "north_star_skill_id" uuid NOT NULL REFERENCES "subject_skills"("id") ON DELETE CASCADE,
  "week_key" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "time_budget_minutes" integer DEFAULT 90 NOT NULL,
  "enrichment_challenge_ids" uuid[] DEFAULT '{}' NOT NULL,
  "cross_disciplinary_project_id" uuid,
  "mentor_challenge_id" uuid,
  "competition_id" uuid,
  "is_paused" boolean DEFAULT false NOT NULL,
  "pause_reason" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "talent_tracks_student_week_uniq" UNIQUE ("student_id", "week_key")
);
CREATE INDEX IF NOT EXISTS "talent_tracks_student_id_idx" ON "talent_tracks" ("student_id");
CREATE INDEX IF NOT EXISTS "talent_tracks_week_key_idx" ON "talent_tracks" ("week_key");
CREATE INDEX IF NOT EXISTS "talent_tracks_north_star_idx" ON "talent_tracks" ("north_star_skill_id");

-- ────────────────────────────────────────────────────────────────────
-- talent_track_progress
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "talent_track_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "talent_track_id" uuid NOT NULL REFERENCES "talent_tracks"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "week_key" text NOT NULL,
  "challenges_completed" integer DEFAULT 0 NOT NULL,
  "challenges_total" integer DEFAULT 0 NOT NULL,
  "time_spent_minutes" integer DEFAULT 0 NOT NULL,
  "mastery_delta" real DEFAULT 0 NOT NULL,
  "joy_signal" real DEFAULT 0.5 NOT NULL,
  "floor_alerts" integer DEFAULT 0 NOT NULL,
  "tier_start" text,
  "tier_end" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "talent_track_progress_track_id_idx" ON "talent_track_progress" ("talent_track_id");
CREATE INDEX IF NOT EXISTS "talent_track_progress_student_id_idx" ON "talent_track_progress" ("student_id");
CREATE INDEX IF NOT EXISTS "talent_track_progress_week_key_idx" ON "talent_track_progress" ("week_key");

-- ────────────────────────────────────────────────────────────────────
-- talent_challenge_submissions
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "talent_challenge_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "challenge_id" uuid NOT NULL REFERENCES "talent_challenges"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'in_progress',
  "submission" text,
  "file_ids" uuid[] DEFAULT '{}' NOT NULL,
  "time_spent_minutes" integer DEFAULT 0 NOT NULL,
  "rating" integer,
  "feedback" text,
  "reviewed_by" uuid,
  "submitted_at" timestamptz,
  "reviewed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "talent_challenge_submissions_challenge_student_uniq" UNIQUE ("challenge_id", "student_id")
);
CREATE INDEX IF NOT EXISTS "talent_challenge_submissions_challenge_id_idx" ON "talent_challenge_submissions" ("challenge_id");
CREATE INDEX IF NOT EXISTS "talent_challenge_submissions_student_id_idx" ON "talent_challenge_submissions" ("student_id");
CREATE INDEX IF NOT EXISTS "talent_challenge_submissions_status_idx" ON "talent_challenge_submissions" ("status");

-- ────────────────────────────────────────────────────────────────────
-- mentor_recommendations
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "mentor_recommendations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tutor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "match_score" real DEFAULT 0 NOT NULL,
  "status" text NOT NULL DEFAULT 'suggested',
  "reason" text,
  "skill_id" uuid REFERENCES "subject_skills"("id") ON DELETE SET NULL,
  "decided_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "mentor_recommendations_student_tutor_uniq" UNIQUE ("student_id", "tutor_id")
);
CREATE INDEX IF NOT EXISTS "mentor_recommendations_student_id_idx" ON "mentor_recommendations" ("student_id");
CREATE INDEX IF NOT EXISTS "mentor_recommendations_tutor_id_idx" ON "mentor_recommendations" ("tutor_id");
CREATE INDEX IF NOT EXISTS "mentor_recommendations_status_idx" ON "mentor_recommendations" ("status");

-- ────────────────────────────────────────────────────────────────────
-- talent_cohorts
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "talent_cohorts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "skill_id" uuid NOT NULL REFERENCES "subject_skills"("id") ON DELETE CASCADE,
  "level" text,
  "name" text NOT NULL,
  "icon" text,
  "current_challenge_id" uuid,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "talent_cohorts_skill_id_idx" ON "talent_cohorts" ("skill_id");
CREATE INDEX IF NOT EXISTS "talent_cohorts_level_idx" ON "talent_cohorts" ("level");
CREATE INDEX IF NOT EXISTS "talent_cohorts_is_active_idx" ON "talent_cohorts" ("is_active");

CREATE TABLE IF NOT EXISTS "talent_cohort_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cohort_id" uuid NOT NULL REFERENCES "talent_cohorts"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "talent_cohort_members_uniq" UNIQUE ("cohort_id", "student_id")
);
CREATE INDEX IF NOT EXISTS "talent_cohort_members_cohort_id_idx" ON "talent_cohort_members" ("cohort_id");
CREATE INDEX IF NOT EXISTS "talent_cohort_members_student_id_idx" ON "talent_cohort_members" ("student_id");

-- ────────────────────────────────────────────────────────────────────
-- career_matches
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "career_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "career_code" text NOT NULL,
  "career_title" text NOT NULL,
  "match_score" real DEFAULT 0 NOT NULL,
  "reason" text,
  "skill_id" uuid REFERENCES "subject_skills"("id") ON DELETE SET NULL,
  "is_bookmarked" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "career_matches_student_id_idx" ON "career_matches" ("student_id");
CREATE INDEX IF NOT EXISTS "career_matches_career_code_idx" ON "career_matches" ("career_code");
CREATE INDEX IF NOT EXISTS "career_matches_is_bookmarked_idx" ON "career_matches" ("is_bookmarked");

-- ────────────────────────────────────────────────────────────────────
-- talent_showcase_items
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "talent_showcase_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "type" text NOT NULL DEFAULT 'project',
  "submission_id" uuid,
  "file_ids" uuid[] DEFAULT '{}' NOT NULL,
  "external_url" text,
  "skill_id" uuid REFERENCES "subject_skills"("id") ON DELETE SET NULL,
  "likes_count" integer DEFAULT 0 NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "published_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "talent_showcase_items_student_id_idx" ON "talent_showcase_items" ("student_id");
CREATE INDEX IF NOT EXISTS "talent_showcase_items_is_published_idx" ON "talent_showcase_items" ("is_published");
CREATE INDEX IF NOT EXISTS "talent_showcase_items_skill_id_idx" ON "talent_showcase_items" ("skill_id");

-- ────────────────────────────────────────────────────────────────────
-- socratic_conversations
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "socratic_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "skill_id" uuid REFERENCES "subject_skills"("id") ON DELETE SET NULL,
  "challenge_id" uuid,
  "title" text,
  "messages" jsonb,
  "message_count" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "socratic_conversations_student_id_idx" ON "socratic_conversations" ("student_id");
CREATE INDEX IF NOT EXISTS "socratic_conversations_skill_id_idx" ON "socratic_conversations" ("skill_id");
CREATE INDEX IF NOT EXISTS "socratic_conversations_is_active_idx" ON "socratic_conversations" ("is_active");

-- ────────────────────────────────────────────────────────────────────
-- floor_alerts
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "floor_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "skill_id" uuid,
  "mastery_at_alert" real NOT NULL,
  "threshold" real DEFAULT 65 NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "breach_count" integer DEFAULT 1 NOT NULL,
  "paused_talent_track" boolean DEFAULT false NOT NULL,
  "resolved_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "floor_alerts_student_id_idx" ON "floor_alerts" ("student_id");
CREATE INDEX IF NOT EXISTS "floor_alerts_skill_id_idx" ON "floor_alerts" ("skill_id");
CREATE INDEX IF NOT EXISTS "floor_alerts_status_idx" ON "floor_alerts" ("status");

-- ────────────────────────────────────────────────────────────────────
-- Extend student_skill_states with talent tracking columns
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "student_skill_states"
  ADD COLUMN IF NOT EXISTS "velocity" real DEFAULT 0 NOT NULL;
ALTER TABLE "student_skill_states"
  ADD COLUMN IF NOT EXISTS "transfer_score" real DEFAULT 0 NOT NULL;
ALTER TABLE "student_skill_states"
  ADD COLUMN IF NOT EXISTS "joy_score" real DEFAULT 0.5 NOT NULL;
ALTER TABLE "student_skill_states"
  ADD COLUMN IF NOT EXISTS "talent_confidence" real DEFAULT 0.286 NOT NULL;
