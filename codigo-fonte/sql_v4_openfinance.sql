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
