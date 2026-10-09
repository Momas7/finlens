CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"amount_cents" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_workspace_category_month_key" UNIQUE("workspace_id","category_id","effective_from"),
	CONSTRAINT "budgets_month_start_check" CHECK (extract(day from "budgets"."effective_from") = 1),
	CONSTRAINT "budgets_amount_check" CHECK ("budgets"."amount_cents" is null or "budgets"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_fk" FOREIGN KEY ("workspace_id","category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE no action ON UPDATE no action;