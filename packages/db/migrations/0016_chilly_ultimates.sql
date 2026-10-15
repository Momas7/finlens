CREATE TABLE "transfer_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"pair_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfer_dismissals_workspace_pair_key" UNIQUE("workspace_id","pair_key")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "transfer_pair_id" uuid;--> statement-breakpoint
ALTER TABLE "transfer_dismissals" ADD CONSTRAINT "transfer_dismissals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_workspace_pair_idx" ON "transactions" USING btree ("workspace_id","transfer_pair_id") WHERE "transactions"."transfer_pair_id" is not null;