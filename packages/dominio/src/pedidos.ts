// Pedidos: compra direta, pagamento e entrega na loja parceira.

import {
  EVENTO_PEDIDO,
  type EventoPedido,
  type MetodoPagamento,
  ORIGEM,
  PRAZO_PAGAMENTO_MINUTOS,
  STATUS_PEDIDO,
  type StatusPedido,
} from "./constantes";
import { type DadosCompra, numeroPedido, reservarEstoque, validarCompra } from "./compra";
import { hmacSha256Hex } from "./hmac";
import { num } from "./formatacao";
import { lojaAprovada, lojaLotada } from "./lojas";
import type { Estado, Pedido, Resultado } from "./tipos";
import { falha, novoId, substituir } from "./util";

export function criarPedidoDireto(
  estado: Estado,
  dados: DadosCompra,
  agora: Date = new Date(),
): Resultado<{ order: Pedido }> {
  const validacao = validarCompra(estado, dados, agora);
  if (!validacao.ok) return validacao;
  const { produto, oferta } = validacao;
  const momento = agora.toISOString();
  const sequencia = estado.nextOrderNumber || 1;
  const order: Pedido = {
    id: novoId(),
    orderNumber: numeroPedido(sequencia),
    type: dados.type,
    sourceId: oferta?.id ?? produto.id,
    producerId: produto.producerId,
    buyerId: dados.buyerId,
    productId: produto.id,
    quantity: num(dados.quantity),
    unitPrice: oferta ? oferta.promotionalPrice : produto.price,
    storeId: dados.storeId,
    status: STATUS_PEDIDO.AGUARDANDO_PAGAMENTO,
    createdAt: momento,
    timeline: [{ label: EVENTO_PEDIDO.REALIZADO, at: momento }],
  };
  return {
    ok: true,
    order,
    state: {
      ...estado,
      nextOrderNumber: sequencia + 1,
      ...reservarEstoque(estado, { produtoId: produto.id, ofertaId: oferta?.id, quantidade: order.quantity }),
      orders: [order, ...estado.orders],
    },
  };
}

/** Muda o status do pedido e registra o evento na linha do tempo. */
function avancarPedido(
  estado: Estado,
  pedidoId: string,
  mudanca: { status: StatusPedido; evento: EventoPedido; momento: string; extras: Partial<Pedido> },
): Estado {
  return {
    ...estado,
    orders: substituir(estado.orders, pedidoId, (pedido) => ({
      ...pedido,
      ...mudanca.extras,
      status: mudanca.status,
      timeline: [...pedido.timeline, { label: mudanca.evento, at: mudanca.momento }],
    })),
  };
}

export function pagarPedido(
  estado: Estado,
  pedidoId: string,
  metodo: MetodoPagamento,
  agora: Date = new Date(),
): Resultado {
  const pedido = estado.orders.find((item) => item.id === pedidoId);
  if (pedido?.status !== STATUS_PEDIDO.AGUARDANDO_PAGAMENTO)
    return falha("Este pedido não está aguardando pagamento");
  if (pedidoVencido(pedido, agora))
    return falha("O prazo para pagar este pedido acabou. Faça a compra de novo.");
  // A loja pode ter sido suspensa ou lotado entre a compra e o pagamento.
  const loja = estado.stores.find((item) => item.id === pedido.storeId);
  if (!loja || !lojaAprovada(loja))
    return falha("Este ponto de retirada não está disponível no momento. Cancele e compre de novo.");
  if (lojaLotada(estado, loja))
    return falha("Este ponto de retirada lotou. Cancele e compre de novo escolhendo outro ponto.");
  const momento = agora.toISOString();
  return {
    ok: true,
    state: avancarPedido(estado, pedidoId, {
      status: STATUS_PEDIDO.PAGO,
      evento: EVENTO_PEDIDO.PAGAMENTO_APROVADO,
      momento,
      extras: { paymentMethod: metodo, paidAt: momento },
    }),
  };
}

// ---------------------------------------------------------------- Cancelamento e prazo (Sprint 3)

/** Pedido aguardando pagamento há mais de PRAZO_PAGAMENTO_MINUTOS. */
export const pedidoVencido = (pedido: Pick<Pedido, "status" | "createdAt">, agora: Date): boolean =>
  pedido.status === STATUS_PEDIDO.AGUARDANDO_PAGAMENTO &&
  agora.getTime() - new Date(pedido.createdAt).getTime() > PRAZO_PAGAMENTO_MINUTOS * 60_000;

/** Cancela o pedido e devolve a quantidade ao produto (e à oferta, se ainda existir). */
function devolverEstoque(estado: Estado, pedido: Pedido, evento: EventoPedido, momento: string): Estado {
  const devolver = <T extends { id: string; quantity: number }>(item: T): T => ({
    ...item,
    quantity: item.quantity + pedido.quantity,
  });
  const cancelado = avancarPedido(estado, pedido.id, {
    status: STATUS_PEDIDO.CANCELADO,
    evento,
    momento,
    extras: {},
  });
  return {
    ...cancelado,
    products: substituir(cancelado.products, pedido.productId, devolver),
    offers:
      pedido.type === ORIGEM.OFERTA ? substituir(cancelado.offers, pedido.sourceId, devolver) : cancelado.offers,
  };
}

