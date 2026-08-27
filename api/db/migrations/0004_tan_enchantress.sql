CREATE TABLE "applicant"."learning_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"url" text NOT NULL,
	"title" varchar(300),
	"category" varchar(40) DEFAULT 'tip' NOT NULL,
	"summary" text,
	"takeaways" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "applicant"."learning_items" ADD CONSTRAINT "learning_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_user_idx" ON "applicant"."learning_items" USING btree ("user_id");