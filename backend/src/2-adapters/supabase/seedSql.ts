// Converte o Estado do domínio (dados fictícios de exemplo) em SQL de seed para
// o Supabase, seguindo supabase/migrations/0001_schema.sql.
//
// • Ids do domínio ("produto-1") viram UUIDs determinísticos: md5('produto-1')::uuid.
// • Datas viram `now() - interval`, relativas ao momento em que o seed roda,
//   para ofertas e relatórios continuarem coerentes.
// • Usuários são criados no Supabase Auth; o trigger da migration cria o profile.

import type { Estado, Usuario } from "@hortilink/dominio";

const SENHA_DEMONSTRACAO = "123456";

const texto = (valor: string): string => `'${valor.replaceAll("'", "''")}'`;
const uuid = (id: string): string => `md5(${texto(id)})::uuid`;
const nulo = <T>(valor: T | undefined, formatar: (v: T) => string): string =>
  valor === undefined ? "null" : formatar(valor);

/** Data do exemplo → expressão relativa ao `now()` do banco. */
function quando(iso: string, referencia: Date): string {
  const segundos = Math.round((referencia.getTime() - new Date(iso).getTime()) / 1000);
  return `now() - interval '${segundos} seconds'`;
}

function insert(tabela: string, colunas: string[], linhas: string[][]): string {
  if (!linhas.length) return "";
  const valores = linhas.map((linha) => `  (${linha.join(", ")})`).join(",\n");
  return `insert into ${tabela} (${colunas.join(", ")}) values\n${valores};\n`;
}

/** Lojas do exemplo cujo dono não está em `users` ganham um usuário "loja" fictício. */
function usuariosComDonosDeLoja(estado: Estado): Usuario[] {
  const ids = new Set(estado.users.map((usuario) => usuario.id));
  const donosFaltando: Usuario[] = estado.stores
    .filter((loja) => !ids.has(loja.userId))
    .map((loja) => ({
      id: loja.userId,
      role: "loja",
      name: loja.name,
      city: loja.city,
      email: `${loja.userId}@hortilink.com`,
    }));
  return [...estado.users, ...donosFaltando];
}

/**
 * Aborta se o banco já tem contas reais (e-mail fora de @hortilink.com): o seed é só
 * para um banco de demonstração vazio, nunca para o oficial (achado 6 da banca).
 */
const TRAVA_BANCO_REAL = `do $$
begin
  if exists (select 1 from auth.users where email not like '%@hortilink.com') then
    raise exception 'seed.sql é só para um banco de DEMONSTRAÇÃO vazio. Este banco já tem contas reais: não rode o seed aqui.';
  end if;
end $$;
`;

