CREATE TYPE "public"."diagnostic_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."emotional_state" AS ENUM('great', 'good', 'okay', 'stressed', 'overwhelmed');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invitation_target" AS ENUM('school', 'class');--> statement-breakpoint
CREATE TYPE "public"."join_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."learning_event_type" AS ENUM('view_content', 'complete_quiz', 'answer_question', 'submit_assignment', 'practice_skill', 'watch_video', 'read_summary', 'play_competition');--> statement-breakpoint
CREATE TYPE "public"."plan_task_status" AS ENUM('pending', 'in_progress', 'completed', 'skipped', 'expired');--> statement-breakpoint
CREATE TYPE "public"."plan_task_type" AS ENUM('diagnostic', 'practice_quiz', 'read_content', 'watch_video', 'warmup', 'review_weakness', 'maintain_strength', 'explore_new');--> statement-breakpoint
CREATE TYPE "public"."question_source" AS ENUM('verified', 'generated');--> statement-breakpoint
CREATE TYPE "public"."skill_node_type" AS ENUM('domain', 'topic', 'skill', 'subskill');--> statement-breakpoint
CREATE TYPE "public"."warmup_status" AS ENUM('pending', 'completed', 'skipped');--> statement-breakpoint
CREATE TABLE "class_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role_in_school" DEFAULT 'student' NOT NULL,
	"message" text,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" "invitation_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"invitee_user_id" uuid,
	"invitee_email" text,
	"role_in_target" "role_in_school" NOT NULL,
	"invited_by" uuid NOT NULL,
	"message" text,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_in_school" "role_in_school" NOT NULL,
	"message" text,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"skill_id" uuid,
	"selected_option_id" uuid,
	"answer_text" text,
	"is_correct" boolean,
	"perceived_difficulty" integer DEFAULT 3 NOT NULL,
	"time_spent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"week_key" text NOT NULL,
	"status" "diagnostic_status" DEFAULT 'in_progress' NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"correct_answers" integer DEFAULT 0 NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"time_spent" integer DEFAULT 0 NOT NULL,
	"skill_snapshot" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emotional_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"week_key" text NOT NULL,
	"state" "emotional_state" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"type" "learning_event_type" NOT NULL,
	"resource_id" uuid,
	"resource_type" text,
	"skill_id" uuid,
	"success" boolean,
	"score" real,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"week_key" text NOT NULL,
	"diagnostic_session_id" uuid,
	"target_progress" integer DEFAULT 5 NOT NULL,
	"targeted_skills" uuid[] DEFAULT '{}' NOT NULL,
	"summary" text,
	"analysis" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mastery_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"mastery" integer NOT NULL,
	"source" text DEFAULT 'practice' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peer_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"avg_improvement" real DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"day_of_week" integer,
	"scheduled_for" timestamp with time zone,
	"type" "plan_task_type" NOT NULL,
	"status" "plan_task_status" DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"skill_id" uuid,
	"resource_id" uuid,
	"resource_type" text,
	"estimated_minutes" integer DEFAULT 10 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_skill_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"subject_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "skill_node_type" DEFAULT 'skill' NOT NULL,
	"level" "level",
	"default_difficulty" integer DEFAULT 3 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_prerequisites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"prerequisite_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_skill_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"mastery" integer DEFAULT 0 NOT NULL,
	"confidence" real DEFAULT 50 NOT NULL,
	"practice_count" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"last_practiced_at" timestamp with time zone,
	"predicted_mastery" real DEFAULT 0 NOT NULL,
	"forgetting_rate" real DEFAULT 0.5 NOT NULL,
	"trend" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warmup_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"date_key" text NOT NULL,
	"status" "warmup_status" DEFAULT 'pending' NOT NULL,
	"question_ids" uuid[] DEFAULT '{}' NOT NULL,
	"skill_ids" uuid[] DEFAULT '{}' NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 3 NOT NULL,
	"time_spent" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "join_code" text;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "source" "question_source" DEFAULT 'verified' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "generated_by_model" text;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "generated_for_skill_id" uuid;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "verified_by" uuid;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "class_join_requests" ADD CONSTRAINT "class_join_requests_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_join_requests" ADD CONSTRAINT "class_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_join_requests" ADD CONSTRAINT "school_join_requests_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_join_requests" ADD CONSTRAINT "school_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_answers" ADD CONSTRAINT "diagnostic_answers_session_id_diagnostic_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."diagnostic_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_answers" ADD CONSTRAINT "diagnostic_answers_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_answers" ADD CONSTRAINT "diagnostic_answers_skill_id_skill_nodes_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_sessions" ADD CONSTRAINT "diagnostic_sessions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotional_checkins" ADD CONSTRAINT "emotional_checkins_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_history" ADD CONSTRAINT "mastery_history_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_history" ADD CONSTRAINT "mastery_history_skill_id_skill_nodes_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_signals" ADD CONSTRAINT "peer_signals_skill_id_skill_nodes_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_plan_id_learning_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."learning_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_skill_links" ADD CONSTRAINT "question_skill_links_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_skill_links" ADD CONSTRAINT "question_skill_links_skill_id_skill_nodes_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_nodes" ADD CONSTRAINT "skill_nodes_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_prerequisites" ADD CONSTRAINT "skill_prerequisites_skill_id_skill_nodes_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_prerequisites" ADD CONSTRAINT "skill_prerequisites_prerequisite_id_skill_nodes_id_fk" FOREIGN KEY ("prerequisite_id") REFERENCES "public"."skill_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skill_states" ADD CONSTRAINT "student_skill_states_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skill_states" ADD CONSTRAINT "student_skill_states_skill_id_skill_nodes_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warmup_sessions" ADD CONSTRAINT "warmup_sessions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_join_requests_class_id_idx" ON "class_join_requests" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "class_join_requests_user_id_idx" ON "class_join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "class_join_requests_status_idx" ON "class_join_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "class_join_requests_class_user_uniq" ON "class_join_requests" USING btree ("class_id","user_id");--> statement-breakpoint
