-- =====================================================================
--  NOSSO CAIXA · Esquema do banco (Supabase / PostgreSQL) · versão 3
--  Como usar: Supabase > SQL Editor > New query > cole tudo > Run
--  Pode ser executado de novo sem problema (não apaga dados).
-- =====================================================================

-- ---------- CONTAS ----------
create table if not exists public.contas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome          text not null,
  tipo          text not null default 'corrente',
  saldo_inicial numeric(14,2) not null default 0,
  cor           text not null default '#2f7d6d',
  arquivada     boolean not null default false,
  criado_em     timestamptz not null default now()
);
alter table public.contas add column if not exists considerar_saldo boolean not null default true;
alter table public.contas add column if not exists fechado_ate date;
alter table public.contas drop constraint if exists contas_tipo_check;
alter table public.contas add constraint contas_tipo_check
  check (tipo in ('corrente','poupanca','carteira','investimento','ativos','outra'));

-- ---------- CARTÕES DE CRÉDITO ----------
create table if not exists public.cartoes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome           text not null,
  limite         numeric(14,2) not null default 0,
  dia_fechamento int  not null check (dia_fechamento between 1 and 31),
  dia_vencimento int  not null check (dia_vencimento between 1 and 31),
  conta_id       uuid references public.contas(id) on delete set null,
  cor            text not null default '#6b4fa3',
  arquivado      boolean not null default false,
  criado_em      timestamptz not null default now()
);
alter table public.cartoes add column if not exists titulares text[] not null default '{}';
alter table public.cartoes add column if not exists fechado_ate date;
alter table public.cartoes add column if not exists faturas_fechadas text[] not null default '{}';

-- ---------- CATEGORIAS (com subcategorias) ----------
create table if not exists public.categorias (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome      text not null,
  tipo      text not null check (tipo in ('receita','despesa')),
  cor       text not null default '#888888',
  criado_em timestamptz not null default now()
);
alter table public.categorias add column if not exists parent_id uuid references public.categorias(id) on delete cascade;
alter table public.categorias add column if not exists ativa boolean not null default true;

-- ---------- TAGS ----------
create table if not exists public.tags (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome      text not null,
  cor       text not null default '#5c6bc0',
  criado_em timestamptz not null default now()
);

-- ---------- LANÇAMENTOS ----------
create table if not exists public.lancamentos (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo             text not null check (tipo in ('receita','despesa','transferencia','pagamento_fatura')),
  descricao        text not null,
  valor            numeric(14,2) not null check (valor >= 0),
  data             date not null,
  pago             boolean not null default true,
  categoria_id     uuid references public.categorias(id) on delete set null,
  conta_id         uuid references public.contas(id) on delete cascade,
  conta_destino_id uuid references public.contas(id) on delete cascade,
  cartao_id        uuid references public.cartoes(id) on delete cascade,
  fatura_mes       date,
  grupo_id         uuid,
  parcela          int,
  total_parcelas   int,
  observacao       text,
  criado_por       text,
  criado_em        timestamptz not null default now()
);
alter table public.lancamentos add column if not exists conciliado boolean not null default false;
alter table public.lancamentos add column if not exists tags uuid[] not null default '{}';
alter table public.lancamentos add column if not exists anexos jsonb not null default '[]';
alter table public.lancamentos add column if not exists serie text;      -- 'parcelada' | 'fixa' | 'fixa_fim' | 'detalhado'
alter table public.lancamentos add column if not exists ext_id text;     -- identificador do extrato importado (OFX)
create index if not exists lanc_user_data   on public.lancamentos(user_id, data);
create index if not exists lanc_user_fatura on public.lancamentos(user_id, cartao_id, fatura_mes);
create index if not exists lanc_grupo       on public.lancamentos(grupo_id);

-- ---------- ORÇAMENTO (metas de despesa por categoria e mês) ----------
create table if not exists public.orcamentos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  mes          date not null,
  valor        numeric(14,2) not null check (valor >= 0),
  unique (user_id, categoria_id, mes)
);

