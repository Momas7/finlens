-- RLS das tabelas de classificação (padrão do ADR 0002).
ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE classification_rules FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY classification_rules_tenant ON classification_rules
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
--> statement-breakpoint
ALTER TABLE classification_feedback ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE classification_feedback FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY classification_feedback_tenant ON classification_feedback
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
--> statement-breakpoint
-- Feedback sobrevive à exclusão do lançamento: só a coluna transaction_id vira nula.
ALTER TABLE classification_feedback
  ADD CONSTRAINT classification_feedback_transaction_fk
  FOREIGN KEY (workspace_id, transaction_id) REFERENCES transactions (workspace_id, id)
  ON DELETE SET NULL (transaction_id);
