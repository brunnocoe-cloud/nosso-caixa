-- Nosso Caixa · retrato do que só existe no Supabase. SÓ LEITURA. Rodar no SQL Editor.
-- Não traz valores do cofre (só os nomes das chaves) nem dados de lançamentos (só contagens).
-- Salve o resultado em Documents\Nosso Caixa\privado\supabase-estado.json (fora do GitHub).
select jsonb_build_object(
 'tirado_em', now(),
 'cron', (select jsonb_agg(jsonb_build_object('nome',jobname,'agenda',schedule,'comando',command,'ativo',active) order by jobname) from cron.job),
 'cofre_chaves_sem_valores', (select jsonb_agg(chave order by chave) from privado.config),
 'politicas_rls', (select jsonb_agg(jsonb_build_object('tabela',tablename,'nome',policyname,'cmd',cmd,'using',qual,'check',with_check) order by tablename, policyname) from pg_policies where schemaname='public'),
 'rls_ligado', (select jsonb_object_agg(relname, relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'gatilhos', (select jsonb_agg(distinct jsonb_build_object('esquema',event_object_schema,'tabela',event_object_table,'nome',trigger_name,'acao',action_statement)) from information_schema.triggers where trigger_schema in ('public','auth')),
 'indices', (select jsonb_agg(jsonb_build_object('nome',indexname,'def',indexdef) order by indexname) from pg_indexes where schemaname='public'),
 'funcoes', (select jsonb_agg(jsonb_build_object('nome',p.proname,'args',pg_get_function_arguments(p.oid),'security_definer',p.prosecdef) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'tabelas', (select jsonb_object_agg(table_schema||'.'||table_name, cols) from (select table_schema, table_name, jsonb_agg(column_name||' '||data_type||case when is_nullable='NO' then ' not null' else '' end order by ordinal_position) cols from information_schema.columns where table_schema in ('public','privado') group by table_schema, table_name) t),
 'extensoes', (select jsonb_agg(extname order by extname) from pg_extension),
 'contagens', (select jsonb_build_object('lancamentos',(select count(*) from public.lancamentos),'categorias',(select count(*) from public.categorias),'regras',(select count(*) from public.regras),'cartoes',(select count(*) from public.cartoes),'contas',(select count(*) from public.contas)))
)::text as estado;
