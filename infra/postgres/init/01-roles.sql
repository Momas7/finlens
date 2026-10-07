-- Roles do Finlens. Executado pelo entrypoint do Postgres (compose) e pelo CI.
-- Senhas abaixo são APENAS para desenvolvimento local.

-- Dono do schema: roda migrations. Não é superuser.
CREATE ROLE finlens_owner LOGIN PASSWORD 'finlens_owner' NOSUPERUSER NOCREATEROLE NOBYPASSRLS;

-- Role da aplicação: só DML, sempre sujeito a RLS.
CREATE ROLE finlens_app LOGIN PASSWORD 'finlens_app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- Extensões em template1 para que databases de teste as herdem.
\connect template1
CREATE EXTENSION IF NOT EXISTS pg_trgm;

\connect postgres
CREATE DATABASE finlens OWNER finlens_owner;
