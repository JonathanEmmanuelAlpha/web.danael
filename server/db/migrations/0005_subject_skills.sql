-- 0005_subject_skills.sql
-- Adds the subject_skills table and skill_id foreign keys across contents,
-- assignments, quizzes, quiz_questions and competitions.
-- This makes "skills" (granular competencies) the atomic targeting unit
-- for every pedagogical resource in the platform.

-- ────────────────────────────────────────────────────────────────────
-- subject_skills — granular skills attached to a subject
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "subject_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "difficulty" text DEFAULT 'medium' NOT NULL,
  "slug" text,
  "icon" text,
  "color" text,
  "skill_node_id" uuid,
  "is_active" boolean DEFAULT true NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "subject_skills_subject_name_uniq" UNIQUE ("subject_id", "name")
);

CREATE INDEX IF NOT EXISTS "subject_skills_subject_id_idx" ON "subject_skills" ("subject_id");
CREATE INDEX IF NOT EXISTS "subject_skills_difficulty_idx" ON "subject_skills" ("difficulty");
CREATE INDEX IF NOT EXISTS "subject_skills_is_active_idx" ON "subject_skills" ("is_active");

-- ────────────────────────────────────────────────────────────────────
-- contents.skill_id
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "contents"
  ADD COLUMN IF NOT EXISTS "skill_id" uuid REFERENCES "subject_skills"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "contents_skill_id_idx" ON "contents" ("skill_id");

-- ────────────────────────────────────────────────────────────────────
-- assignments.skill_id
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "assignments"
  ADD COLUMN IF NOT EXISTS "skill_id" uuid REFERENCES "subject_skills"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "assignments_skill_id_idx" ON "assignments" ("skill_id");

-- ────────────────────────────────────────────────────────────────────
-- quizzes.skill_id (primary skill the quiz targets)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "quizzes"
  ADD COLUMN IF NOT EXISTS "skill_id" uuid REFERENCES "subject_skills"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "quizzes_skill_id_idx" ON "quizzes" ("skill_id");

-- ────────────────────────────────────────────────────────────────────
-- quiz_questions.skill_id (each question targets exactly one skill)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "skill_id" uuid REFERENCES "subject_skills"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "quiz_questions_skill_id_idx" ON "quiz_questions" ("skill_id");

-- ────────────────────────────────────────────────────────────────────
-- competitions.subject_id + competitions.skill_id
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "subject_id" uuid REFERENCES "subjects"("id") ON DELETE SET NULL;
ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "skill_id" uuid REFERENCES "subject_skills"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "competitions_subject_id_idx" ON "competitions" ("subject_id");
CREATE INDEX IF NOT EXISTS "competitions_skill_id_idx" ON "competitions" ("skill_id");
