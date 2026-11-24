// Entidades do HortiLink. Os nomes dos campos são o contrato de dados com o
// back-end e o banco (ver docs/BACKEND.md); por isso ficam em inglês.

import type {
  Categoria,
  EventoPedido,
  MetodoPagamento,
  MotivoPerda,
  Origem,
  Perfil,
  StatusLoja,
  StatusPedido,
  StatusProposta,
  TipoDespesa,
  TipoMovimento,
  Unidade,
} from "./constantes";

/** Data e hora em ISO 8601 (ex.: "2026-11-15T13:00:00.000Z"). */
export type DataIso = string;

export interface Usuario {
  id: string;
  role: Perfil;
  name: string;
  city: string;
  email: string;
  /** Só no modo demonstração. Com Supabase Auth a senha nunca chega ao domínio. */
  password?: string;
  /** Pontos de retirada do catálogo (só produtor). */
  pickupStoreIds?: string[];
}

export interface Produto {
  id: string;
  producerId: string;
  name: string;
  category: Categoria;
  unit: Unidade;
  price: number;
  quantity: number;
  /** Abaixo ou igual a este valor o produto entra no alerta de reposição. */
  minQuantity?: number;
  photo?: string;
}

export interface Oferta {
  id: string;
  producerId: string;
  productId: string;
  quantity: number;
  promotionalPrice: number;
  city: string;
  validityDays: number;
  storeIds: string[];
  createdAt: DataIso;
  endedAt?: DataIso;
}

export interface Loja {
  id: string;
  userId: string;
  name: string;
  address: string;
  city: string;
  hours: string;
  /** Distância simulada; com geolocalização real, calculada no servidor. */
  distanceKm?: number;
  /** Só lojas "Aprovada" aparecem como ponto de retirada (US14). */
  status: StatusLoja;
  /** Motivo da reprovação/suspensão, escrito pelo administrador. */
  reviewNote?: string;
  reviewedAt?: DataIso;
  /** Foto do local (LOJA-01): base64 até 1 MB ou endereço https. */
  photo?: string;
  /** Capacidade de armazenamento em caixas (US15). 0 = não informada (sem limite). */
  dryBoxes: number;
  coldBoxes: number;
}

/** Regra da recompensa às lojas (US16): valor fixo + porcentagem por pedido retirado. */
export interface ConfigRecompensa {
  fixedAmount: number;
  percent: number;
}

/** Fechamento do mês de uma loja: o valor fica registrado e não muda mais. */
export interface FechamentoRecompensa {
  id: string;
  storeId: string;
  /** Mês no formato AAAA-MM. */
  month: string;
  ordersCount: number;
  salesTotal: number;
  amount: number;
  createdAt: DataIso;
}

export interface EventoLinhaDoTempo {
  label: EventoPedido;
  at: DataIso;
}

export interface Pedido {
  id: string;
  orderNumber: string;
  type: Origem;
  sourceId: string;
  producerId: string;
  buyerId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  storeId: string;
  status: StatusPedido;
  createdAt: DataIso;
  timeline: EventoLinhaDoTempo[];
  proposalId?: string;
  acceptedAt?: DataIso;
  paidAt?: DataIso;
  paymentMethod?: MetodoPagamento;
  deliveredAt?: DataIso;
  pickedUpAt?: DataIso;
}

export interface Proposta {
  id: string;
  type: Origem;
  sourceId: string;
  producerId: string;
  buyerId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  storeId: string;
  status: StatusProposta;
  createdAt: DataIso;
  orderId?: string;
}

export interface MovimentoEstoque {
  id: string;
  type: TipoMovimento;
  producerId: string;
  productId: string;
  quantity: number;
  /** Só em entradas. */
  unitCost?: number;
  /** Só em perdas. */
  reason?: MotivoPerda;
  note: string;
  createdAt: DataIso;
}

export interface Despesa {
  id: string;
  producerId: string;
  type: TipoDespesa;
  description: string;
  amount: number;
  createdAt: DataIso;
}

/** Tudo o que o app conhece. No servidor, cada lista é uma tabela. */
export interface Estado {
  users: Usuario[];
  products: Produto[];
  offers: Oferta[];
  stores: Loja[];
  orders: Pedido[];
  proposals: Proposta[];
  stockMovements: MovimentoEstoque[];
  expenses: Despesa[];
  rewardSettings: ConfigRecompensa;
  rewardPayouts: FechamentoRecompensa[];
  nextOrderNumber: number;
}

/**
 * Resultado de uma regra: sucesso com o novo estado (e dados extras, como o
 * pedido criado) ou falha com uma mensagem pronta para mostrar ao usuário.
 */
export type Resultado<Extra extends object = object> =
  | ({ ok: true; state: Estado } & Extra)
  | { ok: false; error: string };

export type Falha = Extract<Resultado, { ok: false }>;

/** Valores numéricos podem chegar como texto de formulário ("2,50"). */
export type Numerico = number | string;
