CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_cents" bigint NOT NULL,
	"target_date" date,
	"annual_rate_bp" integer,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_target_check" CHECK ("goals"."target_cents" > 0),
	CONSTRAINT "goals_rate_check" CHECK ("goals"."annual_rate_bp" is null or ("goals"."annual_rate_bp" >= 0 and "goals"."annual_rate_bp" <= 10000)),
	CONSTRAINT "goals_name_check" CHECK (char_length("goals"."name") between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_fk" FOREIGN KEY ("workspace_id","account_id") REFERENCES "public"."financial_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "goals_active_account_idx" ON "goals" USING btree ("workspace_id","account_id") WHERE "goals"."archived_at" is null;