CREATE TABLE "school_access_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"access_code" text NOT NULL,
	"created_by" uuid NOT NULL,
	"usages" integer DEFAULT 0 NOT NULL,
	"max_usages" integer,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_admin_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"school_admin_id" uuid NOT NULL,
	"school_access_code_id" uuid NOT NULL,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "school_access_codes" ADD CONSTRAINT "school_access_codes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_access_codes" ADD CONSTRAINT "school_access_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_admin_access" ADD CONSTRAINT "school_admin_access_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_admin_access" ADD CONSTRAINT "school_admin_access_school_admin_id_users_id_fk" FOREIGN KEY ("school_admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_admin_access" ADD CONSTRAINT "school_admin_access_school_access_code_id_school_access_codes_id_fk" FOREIGN KEY ("school_access_code_id") REFERENCES "public"."school_access_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "school_access_codes_school_id_idx" ON "school_access_codes" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_access_codes_code_uniq" ON "school_access_codes" USING btree ("access_code");--> statement-breakpoint
CREATE INDEX "school_admin_access_school_id_idx" ON "school_admin_access" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "school_admin_access_school_admin_id_idx" ON "school_admin_access" USING btree ("school_admin_id");--> statement-breakpoint
CREATE INDEX "school_admin_access_status_idx" ON "school_admin_access" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "school_admin_access_school_admin_uniq" ON "school_admin_access" USING btree ("school_id","school_admin_id");