/** O comprador desiste antes de pagar: o pedido é cancelado e o estoque volta. */
export function cancelarPedido(estado: Estado, pedidoId: string, agora: Date = new Date()): Resultado {
  const pedido = estado.orders.find((item) => item.id === pedidoId);
  if (pedido?.status !== STATUS_PEDIDO.AGUARDANDO_PAGAMENTO)
    return falha("Só pedidos aguardando pagamento podem ser cancelados");
  return { ok: true, state: devolverEstoque(estado, pedido, EVENTO_PEDIDO.CANCELADO, agora.toISOString()) };
}

/**
 * Cancela todos os pedidos não pagos dentro do prazo e devolve o estoque.
 * A API roda isto antes de cada gravação, para o estoque não ficar preso.
 */
export function expirarPedidosVencidos(estado: Estado, agora: Date = new Date()): Estado {
  const momento = agora.toISOString();
  return estado.orders
    .filter((pedido) => pedidoVencido(pedido, agora))
    .reduce((atual, pedido) => devolverEstoque(atual, pedido, EVENTO_PEDIDO.EXPIRADO, momento), estado);
}

export function confirmarEntregaNaLoja(estado: Estado, pedidoId: string, agora: Date = new Date()): Resultado {
  const pedido = estado.orders.find((item) => item.id === pedidoId);
  if (pedido?.status !== STATUS_PEDIDO.PAGO)
    return falha("Só pedidos pagos podem ser marcados como entregues");
  const momento = agora.toISOString();
  return {
    ok: true,
    state: avancarPedido(estado, pedidoId, {
      status: STATUS_PEDIDO.ENTREGUE_NA_LOJA,
      evento: EVENTO_PEDIDO.ENTREGUE_NA_LOJA,
      momento,
      extras: { deliveredAt: momento },
    }),
  };
}

// ---------------------------------------------------------------- Retirada na loja (US10)

/**
 * Código de 6 dígitos que o comprador mostra na loja. É derivado do id do pedido e
 * de um SEGREDO que só o servidor conhece: não fica no banco, então a loja não
 * consegue ler o código; só o comprador (pela API) o recebe.
 * HMAC-SHA256 (Sprint 3): sem o segredo, conhecer códigos de outros pedidos não
 * ajuda a calcular o próximo. O limite de tentativas fica na API.
 */
export function codigoDeRetirada(pedidoId: string, segredo: string): string {
  const resumo = hmacSha256Hex(segredo, `retirada:${pedidoId}`);
  // 48 bits do resumo → 6 dígitos (o viés do módulo é desprezível).
  return String(Number.parseInt(resumo.slice(0, 12), 16) % 1_000_000).padStart(6, "0");
}

/** Mostrar o código ao comprador só depois que o produto chegou à loja. */
export const pedidoNaLoja = (pedido: Pick<Pedido, "status">): boolean =>
  pedido.status === STATUS_PEDIDO.ENTREGUE_NA_LOJA || pedido.status === STATUS_PEDIDO.PRONTO_PARA_RETIRADA;

/** A loja confere o produto recebido e libera para retirada. */
export function confirmarRecebimentoNaLoja(estado: Estado, pedidoId: string, agora: Date = new Date()): Resultado {
  const pedido = estado.orders.find((item) => item.id === pedidoId);
  if (pedido?.status !== STATUS_PEDIDO.ENTREGUE_NA_LOJA)
    return falha("Só pedidos entregues pelo produtor podem ser liberados para retirada");
  return {
    ok: true,
    state: avancarPedido(estado, pedidoId, {
      status: STATUS_PEDIDO.PRONTO_PARA_RETIRADA,
      evento: EVENTO_PEDIDO.PRONTO_PARA_RETIRADA,
      momento: agora.toISOString(),
      extras: {},
    }),
  };
}

/** A loja digita o código do comprador e encerra o pedido como "Retirado". */
export function confirmarRetirada(
  estado: Estado,
  pedidoId: string,
  codigo: string,
  segredo: string,
  agora: Date = new Date(),
): Resultado {
  const pedido = estado.orders.find((item) => item.id === pedidoId);
  if (!pedido || !pedidoNaLoja(pedido)) return falha("Este pedido ainda não está na loja para retirada");
  if (String(codigo ?? "").replace(/\D/g, "") !== codigoDeRetirada(pedidoId, segredo))
    return falha("Código de retirada incorreto. Confira com o comprador.");
  const momento = agora.toISOString();
  return {
    ok: true,
    state: avancarPedido(estado, pedidoId, {
      status: STATUS_PEDIDO.RETIRADO,
      evento: EVENTO_PEDIDO.RETIRADO,
      momento,
      extras: { pickedUpAt: momento },
    }),
  };
}
