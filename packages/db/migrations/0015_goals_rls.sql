-- RLS das metas (padrão do ADR 0002).
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE goals FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY goals_tenant ON goals
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
