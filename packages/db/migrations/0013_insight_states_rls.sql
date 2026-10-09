-- RLS do estado dos insights (padrão do ADR 0002).
ALTER TABLE insight_states ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE insight_states FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY insight_states_tenant ON insight_states
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
