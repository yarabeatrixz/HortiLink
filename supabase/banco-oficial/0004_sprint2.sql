-- =====================================================================
-- HortiLink · Sprint 2 · migration para o BANCO OFICIAL (Supabase da Yara)
-- =====================================================================
-- Como rodar: Supabase → SQL Editor → colar TUDO → Run. Pode rodar mais de
-- uma vez (é idempotente). Rode ANTES de publicar a API/site desta versão.
--
-- O que muda:
--  1. COMP-01 · usuários logados enxergam id, nome, perfil e cidade dos outros
--     (sem e-mail). Era isso que escondia os produtores do comprador.
--  2. Perfil "admin" (Administrador). Ninguém vira admin pelo cadastro: a conta
--     é promovida aqui no SQL (passo 9, no fim do arquivo).
--  3. Lojas: status (Pendente/Aprovada/Reprovada/Suspensa), motivo, foto e
--     capacidade (caixas secas e refrigeradas). Lojas existentes = Aprovada.
--  4. Pedidos: data da retirada (picked_up_at) e status/eventos de retirada.
--  5. Recompensa das lojas: regra (reward_settings) e fechamentos (reward_payouts).
--  6. RLS: o admin lê pedidos e fechamentos; cada loja lê os próprios fechamentos.
-- Escritas continuam só pela API (service_role). O cliente só lê.
-- =====================================================================

begin;

-- ---------------------------------------------------------------- 0. Função "é admin?"
-- security definer: consulta users sem passar pelo RLS (evita recursão nas policies).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and role::text = 'admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------- 1. COMP-01: perfis públicos
alter table public.users enable row level security;
drop policy if exists "usuarios logados veem perfis publicos" on public.users;
create policy "usuarios logados veem perfis publicos" on public.users
  for select to authenticated using (true);
-- O e-mail continua escondido: o cliente só pode ler estas 4 colunas.
revoke select on public.users from anon, authenticated;
grant select (id, role, name, city) on public.users to authenticated;

-- ---------------------------------------------------------------- 2. Perfil admin
do $$
declare
  restricao record;
  tipo_role text;
begin
  select udt_name into tipo_role
    from information_schema.columns
   where table_schema = 'public' and table_name = 'users' and column_name = 'role';

  if tipo_role is not null and tipo_role not in ('text', 'varchar', 'bpchar') then
    -- role é um ENUM: acrescenta o valor.
    execute format('alter type public.%I add value if not exists %L', tipo_role, 'admin');
  else
    -- role é texto com CHECK: troca o CHECK por um que aceita admin.
    for restricao in
      select conname from pg_constraint
       where conrelid = 'public.users'::regclass and contype = 'c'
         and pg_get_constraintdef(oid) ilike '%role%'
    loop
      execute format('alter table public.users drop constraint %I', restricao.conname);
    end loop;
    alter table public.users add constraint users_role_check
      check (role in ('produtor', 'comprador', 'loja', 'admin'));
  end if;
end $$;

-- Cadastro (Auth → gatilho que cria o users) NUNCA cria admin, mesmo que alguém
-- mande role=admin nos metadados. Admin só por UPDATE feito aqui no SQL.
create or replace function public.bloquear_cadastro_admin()
returns trigger
language plpgsql
as $$
begin
  if new.role::text = 'admin' then
    raise exception 'Perfil administrador não pode ser criado pelo cadastro';
  end if;
  return new;
end;
$$;
drop trigger if exists bloquear_cadastro_admin on public.users;
create trigger bloquear_cadastro_admin before insert on public.users
  for each row execute function public.bloquear_cadastro_admin();

-- ---------------------------------------------------------------- 3. Lojas
alter table public.stores add column if not exists status      text;
alter table public.stores add column if not exists review_note text;
alter table public.stores add column if not exists reviewed_at timestamptz;
alter table public.stores add column if not exists photo       text;
alter table public.stores add column if not exists dry_boxes   integer not null default 0;
alter table public.stores add column if not exists cold_boxes  integer not null default 0;

-- Lojas que já existiam continuam valendo; as novas entram como Pendente.
update public.stores set status = 'Aprovada' where status is null;
alter table public.stores alter column status set default 'Pendente';
alter table public.stores alter column status set not null;

alter table public.stores drop constraint if exists stores_status_check;
alter table public.stores add constraint stores_status_check
  check (status in ('Pendente', 'Aprovada', 'Reprovada', 'Suspensa'));
alter table public.stores drop constraint if exists stores_capacidade_check;
alter table public.stores add constraint stores_capacidade_check
  check (dry_boxes >= 0 and cold_boxes >= 0);
-- Foto: base64 de até ~1 MB (a API já limita o tamanho).
alter table public.stores drop constraint if exists stores_photo_check;
alter table public.stores add constraint stores_photo_check
  check (photo is null or length(photo) <= 1400000);

