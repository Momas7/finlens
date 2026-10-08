-- RLS da tabela de dispensas (padrão do ADR 0002).
ALTER TABLE rule_suggestion_dismissals ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE rule_suggestion_dismissals FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY rule_suggestion_dismissals_tenant ON rule_suggestion_dismissals
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
