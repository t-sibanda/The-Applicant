CREATE TABLE "applicant"."portfolios" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"headline" varchar(200),
	"about" text,
	"accomplishments" jsonb,
	"projects" jsonb,
	"publications" jsonb,
	"skills" jsonb,
	"links" jsonb,
	"template" varchar(40) DEFAULT 'modern' NOT NULL,
	"accent" varchar(20) DEFAULT '#ff6b35' NOT NULL,
	"visibility" jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "applicant"."portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;