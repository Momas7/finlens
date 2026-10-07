CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"system_key" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "categories_workspace_id_system_key_key" UNIQUE("workspace_id","system_key"),
	CONSTRAINT "categories_kind_check" CHECK ("categories"."kind" in ('expense', 'income', 'movement'))
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"institution" text,
	"opening_balance_cents" bigint DEFAULT 0 NOT NULL,
	"opening_balance_date" date,
	"closing_day" smallint,
	"due_day" smallint,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_accounts_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "financial_accounts_type_check" CHECK ("financial_accounts"."type" in ('checking', 'savings', 'cash', 'credit_card')),
	CONSTRAINT "financial_accounts_days_check" CHECK (("financial_accounts"."closing_day" is null or "financial_accounts"."closing_day" between 1 and 31) and ("financial_accounts"."due_day" is null or "financial_accounts"."due_day" between 1 and 31)),
	CONSTRAINT "financial_accounts_type_fields_check" CHECK (("financial_accounts"."type" = 'credit_card' and "financial_accounts"."closing_day" is not null and "financial_accounts"."due_day" is not null)
        or ("financial_accounts"."type" <> 'credit_card' and "financial_accounts"."opening_balance_date" is not null))
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"posted_date" date NOT NULL,
	"statement_month" date,
	"amount_cents" bigint NOT NULL,
	"description" text NOT NULL,
	"notes" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_check" CHECK ("transactions"."amount_cents" <> 0),
	CONSTRAINT "transactions_source_check" CHECK ("transactions"."source" in ('manual'))
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_fk" FOREIGN KEY ("workspace_id","parent_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_fk" FOREIGN KEY ("workspace_id","account_id") REFERENCES "public"."financial_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_fk" FOREIGN KEY ("workspace_id","category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_workspace_date_idx" ON "transactions" USING btree ("workspace_id","posted_date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_workspace_account_date_idx" ON "transactions" USING btree ("workspace_id","account_id","posted_date");