CREATE INDEX "invitations_invitee_user_id_idx" ON "invitations" USING btree ("invitee_user_id");--> statement-breakpoint
CREATE INDEX "invitations_invitee_email_idx" ON "invitations" USING btree ("invitee_email");--> statement-breakpoint
CREATE INDEX "invitations_target_idx" ON "invitations" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "school_join_requests_school_id_idx" ON "school_join_requests" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "school_join_requests_user_id_idx" ON "school_join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "school_join_requests_status_idx" ON "school_join_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "school_join_requests_school_user_uniq" ON "school_join_requests" USING btree ("school_id","user_id");--> statement-breakpoint
CREATE INDEX "diagnostic_answers_session_id_idx" ON "diagnostic_answers" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "diagnostic_answers_question_id_idx" ON "diagnostic_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "diagnostic_answers_skill_id_idx" ON "diagnostic_answers" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "diagnostic_sessions_student_id_idx" ON "diagnostic_sessions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "diagnostic_sessions_week_key_idx" ON "diagnostic_sessions" USING btree ("week_key");--> statement-breakpoint
CREATE INDEX "diagnostic_sessions_status_idx" ON "diagnostic_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "emotional_checkins_student_week_uniq" ON "emotional_checkins" USING btree ("student_id","week_key");--> statement-breakpoint
CREATE INDEX "emotional_checkins_student_id_idx" ON "emotional_checkins" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "learning_events_student_id_idx" ON "learning_events" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "learning_events_type_idx" ON "learning_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "learning_events_skill_id_idx" ON "learning_events" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "learning_events_occurred_at_idx" ON "learning_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_plans_student_week_uniq" ON "learning_plans" USING btree ("student_id","week_key");--> statement-breakpoint
CREATE INDEX "learning_plans_student_id_idx" ON "learning_plans" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "learning_plans_week_key_idx" ON "learning_plans" USING btree ("week_key");--> statement-breakpoint
CREATE INDEX "mastery_history_student_id_idx" ON "mastery_history" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "mastery_history_skill_id_idx" ON "mastery_history" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "mastery_history_recorded_at_idx" ON "mastery_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "peer_signals_skill_id_idx" ON "peer_signals" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "peer_signals_resource_id_idx" ON "peer_signals" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "plan_tasks_plan_id_idx" ON "plan_tasks" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_tasks_student_id_idx" ON "plan_tasks" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "plan_tasks_status_idx" ON "plan_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "plan_tasks_scheduled_for_idx" ON "plan_tasks" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "plan_tasks_skill_id_idx" ON "plan_tasks" USING btree ("skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_skill_links_uniq" ON "question_skill_links" USING btree ("question_id","skill_id");--> statement-breakpoint
CREATE INDEX "question_skill_links_question_id_idx" ON "question_skill_links" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "question_skill_links_skill_id_idx" ON "question_skill_links" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skill_nodes_parent_id_idx" ON "skill_nodes" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "skill_nodes_subject_id_idx" ON "skill_nodes" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_nodes_code_uniq" ON "skill_nodes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "skill_nodes_type_idx" ON "skill_nodes" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_prerequisites_uniq" ON "skill_prerequisites" USING btree ("skill_id","prerequisite_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_skill_states_uniq" ON "student_skill_states" USING btree ("student_id","skill_id");--> statement-breakpoint
CREATE INDEX "student_skill_states_student_id_idx" ON "student_skill_states" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_skill_states_skill_id_idx" ON "student_skill_states" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "student_skill_states_mastery_idx" ON "student_skill_states" USING btree ("mastery");--> statement-breakpoint
CREATE UNIQUE INDEX "warmup_sessions_student_date_uniq" ON "warmup_sessions" USING btree ("student_id","date_key");--> statement-breakpoint
CREATE INDEX "warmup_sessions_student_id_idx" ON "warmup_sessions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "schools_join_code_idx" ON "schools" USING btree ("join_code");--> statement-breakpoint
CREATE INDEX "quiz_questions_source_idx" ON "quiz_questions" USING btree ("source");--> statement-breakpoint
CREATE INDEX "quiz_questions_verified_by_idx" ON "quiz_questions" USING btree ("verified_by");