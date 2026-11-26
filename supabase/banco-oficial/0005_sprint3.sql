-- =====================================================================
-- HortiLink · Sprint 3 · migration para o BANCO OFICIAL (Supabase da Yara)
-- =====================================================================
-- Como rodar: Supabase → SQL Editor → colar TUDO → Run. Pode rodar mais de
-- uma vez (é idempotente). Rode DEPOIS da 0004 e ANTES de publicar a API desta versão.
--
-- Correções da banca de revisão (docs/SPRINT-3.md):
--  1. Ninguém vira administrador mudando o próprio cadastro: o trigger que
--     bloqueava admin no INSERT passa a valer também no UPDATE (só a
--     service_role, usada pela API e pelo SQL Editor, pode promover).
--  2. Número do pedido único no banco: dois pedidos nunca recebem o mesmo #HL.
--  3. Estoque, preço e quantidade nunca negativos (rede de segurança: a regra
--     principal está no domínio).
--  4. is_admin() com search_path vazio (boa prática para security definer).
--  5. Remove a conta admin@hortilink.com do seed de demonstração, se ela existir.
-- Escritas continuam só pela API (service_role). O cliente só lê.
-- =====================================================================

begin;

-- ---------------------------------------------------------------- 1. Perfil admin só pela service_role
create or replace function public.bloquear_cadastro_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Cadastro nunca cria admin (igual à 0004; o cadastro roda pelo gatilho do Auth).
  if tg_op = 'INSERT' and new.role::text = 'admin' then
    raise exception 'Perfil administrador não pode ser criado pelo cadastro';
  end if;
  -- Trocar o perfil só pelo SQL Editor (postgres) ou pela API (service_role);
  -- o navegador usa anon/authenticated e é recusado.
  if tg_op = 'UPDATE' and new.role::text is distinct from old.role::text
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'O perfil da conta não pode ser alterado pelo aplicativo';
  end if;
  return new;
end;
$$;
drop trigger if exists bloquear_cadastro_admin on public.users;
create trigger bloquear_cadastro_admin before insert or update of role on public.users
  for each row execute function public.bloquear_cadastro_admin();

-- ---------------------------------------------------------------- 2. Número do pedido único
-- Se já houver números repetidos (bug antigo de concorrência), a criação do índice
-- falha e mostra quais são: corrija-os e rode de novo.
do $$
declare
  repetidos text;
begin
  select string_agg(order_number, ', ') into repetidos
    from (select order_number from public.orders group by order_number having count(*) > 1) r;
  if repetidos is not null then
    raise exception 'Há números de pedido repetidos: %. Corrija antes de rodar a 0005.', repetidos;
  end if;
end $$;
create unique index if not exists orders_order_number_unico on public.orders (order_number);

-- ---------------------------------------------------------------- 3. Nunca negativo
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_quantidade_nao_negativa') then
    alter table public.products add constraint products_quantidade_nao_negativa check (quantity >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_preco_positivo') then
    alter table public.products add constraint products_preco_positivo check (price > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'offers_quantidade_nao_negativa') then
    alter table public.offers add constraint offers_quantidade_nao_negativa check (quantity >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_quantidade_positiva') then
    alter table public.orders add constraint orders_quantidade_positiva check (quantity > 0) not valid;
  end if;
end $$;
-- "not valid": vale para gravações novas sem travar a migration por causa de dados antigos.

-- ---------------------------------------------------------------- 4. is_admin() endurecida
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.users where id = auth.uid() and role::text = 'admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------- 5. Conta admin do seed antigo
-- O seed.sql até a Sprint 2 criava admin@hortilink.com com a senha pública 123456.
-- Se ele foi rodado neste banco, a conta é rebaixada para comprador e bloqueada.
update public.users set role = 'comprador' where email = 'admin@hortilink.com' and role::text = 'admin';
update auth.users
   set banned_until = 'infinity'
 where email = 'admin@hortilink.com';

commit;

-- ---------------------------------------------------------------- Conferência (somente leitura)
-- Deve mostrar o trigger para INSERT e UPDATE e o índice único:
select tgname, pg_get_triggerdef(oid) from pg_trigger where tgname = 'bloquear_cadastro_admin';
select indexname from pg_indexes where indexname = 'orders_order_number_unico';
-- Deve voltar vazio (nenhuma conta com a senha pública do seed):
select email from auth.users where email = 'admin@hortilink.com' and (banned_until is null or banned_until < now());
