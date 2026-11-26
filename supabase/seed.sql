-- Gerado por `pnpm --filter @hortilink/backend gerar:seed` a partir de criarExemplo().
-- Dados FICTÍCIOS (senha de todos: 123456). Não editar à mão.
-- Só para banco de DEMONSTRAÇÃO vazio: a trava abaixo recusa rodar no banco oficial.
-- Não cria administrador (veja docs/SPRINT-2.md, passo 2).
do $$
begin
  if exists (select 1 from auth.users where email not like '%@hortilink.com') then
    raise exception 'seed.sql é só para um banco de DEMONSTRAÇÃO vazio. Este banco já tem contas reais: não rode o seed aqui.';
  end if;
end $$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new) values
  ('00000000-0000-0000-0000-000000000000', md5('user-produtor')::uuid, 'authenticated', 'authenticated', 'produtor@hortilink.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"produtor","name":"João Silva","city":"Mogi das Cruzes"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', md5('user-comprador')::uuid, 'authenticated', 'authenticated', 'comprador@hortilink.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"comprador","name":"Marina Costa","city":"Suzano"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', md5('user-loja')::uuid, 'authenticated', 'authenticated', 'loja@hortilink.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"loja","name":"Ana Pereira","city":"Mogi das Cruzes"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', md5('user-produtor-2')::uuid, 'authenticated', 'authenticated', 'carlos@hortilink.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"produtor","name":"Carlos Nunes","city":"Biritiba-Mirim"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', md5('loja-demo-2')::uuid, 'authenticated', 'authenticated', 'loja-demo-2@hortilink.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"loja","name":"Empório Vila Verde","city":"Suzano"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', md5('loja-demo-3')::uuid, 'authenticated', 'authenticated', 'loja-demo-3@hortilink.com', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"loja","name":"Quitanda Recanto","city":"Biritiba-Mirim"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at) values
  (md5('user-produtor')::uuid, md5('user-produtor')::uuid, md5('user-produtor')::uuid::text, 'email', jsonb_build_object('sub', md5('user-produtor')::uuid::text, 'email', 'produtor@hortilink.com'), now(), now()),
  (md5('user-comprador')::uuid, md5('user-comprador')::uuid, md5('user-comprador')::uuid::text, 'email', jsonb_build_object('sub', md5('user-comprador')::uuid::text, 'email', 'comprador@hortilink.com'), now(), now()),
  (md5('user-loja')::uuid, md5('user-loja')::uuid, md5('user-loja')::uuid::text, 'email', jsonb_build_object('sub', md5('user-loja')::uuid::text, 'email', 'loja@hortilink.com'), now(), now()),
  (md5('user-produtor-2')::uuid, md5('user-produtor-2')::uuid, md5('user-produtor-2')::uuid::text, 'email', jsonb_build_object('sub', md5('user-produtor-2')::uuid::text, 'email', 'carlos@hortilink.com'), now(), now()),
  (md5('loja-demo-2')::uuid, md5('loja-demo-2')::uuid, md5('loja-demo-2')::uuid::text, 'email', jsonb_build_object('sub', md5('loja-demo-2')::uuid::text, 'email', 'loja-demo-2@hortilink.com'), now(), now()),
  (md5('loja-demo-3')::uuid, md5('loja-demo-3')::uuid, md5('loja-demo-3')::uuid::text, 'email', jsonb_build_object('sub', md5('loja-demo-3')::uuid::text, 'email', 'loja-demo-3@hortilink.com'), now(), now());

insert into public.stores (id, user_id, name, address, city, hours, status, dry_boxes, cold_boxes) values
  (md5('loja-1')::uuid, md5('user-loja')::uuid, 'Mercado Alto Tietê', 'Rua das Hortênsias, 120', 'Mogi das Cruzes', 'Segunda a sábado, 8h às 18h', 'Aprovada', 20, 10),
  (md5('loja-2')::uuid, md5('loja-demo-2')::uuid, 'Empório Vila Verde', 'Avenida das Palmeiras, 540', 'Suzano', 'Segunda a sexta, 9h às 19h', 'Aprovada', 15, 0),
  (md5('loja-3')::uuid, md5('loja-demo-3')::uuid, 'Quitanda Recanto', 'Rua do Comércio, 45', 'Biritiba-Mirim', 'Terça a domingo, 7h às 13h', 'Pendente', 8, 4);

insert into public.producer_pickup_stores (producer_id, store_id) values
  (md5('user-produtor')::uuid, md5('loja-1')::uuid),
  (md5('user-produtor')::uuid, md5('loja-2')::uuid),
  (md5('user-produtor-2')::uuid, md5('loja-2')::uuid);

