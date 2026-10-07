CREATE TABLE "classification_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"transaction_id" uuid,
	"predicted_category_id" uuid,
	"predicted_confidence" numeric(4, 3),
	"predicted_source" text,
	"chosen_category_id" uuid,
	"merchant_key" text,
	"description_normalized" text NOT NULL,
	"amount_bucket" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classification_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"pattern" text NOT NULL,
	"min_amount_cents" bigint,
	"max_amount_cents" bigint,
	"account_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "description_normalized" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "merchant_key" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "classification_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "classification_source" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "classification_confidence" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "classification_explanation" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "suggested_category_id" uuid;--> statement-breakpoint
ALTER TABLE "classification_feedback" ADD CONSTRAINT "classification_feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_feedback" ADD CONSTRAINT "classification_feedback_predicted_fk" FOREIGN KEY ("workspace_id","predicted_category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_feedback" ADD CONSTRAINT "classification_feedback_chosen_fk" FOREIGN KEY ("workspace_id","chosen_category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_category_fk" FOREIGN KEY ("workspace_id","category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_account_fk" FOREIGN KEY ("workspace_id","account_id") REFERENCES "public"."financial_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classification_feedback_workspace_idx" ON "classification_feedback" USING btree ("workspace_id","created_at");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_suggested_category_fk" FOREIGN KEY ("workspace_id","suggested_category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_sibling_name_idx" ON "categories" USING btree ("workspace_id",coalesce("parent_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("name")) WHERE "categories"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "transactions_description_trgm_idx" ON "transactions" USING gin ("description_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "transactions_workspace_merchant_idx" ON "transactions" USING btree ("workspace_id","merchant_key");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspace_id_id_key" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_classification_status_check" CHECK ("transactions"."classification_status" in ('auto', 'likely', 'suggested', 'confirmed', 'none'));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_classification_source_check" CHECK ("transactions"."classification_source" is null or "transactions"."classification_source" in ('rule', 'history', 'similar', 'merchant', 'keyword', 'user'));