-- ---------- METAS DE ECONOMIA ----------
create table if not exists public.metas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null,
  valor_alvo  numeric(14,2) not null check (valor_alvo > 0),
  valor_atual numeric(14,2) not null default 0,
  data_alvo   date,
  cor         text not null default '#c8873a',
  criado_em   timestamptz not null default now()
);
alter table public.metas add column if not exists conta_id uuid references public.contas(id) on delete set null;

-- ---------- REGRAS DE PREENCHIMENTO ----------
create table if not exists public.regras (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo         text not null check (tipo in ('receita','despesa')),
  descricao    text not null,
  palavras     text,
  conta_id     uuid references public.contas(id) on delete cascade,
  cartao_id    uuid references public.cartoes(id) on delete cascade,
  titular      text,
  categoria_id uuid references public.categorias(id) on delete set null,
  tags         uuid[] not null default '{}',
  criado_em    timestamptz not null default now()
);

-- ---------- PREFERÊNCIAS (recursos habilitados, fechamento global) ----------
create table if not exists public.preferencias (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  dados   jsonb not null default '{}'
);

-- =====================================================================
--  SEGURANÇA (Row Level Security): cada login só enxerga os próprios dados
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['contas','cartoes','categorias','tags','lancamentos','orcamentos','metas','regras','preferencias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono_%s" on public.%I', t, t);
    execute format(
      'create policy "dono_%s" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- =====================================================================
--  DOCUMENTOS (anexos): pasta privada por usuário no Storage
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "nc_docs_ler"     on storage.objects;
drop policy if exists "nc_docs_enviar"  on storage.objects;
drop policy if exists "nc_docs_alterar" on storage.objects;
drop policy if exists "nc_docs_apagar"  on storage.objects;
create policy "nc_docs_ler" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "nc_docs_enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "nc_docs_alterar" on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "nc_docs_apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
--  TRAVA: só é possível criar UM login (o do casal).
--  (Para remover a trava: drop trigger limitar_um_usuario on auth.users;)
-- =====================================================================
create or replace function public.limitar_um_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from auth.users) >= 1 then
    raise exception 'NOSSO_CAIXA_JA_TEM_ACESSO';
  end if;
  return new;
end $$;
drop trigger if exists limitar_um_usuario on auth.users;
create trigger limitar_um_usuario before insert on auth.users
  for each row execute function public.limitar_um_usuario();
-- =====================================================================
--  NOSSO CAIXA v4 · OPEN FINANCE (Pluggy / Meu Pluggy)
--  Pode rodar quantas vezes quiser (não apaga nada).
-- =====================================================================
create table if not exists public.pluggy_contas (
  id            text primary key,                 -- id da conta na Pluggy
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id       text not null,
  nome          text,
  tipo          text,                             -- BANK | CREDIT
  numero        text,
  conta_id      uuid references public.contas(id)  on delete set null,
  cartao_id     uuid references public.cartoes(id) on delete set null,
  ativo         boolean not null default true,
  atualizado_em timestamptz
);
create table if not exists public.pluggy_execucoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  inicio      timestamptz not null default now(),
  fim         timestamptz,
  origem      text,
  novos       int default 0,
  conciliados int default 0,
  ignorados   int default 0,
  erro        text
);
create index if not exists lanc_user_ext on public.lancamentos(user_id, ext_id);
do $$ declare t text; begin
  foreach t in array array['pluggy_contas','pluggy_execucoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono_%s" on public.%I', t, t);
    execute format('create policy "dono_%s" on public.%I for all to authenticated
       using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- ---------- agendamento automático (a cada 6 horas) ----------
create extension if not exists pg_net;
create extension if not exists pg_cron;
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;
create table if not exists privado.config (chave text primary key, valor text not null);
insert into privado.config values ('cron', encode(extensions.gen_random_bytes(24), 'hex')) on conflict (chave) do nothing;

create or replace function public.nc_cron_ok(t text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from privado.config where chave = 'cron' and valor = t)
$$;
revoke all on function public.nc_cron_ok(text) from public, anon, authenticated;
grant execute on function public.nc_cron_ok(text) to service_role;

create or replace function public.nc_disparar_pluggy() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url     := 'https://cuhrhtkwfuwgsvsdrkng.supabase.co/functions/v1/pluggy-sync',
    headers := jsonb_build_object('Content-Type','application/json',
                 'x-nc-cron', (select valor from privado.config where chave = 'cron')),
    body    := '{"acao":"sincronizar"}'::jsonb,
    timeout_milliseconds := 120000);
