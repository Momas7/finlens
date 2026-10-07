-- A policy única de workspace_members permitia que um usuário se inserisse em qualquer
-- workspace (e com qualquer role), o que anulava a checagem de app_workspace_id().
-- Separa leitura e escrita: o usuário só lê as próprias memberships e só pode se inserir
-- como owner do próprio workspace pessoal. UPDATE e DELETE não têm policy (negados);
-- convites entram depois com uma função dedicada.
DROP POLICY workspace_members_self ON workspace_members;
--> statement-breakpoint
CREATE POLICY workspace_members_select ON workspace_members
  FOR SELECT
  USING (user_id = (SELECT app_user_id()));
--> statement-breakpoint
CREATE POLICY workspace_members_insert_personal ON workspace_members
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT app_user_id())
    AND role = 'owner'
    AND workspace_id IN (SELECT id FROM workspaces WHERE personal_owner_id = (SELECT app_user_id()))
  );
