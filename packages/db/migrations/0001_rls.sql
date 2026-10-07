-- Contexto do tenant, definido por transação via set_config(..., true) em withTenant().
CREATE FUNCTION app_user_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;
--> statement-breakpoint
-- Só retorna o workspace se o usuário do contexto for membro dele: um workspace_id
-- errado vindo da aplicação não abre acesso a dados de outro tenant.
CREATE FUNCTION app_workspace_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$
    SELECT m.workspace_id
    FROM workspace_members m
    WHERE m.workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid
      AND m.user_id = app_user_id()
  $$;
--> statement-breakpoint
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY workspaces_tenant ON workspaces
  USING (id = (SELECT app_workspace_id()) OR personal_owner_id = (SELECT app_user_id()))
  WITH CHECK (id = (SELECT app_workspace_id()) OR personal_owner_id = (SELECT app_user_id()));
--> statement-breakpoint
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE workspace_members FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY workspace_members_self ON workspace_members
  USING (user_id = (SELECT app_user_id()))
  WITH CHECK (user_id = (SELECT app_user_id()));
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO finlens_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO finlens_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO finlens_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE finlens_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO finlens_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE finlens_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO finlens_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_user_id(), app_workspace_id() TO finlens_app;
