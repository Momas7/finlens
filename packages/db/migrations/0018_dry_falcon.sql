CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"file_sha256" text NOT NULL,
	"filename" text NOT NULL,
	"format" text NOT NULL,
	"status" text NOT NULL,
	"rows" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	CONSTRAINT "import_batches_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "import_batches_status_check" CHECK ("import_batches"."status" in ('preview', 'committed')),
	CONSTRAINT "import_batches_format_check" CHECK ("import_batches"."format" in ('ofx', 'csv'))
);
--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_source_check";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "import_key" text;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_fk" FOREIGN KEY ("workspace_id","account_id") REFERENCES "public"."financial_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_batches_committed_sha_idx" ON "import_batches" USING btree ("workspace_id","file_sha256") WHERE "import_batches"."status" = 'committed';--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_workspace_import_key_idx" ON "transactions" USING btree ("workspace_id","import_key") WHERE "transactions"."import_key" is not null;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_check" CHECK ("transactions"."source" in ('manual', 'import'));