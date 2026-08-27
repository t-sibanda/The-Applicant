ALTER TABLE "applicant"."applications" ADD COLUMN "job_title" varchar(300);--> statement-breakpoint
ALTER TABLE "applicant"."applications" ADD COLUMN "job_url" text;--> statement-breakpoint
ALTER TABLE "applicant"."applications" ADD COLUMN "draft_resume" text;--> statement-breakpoint
ALTER TABLE "applicant"."applications" ADD COLUMN "draft_cover_letter" text;