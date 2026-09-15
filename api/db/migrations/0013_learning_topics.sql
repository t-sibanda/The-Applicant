CREATE TABLE IF NOT EXISTS "applicant"."learning_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"kind" varchar(30) DEFAULT 'topic' NOT NULL,
	"goal" text,
	"overview" text,
	"key_facts" jsonb,
	"course" jsonb,
	"latest" jsonb,
	"progress" integer DEFAULT 0 NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "applicant"."learning_topics" ADD CONSTRAINT "learning_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_topics_user_idx" ON "applicant"."learning_topics" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "applicant"."learning_items" ADD COLUMN IF NOT EXISTS "topic_id" integer;--> statement-breakpoint
ALTER TABLE "applicant"."learning_items" ADD COLUMN IF NOT EXISTS "content" text;--> statement-breakpoint
ALTER TABLE "applicant"."learning_items" ADD COLUMN IF NOT EXISTS "image_ref" text;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "applicant"."learning_items" ADD CONSTRAINT "learning_items_topic_id_learning_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "applicant"."learning_topics"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
