CREATE TABLE "applicant"."conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer,
	"title" varchar(200) DEFAULT 'Assistant' NOT NULL,
	"working_doc" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "applicant"."messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "applicant"."saved_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer,
	"type" varchar(20) NOT NULL,
	"title" varchar(300),
	"url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "applicant"."conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."conversations" ADD CONSTRAINT "conversations_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "applicant"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "applicant"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."saved_items" ADD CONSTRAINT "saved_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant"."saved_items" ADD CONSTRAINT "saved_items_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "applicant"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_user_idx" ON "applicant"."conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "messages_conv_idx" ON "applicant"."messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "saved_items_user_idx" ON "applicant"."saved_items" USING btree ("user_id");