// Tradução PURA entre as linhas do banco (snake_case, supabase/migrations) e o
// Estado do domínio (camelCase), mais o cálculo do que mudou entre dois estados.
// Sem I/O: testável sem banco. Leitura serve ao front e à API; gravação, só à API.

import type {
  ConfigRecompensa,
  Despesa,
  Estado,
  EventoLinhaDoTempo,
  FechamentoRecompensa,
  Loja,
  MovimentoEstoque,
  Oferta,
  Pedido,
  Produto,
  Proposta,
  Usuario,
} from "@hortilink/dominio";

/** Uma linha qualquer de tabela, como vem/vai do PostgREST. */
export type Linha = Record<string, unknown>;

export interface Linhas {
  users: Linha[];
  stores: Linha[];
  producer_pickup_stores: Linha[];
  products: Linha[];
  offers: Linha[];
  offer_stores: Linha[];
  proposals: Linha[];
  orders: Linha[];
  order_timeline: Linha[];
  stock_movements: Linha[];
  expenses: Linha[];
  reward_settings: Linha[];
  reward_payouts: Linha[];
}

export type Tabela = keyof Linhas;

/** Todas as tabelas que formam o Estado (a leitura completa passa por todas). */
export const TABELAS: Tabela[] = [
  "users",
  "stores",
  "producer_pickup_stores",
  "products",
  "offers",
  "offer_stores",
  "proposals",
  "orders",
  "order_timeline",
  "stock_movements",
  "expenses",
  "reward_settings",
  "reward_payouts",
];

/**
 * Tabelas criadas na migration 0004 (Sprint 2). Se a migration ainda não rodou no
 * banco, a leitura delas falha: os adapters tratam como lista vazia para o app abrir.
 */
export const TABELAS_OPCIONAIS: Tabela[] = ["reward_settings", "reward_payouts"];

/** Regra de recompensa enquanto o administrador não define outra. */
export const RECOMPENSA_PADRAO: ConfigRecompensa = { fixedAmount: 0, percent: 0 };

const n = (valor: unknown): number => Number(valor);
const s = (valor: unknown): string => String(valor);
const opcional = <T>(valor: unknown, converter: (v: unknown) => T): T | undefined =>
  valor === null || valor === undefined ? undefined : converter(valor);
const nuloSeVazio = <T>(valor: T | undefined): T | null => (valor === undefined ? null : valor);
const numeroDoPedido = (orderNumber: string): number => Number(orderNumber.replace(/\D/g, "")) || 0;

// ---------------------------------------------------------------- Banco → domínio

