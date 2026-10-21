# F7: 2FA e registro de atividade

> Status: aprovado em 2026-10-20.

## Objetivo

Proteger a conta com segundo fator (TOTP) e deixar a pessoa ver o que aconteceu nela.

## 2FA por aplicativo autenticador

Usa o plugin `twoFactor` do Better Auth (emissor "Finlens"), com a tabela `two_factor` e `user.two_factor_enabled`.

- **Ativar** (Sua conta → Segurança): senha → QR code, chave para digitar à mão e 10 códigos de reserva. Só passa a valer depois de um código de 6 dígitos correto. Enquanto não verificado, o login não pede 2FA.
- **Desativar** e **gerar novos códigos de reserva** pedem a senha; os códigos antigos deixam de valer.
- **Login:** e-mail e senha; se a conta tem 2FA, a resposta pede o segundo passo (sem sessão ainda). A tela mostra o campo do código de 6 dígitos e o link "Usar código de reserva". Código errado mostra "Código inválido."; o plugin trava a conta após 10 falhas seguidas (padrão).
- O QR code é gerado no navegador (`qrcode`); nada sai para terceiros.
- Sem "confiar neste dispositivo". A exclusão de conta continua pedindo só a senha.
- As rotas de 2FA usam o limite de tentativas das rotas de autenticação.

## Registro de atividade

- **Tabela `audit_logs`:** `id`, `user_id` (FK com cascata), `event`, `ip`, `user_agent`, `meta` (jsonb, só dados mínimos), `created_at`. RLS `ENABLE` e `FORCE` com política por `app_user_id()`. Nada de valor, descrição ou senha.
- **Eventos:** `sign_in` (sessão criada, já depois do 2FA), `two_factor_enabled`, `two_factor_disabled`, `backup_codes_regenerated`, `data_exported` (`meta.format`: `json` | `csv`), `import_committed` (`meta.imported`).
- A exclusão de conta não é gravada na tabela (sumiria com a conta); continua só no log do servidor.
- Gravação é best-effort: falha no registro nunca derruba a ação. Ao gravar, eventos com mais de 180 dias da mesma pessoa são removidos.
- **API:** `GET /v1/me/activity` → últimos 20 eventos `{ id, event, ip, createdAt, meta }`, do mais novo ao mais antigo. O export JSON ganha a coleção `auditLogs`.
- O IP vem da conexão ou do `X-Forwarded-For` de proxies em `TRUSTED_PROXIES`; sem isso, atrás do Next aparece o IP do Next. O README avisa.

## Tela (Sua conta)

- **Segurança:** estado do 2FA ("Ativado" ou "Desativado") e os botões do fluxo acima. Os códigos de reserva aparecem uma vez, com "Baixar" e "Copiar".
- **Atividade recente:** tabela acessível (data, o que foi, IP) com as frases: "Entrou na conta", "Ativou o 2FA", "Desativou o 2FA", "Gerou novos códigos de reserva", "Exportou os dados (JSON)", "Exportou os lançamentos (CSV)", "Importou N lançamentos".

## Testes

- **Integração:** ativar com TOTP gerado no teste; sem verificar não vale; login pede o segundo passo e só dá sessão com código certo; código errado; código de reserva funciona uma vez; desativar e regerar exigem senha; eventos gravados com IP; isolamento entre usuários; export traz `auditLogs`; exclusão da conta apaga os registros; `two_factor` fora da checagem de RLS (tabela do Better Auth).
- **E2E:** ativar com o código, sair, entrar com 2FA, entrar com código de reserva, desativar; atividade lista os eventos; axe em Sua conta (com 2FA ativo e inativo) e no segundo passo do login, nos dois temas.

## Fora de escopo

Falhas de login no registro, alertas por e-mail, sessões ativas e "sair de todos", WebAuthn, 2FA por e-mail ou SMS, "confiar neste dispositivo", exigir 2FA para excluir a conta.
