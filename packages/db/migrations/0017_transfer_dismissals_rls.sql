-- RLS das recusas de transferência (padrão do ADR 0002).
ALTER TABLE transfer_dismissals ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE transfer_dismissals FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY transfer_dismissals_tenant ON transfer_dismissals
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