export function paraEstado(linhas: Linhas): Estado {
  const pontosDe = (produtorId: string) =>
    linhas.producer_pickup_stores.filter((l) => l.producer_id === produtorId).map((l) => s(l.store_id));
  const lojasDaOferta = (ofertaId: string) =>
    linhas.offer_stores.filter((l) => l.offer_id === ofertaId).map((l) => s(l.store_id));
  const eventosDo = (pedidoId: string): EventoLinhaDoTempo[] =>
    linhas.order_timeline
      .filter((l) => l.order_id === pedidoId)
      .map((l) => ({ label: l.label as EventoLinhaDoTempo["label"], at: s(l.created_at) }))
      .sort((a, b) => a.at.localeCompare(b.at));

  const users: Usuario[] = linhas.users.map((l) => ({
    id: s(l.id),
    role: l.role as Usuario["role"],
    name: s(l.name),
    city: s(l.city),
    // O RLS só mostra o e-mail ao servidor (service_role); no front ele vem vazio.
    email: s(l.email ?? ""),
    ...(l.role === "produtor" ? { pickupStoreIds: pontosDe(s(l.id)) } : {}),
  }));

  const orders: Pedido[] = linhas.orders.map((l) => ({
    id: s(l.id),
    orderNumber: s(l.order_number),
    type: l.type as Pedido["type"],
    sourceId: s(l.source_id),
    producerId: s(l.producer_id),
    buyerId: s(l.buyer_id),
    productId: s(l.product_id),
    quantity: n(l.quantity),
    unitPrice: n(l.unit_price),
    storeId: s(l.store_id),
    status: l.status as Pedido["status"],
    createdAt: s(l.created_at),
    timeline: eventosDo(s(l.id)),
    proposalId: opcional(l.proposal_id, s),
    acceptedAt: opcional(l.accepted_at, s),
    paidAt: opcional(l.paid_at, s),
    paymentMethod: opcional(l.payment_method, (v) => v as NonNullable<Pedido["paymentMethod"]>),
    deliveredAt: opcional(l.delivered_at, s),
    pickedUpAt: opcional(l.picked_up_at, s),
  }));

  const configRecompensa = linhas.reward_settings[0];

  return {
    users,
    stores: linhas.stores.map(
      (l): Loja => ({
        id: s(l.id),
        userId: s(l.user_id),
        name: s(l.name),
        address: s(l.address),
        city: s(l.city),
        hours: s(l.hours),
        distanceKm: opcional(l.distance_km, n),
        // Sem a coluna (migration 0004 ainda não aplicada) as lojas existentes seguem valendo.
        status: (l.status ?? "Aprovada") as Loja["status"],
        reviewNote: opcional(l.review_note, s),
        reviewedAt: opcional(l.reviewed_at, s),
        photo: opcional(l.photo, s),
        dryBoxes: n(l.dry_boxes ?? 0),
        coldBoxes: n(l.cold_boxes ?? 0),
      }),
    ),
    products: linhas.products.map(
      (l): Produto => ({
        id: s(l.id),
        producerId: s(l.producer_id),
        name: s(l.name),
        category: l.category as Produto["category"],
        unit: l.unit as Produto["unit"],
        price: n(l.price),
        quantity: n(l.quantity),
        minQuantity: n(l.min_quantity),
        photo: opcional(l.photo, s),
      }),
    ),
    offers: linhas.offers.map(
      (l): Oferta => ({
        id: s(l.id),
        producerId: s(l.producer_id),
        productId: s(l.product_id),
        quantity: n(l.quantity),
        promotionalPrice: n(l.promotional_price),
        city: s(l.city),
        validityDays: n(l.validity_days),
        storeIds: lojasDaOferta(s(l.id)),
        createdAt: s(l.created_at),
        endedAt: opcional(l.ended_at, s),
      }),
    ),
    proposals: linhas.proposals.map(
      (l): Proposta => ({
        id: s(l.id),
        type: l.type as Proposta["type"],
        sourceId: s(l.source_id),
        producerId: s(l.producer_id),
        buyerId: s(l.buyer_id),
        productId: s(l.product_id),
        quantity: n(l.quantity),
        unitPrice: n(l.unit_price),
        storeId: s(l.store_id),
        status: l.status as Proposta["status"],
        createdAt: s(l.created_at),
        orderId: linhas.orders.find((o) => o.proposal_id === l.id)?.id as string | undefined,
      }),
    ),
    orders,
    stockMovements: linhas.stock_movements.map(
      (l): MovimentoEstoque => ({
        id: s(l.id),
        type: l.type as MovimentoEstoque["type"],
        producerId: s(l.producer_id),
        productId: s(l.product_id),
        quantity: n(l.quantity),
        unitCost: opcional(l.unit_cost, n),
        reason: opcional(l.reason, (v) => v as NonNullable<MovimentoEstoque["reason"]>),
        note: s(l.note ?? ""),
        createdAt: s(l.created_at),
      }),
    ),
    expenses: linhas.expenses.map(
      (l): Despesa => ({
        id: s(l.id),
        producerId: s(l.producer_id),
        type: l.type as Despesa["type"],
        description: s(l.description),
        amount: n(l.amount),
        createdAt: s(l.created_at),
      }),
    ),
    rewardSettings: configRecompensa
      ? { fixedAmount: n(configRecompensa.fixed_amount), percent: n(configRecompensa.percent) }
      : { ...RECOMPENSA_PADRAO },
    rewardPayouts: linhas.reward_payouts.map(
      (l): FechamentoRecompensa => ({
        id: s(l.id),
        storeId: s(l.store_id),
        month: s(l.month),
        ordersCount: n(l.orders_count),
        salesTotal: n(l.sales_total),
        amount: n(l.amount),
        createdAt: s(l.created_at),
      }),
    ),
    nextOrderNumber: Math.max(0, ...orders.map((o) => numeroDoPedido(o.orderNumber))) + 1,
  };
}

