-- RLS das tabelas financeiras (padrão do ADR 0002). Grants vêm dos default privileges da 0001.
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE financial_accounts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY financial_accounts_tenant ON financial_accounts
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
--> statement-breakpoint
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY categories_tenant ON categories
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
--> statement-breakpoint
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY transactions_tenant ON transactions
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