export function gerarSeedSql(estado: Estado, referencia: Date): string {
  // Sem administrador no seed (Sprint 3): uma conta admin com senha pública no
  // repositório daria controle total a quem lesse o código. O admin é criado à mão
  // (passo 2 de docs/SPRINT-2.md), com senha própria.
  const usuarios = usuariosComDonosDeLoja(estado).filter((u) => u.role !== "admin");
  const metadados = (u: Usuario) => texto(JSON.stringify({ role: u.role, name: u.name, city: u.city }));

  const partes = [
    "-- Gerado por `pnpm --filter @hortilink/backend gerar:seed` a partir de criarExemplo().",
    "-- Dados FICTÍCIOS (senha de todos: 123456). Não editar à mão.",
    "-- Só para banco de DEMONSTRAÇÃO vazio: a trava abaixo recusa rodar no banco oficial.",
    "-- Não cria administrador (veja docs/SPRINT-2.md, passo 2).",
    "",
    TRAVA_BANCO_REAL,
    insert(
      "auth.users",
      ["instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "raw_app_meta_data", "raw_user_meta_data", "created_at", "updated_at",
        // O Auth do Supabase espera texto vazio (não NULL) nestes campos; com NULL o login falha
        // com "Database error querying schema".
        "confirmation_token", "recovery_token", "email_change", "email_change_token_new"],
      usuarios.map((u) => [
        "'00000000-0000-0000-0000-000000000000'",
        uuid(u.id),
        "'authenticated'",
        "'authenticated'",
        texto(u.email),
        `crypt(${texto(SENHA_DEMONSTRACAO)}, gen_salt('bf'))`,
        "now()",
        `'{"provider":"email","providers":["email"]}'`,
        metadados(u),
        "now()",
        "now()",
        "''",
        "''",
        "''",
        "''",
      ]),
    ),
    insert(
      "auth.identities",
      ["id", "user_id", "provider_id", "provider", "identity_data", "created_at", "updated_at"],
      usuarios.map((u) => [
        uuid(u.id),
        uuid(u.id),
        `${uuid(u.id)}::text`,
        "'email'",
        `jsonb_build_object('sub', ${uuid(u.id)}::text, 'email', ${texto(u.email)})`,
        "now()",
        "now()",
      ]),
    ),
    insert(
      "public.stores",
      ["id", "user_id", "name", "address", "city", "hours", "status", "dry_boxes", "cold_boxes"],
      estado.stores.map((s) => [
        uuid(s.id), uuid(s.userId), texto(s.name), texto(s.address), texto(s.city), texto(s.hours),
        texto(s.status), String(s.dryBoxes), String(s.coldBoxes),
      ]),
    ),
    insert(
      "public.producer_pickup_stores",
      ["producer_id", "store_id"],
      estado.users.flatMap((u) => (u.pickupStoreIds ?? []).map((storeId) => [uuid(u.id), uuid(storeId)])),
    ),
    insert(
      "public.products",
      ["id", "producer_id", "name", "category", "unit", "price", "quantity", "min_quantity", "photo"],
      estado.products.map((p) => [
        uuid(p.id), uuid(p.producerId), texto(p.name), texto(p.category), texto(p.unit),
        String(p.price), String(p.quantity), String(p.minQuantity ?? 0), p.photo ? texto(p.photo) : "null",
      ]),
    ),
    insert(
      "public.offers",
      ["id", "producer_id", "product_id", "quantity", "promotional_price", "city", "validity_days", "created_at", "ended_at"],
      estado.offers.map((o) => [
        uuid(o.id), uuid(o.producerId), uuid(o.productId), String(o.quantity), String(o.promotionalPrice),
        texto(o.city), String(o.validityDays), quando(o.createdAt, referencia),
        nulo(o.endedAt, (data) => quando(data, referencia)),
      ]),
    ),
    insert(
      "public.offer_stores",
      ["offer_id", "store_id"],
      estado.offers.flatMap((o) => o.storeIds.map((storeId) => [uuid(o.id), uuid(storeId)])),
    ),
    insert(
      "public.orders",
      ["id", "order_number", "type", "source_id", "producer_id", "buyer_id", "product_id", "quantity", "unit_price", "store_id", "status", "payment_method", "created_at", "accepted_at", "paid_at", "delivered_at"],
      estado.orders.map((o) => [
        uuid(o.id), texto(o.orderNumber), texto(o.type), uuid(o.sourceId), uuid(o.producerId), uuid(o.buyerId),
        uuid(o.productId), String(o.quantity), String(o.unitPrice), uuid(o.storeId), texto(o.status),
        nulo(o.paymentMethod, texto), quando(o.createdAt, referencia),
        nulo(o.acceptedAt, (d) => quando(d, referencia)), nulo(o.paidAt, (d) => quando(d, referencia)),
        nulo(o.deliveredAt, (d) => quando(d, referencia)),
      ]),
    ),
    insert(
      "public.order_timeline",
      ["order_id", "label", "created_at"],
      estado.orders.flatMap((o) => o.timeline.map((e) => [uuid(o.id), texto(e.label), quando(e.at, referencia)])),
    ),
    insert(
      "public.stock_movements",
      ["id", "type", "producer_id", "product_id", "quantity", "unit_cost", "reason", "note", "created_at"],
      estado.stockMovements.map((m) => [
        uuid(m.id), texto(m.type), uuid(m.producerId), uuid(m.productId), String(m.quantity),
        nulo(m.unitCost, String), nulo(m.reason, texto), texto(m.note), quando(m.createdAt, referencia),
      ]),
    ),
    insert(
      "public.expenses",
      ["id", "producer_id", "type", "description", "amount", "created_at"],
      estado.expenses.map((d) => [
        uuid(d.id), uuid(d.producerId), texto(d.type), texto(d.description), String(d.amount), quando(d.createdAt, referencia),
      ]),
    ),
    `select setval('public.order_number_seq', ${Math.max(estado.nextOrderNumber - 1, 1)});\n`,
  ];
  return partes.filter(Boolean).join("\n");
}