// ---------------------------------------------------------------- Domínio → banco

/** Linhas de cada tabela que o servidor grava (users é criada pelo Auth). */
export function paraLinhas(estado: Estado): Omit<Linhas, "users"> {
  return {
    stores: estado.stores.map((x) => ({
      id: x.id, user_id: x.userId, name: x.name, address: x.address, city: x.city, hours: x.hours,
      status: x.status, review_note: nuloSeVazio(x.reviewNote), reviewed_at: nuloSeVazio(x.reviewedAt),
      photo: nuloSeVazio(x.photo || undefined), dry_boxes: x.dryBoxes, cold_boxes: x.coldBoxes,
      // distance_km não existe no banco oficial: a distância é simulada no front.
    })),
    producer_pickup_stores: estado.users.flatMap((u) =>
      (u.pickupStoreIds ?? []).map((storeId) => ({ producer_id: u.id, store_id: storeId })),
    ),
    products: estado.products.map((x) => ({
      id: x.id, producer_id: x.producerId, name: x.name, category: x.category, unit: x.unit,
      price: x.price, quantity: x.quantity, min_quantity: x.minQuantity ?? 0, photo: nuloSeVazio(x.photo || undefined),
    })),
    offers: estado.offers.map((x) => ({
      id: x.id, producer_id: x.producerId, product_id: x.productId, quantity: x.quantity,
      promotional_price: x.promotionalPrice, city: x.city, validity_days: x.validityDays,
      created_at: x.createdAt, ended_at: nuloSeVazio(x.endedAt),
    })),
    offer_stores: estado.offers.flatMap((o) => o.storeIds.map((storeId) => ({ offer_id: o.id, store_id: storeId }))),
    proposals: estado.proposals.map((x) => ({
      id: x.id, type: x.type, source_id: x.sourceId, producer_id: x.producerId, buyer_id: x.buyerId,
      product_id: x.productId, quantity: x.quantity, unit_price: x.unitPrice, store_id: x.storeId,
      status: x.status, created_at: x.createdAt,
    })),
    orders: estado.orders.map((x) => ({
      id: x.id, order_number: x.orderNumber, type: x.type, source_id: x.sourceId, producer_id: x.producerId,
      buyer_id: x.buyerId, product_id: x.productId, quantity: x.quantity, unit_price: x.unitPrice,
      store_id: x.storeId, status: x.status, proposal_id: nuloSeVazio(x.proposalId),
      payment_method: nuloSeVazio(x.paymentMethod), created_at: x.createdAt,
      accepted_at: nuloSeVazio(x.acceptedAt), paid_at: nuloSeVazio(x.paidAt), delivered_at: nuloSeVazio(x.deliveredAt),
      picked_up_at: nuloSeVazio(x.pickedUpAt),
    })),
    order_timeline: estado.orders.flatMap((o) => o.timeline.map((e) => ({ order_id: o.id, label: e.label, created_at: e.at }))),
    stock_movements: estado.stockMovements.map((x) => ({
      id: x.id, type: x.type, producer_id: x.producerId, product_id: x.productId, quantity: x.quantity,
      unit_cost: nuloSeVazio(x.unitCost), reason: nuloSeVazio(x.reason), note: x.note, created_at: x.createdAt,
    })),
    expenses: estado.expenses.map((x) => ({
      id: x.id, producer_id: x.producerId, type: x.type, description: x.description, amount: x.amount,
      created_at: x.createdAt,
    })),
    reward_settings: [
      { id: 1, fixed_amount: estado.rewardSettings.fixedAmount, percent: estado.rewardSettings.percent },
    ],
    reward_payouts: estado.rewardPayouts.map((x) => ({
      id: x.id, store_id: x.storeId, month: x.month, orders_count: x.ordersCount, sales_total: x.salesTotal,
      amount: x.amount, created_at: x.createdAt,
    })),
  };
}

