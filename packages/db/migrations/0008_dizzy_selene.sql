CREATE TABLE "rule_suggestion_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"suggestion_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_suggestion_dismissals_workspace_suggestion_key" UNIQUE("workspace_id","suggestion_id")
);
--> statement-breakpoint
ALTER TABLE "rule_suggestion_dismissals" ADD CONSTRAINT "rule_suggestion_dismissals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;