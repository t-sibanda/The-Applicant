ALTER TABLE "applicant"."resume_profiles" ADD COLUMN IF NOT EXISTS "skills" jsonb;--> statement-breakpoint
ALTER TABLE "applicant"."learning_items" ADD COLUMN IF NOT EXISTS "skill_tags" jsonb;--> statement-breakpoint
ALTER TABLE "applicant"."learning_items" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "applicant"."learning_items" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applicant"."application_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"from_status" varchar(30),
	"to_status" varchar(30) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "applicant"."application_events" ADD CONSTRAINT "application_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applicant"."applications"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "applicant"."application_events" ADD CONSTRAINT "application_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_events_app_idx" ON "applicant"."application_events" USING btree ("application_id");