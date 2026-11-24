// Pedidos: compra direta, pagamento e entrega na loja parceira.

import {
  EVENTO_PEDIDO,
  type EventoPedido,
  type MetodoPagamento,
  STATUS_PEDIDO,
  type StatusPedido,
} from "./constantes";
import { type DadosCompra, numeroPedido, reservarEstoque, validarCompra } from "./compra";
import { num } from "./formatacao";
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
 * (Hash FNV-1a: suficiente para o MVP; trocar por HMAC se houver risco maior.)
 */
export function codigoDeRetirada(pedidoId: string, segredo: string): string {
  let hash = 0x811c9dc5;
  for (const caractere of `${segredo}:${pedidoId}`) {
    hash ^= caractere.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return String(hash % 1_000_000).padStart(6, "0");
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