end $$;
revoke all on function public.nc_disparar_pluggy() from public, anon, authenticated;

select cron.unschedule('nosso-caixa-pluggy') where exists (select 1 from cron.job where jobname = 'nosso-caixa-pluggy');
select cron.schedule('nosso-caixa-pluggy', '15 9,15,21,3 * * *', 'select public.nc_disparar_pluggy()');

-- ---------- cofre da chave da Pluggy (só a função do servidor lê) ----------
create or replace function public.nc_pluggy_cred() returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('id', (select valor from privado.config where chave = 'pluggy_id'),
                            'secret', (select valor from privado.config where chave = 'pluggy_secret'))
$$;
create or replace function public.nc_pluggy_cred_salvar(cid text, csecret text) returns void
language sql security definer set search_path = public as $$
  insert into privado.config values ('pluggy_id', cid), ('pluggy_secret', csecret)
  on conflict (chave) do update set valor = excluded.valor
$$;
revoke all on function public.nc_pluggy_cred() from public, anon, authenticated;
revoke all on function public.nc_pluggy_cred_salvar(text, text) from public, anon, authenticated;
grant execute on function public.nc_pluggy_cred() to service_role;
grant execute on function public.nc_pluggy_cred_salvar(text, text) to service_role;

-- ---------- configurações privadas genéricas (Telegram) e resumo diário às 8h ----------
create or replace function public.nc_cfg_get(k text) returns text
language sql security definer set search_path = public as $$ select valor from privado.config where chave = k $$;
create or replace function public.nc_cfg_set(k text, v text) returns void
language sql security definer set search_path = public as $$
  insert into privado.config values (k, v) on conflict (chave) do update set valor = excluded.valor $$;
revoke all on function public.nc_cfg_get(text) from public, anon, authenticated;
revoke all on function public.nc_cfg_set(text, text) from public, anon, authenticated;
grant execute on function public.nc_cfg_get(text) to service_role;
grant execute on function public.nc_cfg_set(text, text) to service_role;

create or replace function public.nc_disparar(acao text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url     := 'https://cuhrhtkwfuwgsvsdrkng.supabase.co/functions/v1/pluggy-sync',
    headers := jsonb_build_object('Content-Type','application/json',
                 'x-nc-cron', (select valor from privado.config where chave = 'cron')),
    body    := jsonb_build_object('acao', acao),
    timeout_milliseconds := 120000);
end $$;
revoke all on function public.nc_disparar(text) from public, anon, authenticated;
-- 7h50 sincroniza, 8h00 envia o resumo (horário de Brasília = UTC-3)
select cron.unschedule('nosso-caixa-presync') where exists (select 1 from cron.job where jobname = 'nosso-caixa-presync');
select cron.unschedule('nosso-caixa-resumo')  where exists (select 1 from cron.job where jobname = 'nosso-caixa-resumo');
select cron.schedule('nosso-caixa-presync', '50 10 * * *', 'select public.nc_disparar(''sincronizar'')');
select cron.schedule('nosso-caixa-resumo',  '0 11 * * *',  'select public.nc_disparar(''relatorio'')');

-- ---------- resumo também às 18h (17h50 sincroniza) ----------
select cron.unschedule('nosso-caixa-presync-18') where exists (select 1 from cron.job where jobname = 'nosso-caixa-presync-18');
select cron.unschedule('nosso-caixa-resumo-18')  where exists (select 1 from cron.job where jobname = 'nosso-caixa-resumo-18');
select cron.schedule('nosso-caixa-presync-18', '50 20 * * *', 'select public.nc_disparar(''sincronizar'')');
select cron.schedule('nosso-caixa-resumo-18',  '0 21 * * *',  'select public.nc_disparar(''relatorio'')');