// ---------------------------------------------------------------- Diferenças

export type Operacao =
  | { tipo: "gravar"; tabela: Tabela; linhas: Linha[] }
  | { tipo: "apagar"; tabela: Tabela; chaves: Linha[] }
  /** users é criada pelo Auth: o servidor só ATUALIZA nome e cidade (GER-01). */
  | { tipo: "atualizar"; tabela: "users"; linhas: Linha[] };

/** Chave de cada tabela (as de ligação não têm `id`). */
const CHAVES: Record<Exclude<Tabela, "users">, string[]> = {
  stores: ["id"],
  producer_pickup_stores: ["producer_id", "store_id"],
  products: ["id"],
  offers: ["id"],
  offer_stores: ["offer_id", "store_id"],
  proposals: ["id"],
  orders: ["id"],
  order_timeline: ["order_id", "label", "created_at"],
  stock_movements: ["id"],
  expenses: ["id"],
  reward_settings: ["id"],
  reward_payouts: ["id"],
};

/** Ordem que respeita as chaves estrangeiras: pais antes de filhos ao gravar. */
const ORDEM: Exclude<Tabela, "users">[] = [
  "stores",
  "producer_pickup_stores",
  "products",
  "offers",
  "offer_stores",
  "proposals",
  "orders",
  "order_timeline",
  "stock_movements",
  "expenses",
  "reward_settings",
  "reward_payouts",
];

const chaveDe = (tabela: Exclude<Tabela, "users">, linha: Linha) =>
  CHAVES[tabela].map((campo) => String(linha[campo])).join("|");

const soChave = (tabela: Exclude<Tabela, "users">, linha: Linha): Linha =>
  Object.fromEntries(CHAVES[tabela].map((campo) => [campo, linha[campo]]));

/**
 * O que gravar e apagar para o banco sair de `antes` e chegar em `depois`.
 * Grava pais antes de filhos e apaga filhos antes de pais.
 */
export function calcularOperacoes(antes: Estado, depois: Estado): Operacao[] {
  const linhasAntes = paraLinhas(antes);
  const linhasDepois = paraLinhas(depois);
  const gravar: Operacao[] = [];
  const apagar: Operacao[] = [];

  for (const tabela of ORDEM) {
    const anteriores = new Map(linhasAntes[tabela].map((l) => [chaveDe(tabela, l), JSON.stringify(l)]));
    const atuais = new Set(linhasDepois[tabela].map((l) => chaveDe(tabela, l)));

    const mudadas = linhasDepois[tabela].filter((l) => anteriores.get(chaveDe(tabela, l)) !== JSON.stringify(l));
    if (mudadas.length) gravar.push({ tipo: "gravar", tabela, linhas: mudadas });

    const removidas = linhasAntes[tabela].filter((l) => !atuais.has(chaveDe(tabela, l)));
    if (removidas.length) apagar.unshift({ tipo: "apagar", tabela, chaves: removidas.map((l) => soChave(tabela, l)) });
  }
  const usuariosAntes = new Map(antes.users.map((u) => [u.id, `${u.name}|${u.city}`]));
  const usuariosMudados = depois.users
    .filter((u) => usuariosAntes.has(u.id) && usuariosAntes.get(u.id) !== `${u.name}|${u.city}`)
    .map((u) => ({ id: u.id, name: u.name, city: u.city }));
  const atualizar: Operacao[] = usuariosMudados.length
    ? [{ tipo: "atualizar", tabela: "users", linhas: usuariosMudados }]
    : [];
  return [...apagar, ...atualizar, ...gravar];
}

export const chavesDaTabela = (tabela: Exclude<Tabela, "users">): string[] => CHAVES[tabela];
