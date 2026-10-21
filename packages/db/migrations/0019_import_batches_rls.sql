-- RLS dos lotes de importação (padrão do ADR 0002).
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE import_batches FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY import_batches_tenant ON import_batches
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
