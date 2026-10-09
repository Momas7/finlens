-- RLS da tabela de orçamentos (padrão do ADR 0002).
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE budgets FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY budgets_tenant ON budgets
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
