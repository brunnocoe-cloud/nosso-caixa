-- Nosso Caixa · 17/11/2026 · impedir que o mesmo lançamento da Pluggy entre duas vezes
-- Rodar UMA vez no SQL Editor do Supabase, DEPOIS de publicar a função pluggy-sync de 17/11
-- (que já não tem unificar_faturas e trata o erro de duplicado). Não faz parte do schema.sql.

-- 1) Conferir: tem de voltar vazio. Se vier alguma linha, pare e resolva os duplicados antes do passo 2.
select user_id, ext_id, count(*) as vezes, array_agg(id order by criado_em) as ids
from public.lancamentos
where ext_id like 'pluggy:%'
group by user_id, ext_id
having count(*) > 1;

-- 2) Índice único só para os ids da Pluggy. Os da importação OFX (FITID) ficam de fora,
--    porque o mesmo FITID pode se repetir entre bancos. O índice antigo lanc_user_ext continua.
create unique index if not exists lanc_user_ext_pluggy
  on public.lancamentos (user_id, ext_id)
  where ext_id like 'pluggy:%';

-- 3) Conferir que foi criado:
select indexname, indexdef from pg_indexes where tablename = 'lancamentos' and indexname = 'lanc_user_ext_pluggy';