-- Um ponto de coleta por usuário (LOJA-02: impede duplicidade no banco também).
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and tablename = 'stores'
       and indexdef ilike '%unique%(user_id)%'
  ) and not exists (
    select user_id from public.stores group by user_id having count(*) > 1
  ) then
    create unique index stores_user_id_unico on public.stores (user_id);
  end if;
end $$;

-- ---------------------------------------------------------------- 4. Pedidos
alter table public.orders add column if not exists picked_up_at timestamptz;

-- Se houver CHECK em orders.status ou order_timeline.label, garante os valores da retirada.
do $$
declare
  restricao record;
begin
  for restricao in
    select conname from pg_constraint
     where conrelid = 'public.orders'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint %I', restricao.conname);
  end loop;
  alter table public.orders add constraint orders_status_check check (status in (
    'Aguardando pagamento', 'Pago', 'Entregue na loja', 'Pronto para retirada', 'Retirado', 'Cancelado'));

  for restricao in
    select conname from pg_constraint
     where conrelid = 'public.order_timeline'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%label%'
  loop
    execute format('alter table public.order_timeline drop constraint %I', restricao.conname);
  end loop;
end $$;

-- ---------------------------------------------------------------- 5. Recompensa das lojas
create table if not exists public.reward_settings (
  id           smallint primary key default 1 check (id = 1),
  fixed_amount numeric(12, 2) not null default 0 check (fixed_amount >= 0),
  percent      numeric(5, 2)  not null default 0 check (percent between 0 and 100),
  updated_at   timestamptz not null default now()
);
insert into public.reward_settings (id, fixed_amount, percent) values (1, 1.00, 5.00)
  on conflict (id) do nothing;

create table if not exists public.reward_payouts (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  month        text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  orders_count integer not null check (orders_count > 0),
  sales_total  numeric(12, 2) not null check (sales_total >= 0),
  amount       numeric(12, 2) not null check (amount >= 0),
  created_at   timestamptz not null default now(),
  unique (store_id, month)
);

-- Padrão de segurança para tabela nova: RLS ligado e forçado, nada para anon,
-- authenticated só lê, service_role (API) escreve.
alter table public.reward_settings enable row level security;
alter table public.reward_settings force row level security;
alter table public.reward_payouts  enable row level security;
alter table public.reward_payouts  force row level security;
revoke all on public.reward_settings, public.reward_payouts from anon, authenticated;
grant select on public.reward_settings, public.reward_payouts to authenticated;
grant select, insert, update, delete on public.reward_settings, public.reward_payouts to service_role;

drop policy if exists "logados veem a regra de recompensa" on public.reward_settings;
create policy "logados veem a regra de recompensa" on public.reward_settings
  for select to authenticated using (true);

drop policy if exists "loja ve seus fechamentos e admin ve todos" on public.reward_payouts;
create policy "loja ve seus fechamentos e admin ve todos" on public.reward_payouts
  for select to authenticated using (
    public.is_admin()
    or exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
  );

-- ---------------------------------------------------------------- 6. Admin lê pedidos
-- Policies somam (OR) com as que já existem: os envolvidos continuam vendo os seus.
drop policy if exists "admin ve todos os pedidos" on public.orders;
create policy "admin ve todos os pedidos" on public.orders
  for select to authenticated using (public.is_admin());

drop policy if exists "admin ve todas as linhas do tempo" on public.order_timeline;
create policy "admin ve todas as linhas do tempo" on public.order_timeline
  for select to authenticated using (public.is_admin());

-- A loja precisa ver os pedidos que serão retirados nela (US10).
drop policy if exists "loja ve pedidos do seu ponto" on public.orders;
create policy "loja ve pedidos do seu ponto" on public.orders
  for select to authenticated using (
    exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
  );

drop policy if exists "loja ve a linha do tempo dos seus pedidos" on public.order_timeline;
create policy "loja ve a linha do tempo dos seus pedidos" on public.order_timeline
  for select to authenticated using (
    exists (
      select 1 from public.orders o join public.stores s on s.id = o.store_id
       where o.id = order_id and s.user_id = auth.uid()
    )
  );

commit;

-- ---------------------------------------------------------------- 9. Criar o administrador
-- 1) Cadastre a pessoa normalmente no site (qualquer perfil, ex.: comprador).
-- 2) Troque o e-mail abaixo e rode SÓ esta linha:
-- update public.users set role = 'admin' where email = 'EMAIL_DO_ADMIN@exemplo.com';

-- ---------------------------------------------------------------- Conferência (somente leitura)
-- select column_name from information_schema.columns where table_name = 'stores' order by 1;
-- select * from public.reward_settings;
-- select id, name, role from public.users order by role;
