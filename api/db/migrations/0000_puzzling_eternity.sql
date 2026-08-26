CREATE SCHEMA "applicant";
--> statement-breakpoint
CREATE TABLE "applicant"."applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer,
	"job_id" integer,
	"company_name" varchar(255),
	"status" varchar(30) DEFAULT 'applied' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now(),
	"linked_version_id" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "applicant"."companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"industry" varchar(120),
	"comp_above_median" boolean,
	"culture_score" integer,
	"retention_score" integer,
	"quality_score" integer,
	"quality_basis" jsonb,
	"unrated" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant"."jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer,
	"company_id" integer,
	"title" varchar(300) NOT NULL,
	"description" text,
	"source_name" varchar(80),
	"source_url" text,
	"compensation" jsonb,
	"quality_score" integer,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"dedupe_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "applicant"."notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(40) NOT NULL,
	"payload" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "applicant"."profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"target_industry" varchar(120),
	"target_role" varchar(120),
	"location_prefs" jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "applicant"."resume_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer,
	"full_name" varchar(200),
	"email" varchar(255),
	"phone" varchar(50),
	"links" jsonb,
	"base_resume_text" text DEFAULT '' NOT NULL,
	"base_resume_json" jsonb,
	"voice_profile" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "applicant"."resume_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"resume_profile_id" integer NOT NULL,
	"tailored_resume_text" text,
	"cover_letter" text,
	"job_ref" varchar(255),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "applicant"."scraping_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"profile_id" integer,
	"source_name" varchar(80),
	"count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "applicant"."subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_sub_id" varchar(255),
	"plan" varchar(40),
	"status" varchar(40),
	"current_period_end" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "applicant"."support_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "applicant"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(120),
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"subscription_tier" varchar(20) DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_sign_in_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "applicant"."applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."applications" ADD CONSTRAINT "applications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "applicant"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "applicant"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."applications" ADD CONSTRAINT "applications_linked_version_id_resume_versions_id_fk" FOREIGN KEY ("linked_version_id") REFERENCES "applicant"."resume_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."jobs" ADD CONSTRAINT "jobs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "applicant"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "applicant"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."resume_profiles" ADD CONSTRAINT "resume_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."resume_profiles" ADD CONSTRAINT "resume_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "applicant"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."resume_versions" ADD CONSTRAINT "resume_versions_resume_profile_id_resume_profiles_id_fk" FOREIGN KEY ("resume_profile_id") REFERENCES "applicant"."resume_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."scraping_logs" ADD CONSTRAINT "scraping_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."scraping_logs" ADD CONSTRAINT "scraping_logs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "applicant"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."support_requests" ADD CONSTRAINT "support_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_user_idx" ON "applicant"."applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "applicant"."companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "jobs_user_idx" ON "applicant"."jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_dedupe_idx" ON "applicant"."jobs" USING btree ("profile_id","dedupe_hash");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "applicant"."notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_user_idx" ON "applicant"."profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_profiles_user_idx" ON "applicant"."resume_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_versions_profile_idx" ON "applicant"."resume_versions" USING btree ("resume_profile_id");--> statement-breakpoint
CREATE INDEX "support_status_idx" ON "applicant"."support_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "applicant"."users" USING btree ("email");