-- Lançamentos da F1a: categoria escolhida pelo usuário vira "confirmed". A normalização aqui é
-- simplificada; o próximo PATCH recalcula com a função completa do domínio.
-- FORCE RLS vale também para o dono da tabela: sem desligar, o UPDATE não enxerga nenhuma linha.
ALTER TABLE transactions NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
UPDATE transactions SET
  description_normalized = upper(regexp_replace(trim(description), '\s+', ' ', 'g')),
  classification_status = CASE WHEN category_id IS NULL THEN 'none' ELSE 'confirmed' END,
  classification_source = CASE WHEN category_id IS NULL THEN NULL ELSE 'user' END,
  classification_confidence = CASE WHEN category_id IS NULL THEN NULL ELSE 1 END
WHERE description_normalized = '';
--> statement-breakpoint
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