insert into public.products (id, producer_id, name, category, unit, price, quantity, min_quantity, photo) values
  (md5('produto-1')::uuid, md5('user-produtor')::uuid, 'Alface crespa', 'Verduras', 'kg', 3.5, 120, 30, 'https://images.unsplash.com/photo-1788710737703-48dee6844122?auto=format&fit=crop&w=900&q=85'),
  (md5('produto-2')::uuid, md5('user-produtor')::uuid, 'Cenoura', 'Raízes', 'kg', 4.2, 85, 20, 'https://images.unsplash.com/photo-1656770314761-76ea0da6a0a6?auto=format&fit=crop&w=900&q=85'),
  (md5('produto-3')::uuid, md5('user-produtor')::uuid, 'Cheiro-verde', 'Temperos', 'mç', 2.5, 40, 50, null),
  (md5('produto-4')::uuid, md5('user-produtor-2')::uuid, 'Tomate italiano', 'Frutas', 'kg', 7.9, 150, 25, 'https://images.unsplash.com/photo-1589483233144-795633bf597c?auto=format&fit=crop&w=900&q=85');

insert into public.offers (id, producer_id, product_id, quantity, promotional_price, city, validity_days, created_at, ended_at) values
  (md5('oferta-1')::uuid, md5('user-produtor')::uuid, md5('produto-1')::uuid, 60, 2.2, 'Mogi das Cruzes', 4, now() - interval '0 seconds', null),
  (md5('oferta-2')::uuid, md5('user-produtor')::uuid, md5('produto-2')::uuid, 0, 3.1, 'Mogi das Cruzes', 2, now() - interval '86400 seconds', null),
  (md5('oferta-3')::uuid, md5('user-produtor')::uuid, md5('produto-3')::uuid, 20, 1.8, 'Mogi das Cruzes', 1, now() - interval '604800 seconds', null);

insert into public.offer_stores (offer_id, store_id) values
  (md5('oferta-1')::uuid, md5('loja-1')::uuid),
  (md5('oferta-1')::uuid, md5('loja-2')::uuid),
  (md5('oferta-2')::uuid, md5('loja-1')::uuid),
  (md5('oferta-3')::uuid, md5('loja-1')::uuid);

insert into public.orders (id, order_number, type, source_id, producer_id, buyer_id, product_id, quantity, unit_price, store_id, status, payment_method, created_at, accepted_at, paid_at, delivered_at) values
  (md5('pedido-1')::uuid, '#HL-000001', 'offer', md5('oferta-1')::uuid, md5('user-produtor')::uuid, md5('user-comprador')::uuid, md5('produto-1')::uuid, 4, 2.2, md5('loja-1')::uuid, 'Aguardando pagamento', null, now() - interval '0 seconds', null, null, null),
  (md5('pedido-2')::uuid, '#HL-000002', 'offer', md5('oferta-1')::uuid, md5('user-produtor')::uuid, md5('user-comprador')::uuid, md5('produto-1')::uuid, 12, 2.2, md5('loja-1')::uuid, 'Pago', 'Pix', now() - interval '604800 seconds', now() - interval '604800 seconds', now() - interval '86400 seconds', null);

insert into public.order_timeline (order_id, label, created_at) values
  (md5('pedido-1')::uuid, 'Pedido realizado', now() - interval '0 seconds'),
  (md5('pedido-2')::uuid, 'Pedido realizado', now() - interval '604800 seconds'),
  (md5('pedido-2')::uuid, 'Pagamento aprovado', now() - interval '86400 seconds');

insert into public.stock_movements (id, type, producer_id, product_id, quantity, unit_cost, reason, note, created_at) values
  (md5('mov-1')::uuid, 'Entrada', md5('user-produtor')::uuid, md5('produto-1')::uuid, 80, 1.1, null, 'Colheita da semana', now() - interval '604800 seconds'),
  (md5('mov-2')::uuid, 'Perda', md5('user-produtor')::uuid, md5('produto-3')::uuid, 6, null, 'Estragou / passou do ponto', '', now() - interval '86400 seconds');

insert into public.expenses (id, producer_id, type, description, amount, created_at) values
  (md5('despesa-1')::uuid, md5('user-produtor')::uuid, 'Custo', 'Adubo orgânico', 85, now() - interval '604800 seconds'),
  (md5('despesa-2')::uuid, md5('user-produtor')::uuid, 'Investimento', 'Sistema de irrigação', 420, now() - interval '86400 seconds');

select setval('public.order_number_seq', 2);
