CREATE TABLE "applicant"."feature_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"feature" varchar(60) NOT NULL,
	"value" varchar(40) NOT NULL,
	"expires_at" timestamp with time zone,
	"granted_by" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "applicant"."feature_grants" ADD CONSTRAINT "feature_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "applicant"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feature_grants_user_idx" ON "applicant"."feature_grants" USING btree ("user_id");