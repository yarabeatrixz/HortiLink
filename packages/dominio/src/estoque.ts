// Estoque do produtor: situação (alerta de reposição), entradas e perdas.

import { MOTIVOS_PERDA, type MotivoPerda, STATUS_ESTOQUE, type StatusEstoque, TIPO_MOVIMENTO } from "./constantes";
import { num } from "./formatacao";
import type { Estado, MovimentoEstoque, Numerico, Produto, Resultado } from "./tipos";
import { falha, novoId, substituir, texto } from "./util";

export interface DadosEntrada {
  productId: string;
  quantity: Numerico;
  unitCost: Numerico;
  note?: string;
}

export interface DadosPerda {
  productId: string;
  quantity: Numerico;
  reason: string;
  note?: string;
}

/**
 * Ok, baixo (quantidade ABAIXO do mínimo) ou zerado. Sem mínimo definido, só avisa quando zera.
 * Quantidade igual ao mínimo já está ok (PROD-04: o alerta não sumia ao repor até o mínimo).
 */
export function statusEstoque(produto: Pick<Produto, "quantity" | "minQuantity">): StatusEstoque {
  if (produto.quantity <= 0) return STATUS_ESTOQUE.ZERADO;
  if (produto.quantity < (produto.minQuantity ?? 0)) return STATUS_ESTOQUE.BAIXO;
  return STATUS_ESTOQUE.OK;
}

export const precisaRepor = (produto: Pick<Produto, "quantity" | "minQuantity">): boolean =>
  statusEstoque(produto) !== STATUS_ESTOQUE.OK;

const ehMotivoPerda = (valor: string): valor is MotivoPerda =>
  (MOTIVOS_PERDA as readonly string[]).includes(valor);

function movimentar(estado: Estado, produto: Produto, movimento: MovimentoEstoque, novaQuantidade: number): Resultado {
  return {
    ok: true,
    state: {
      ...estado,
      products: substituir(estado.products, produto.id, (item) => ({ ...item, quantity: novaQuantidade })),
      stockMovements: [movimento, ...estado.stockMovements],
    },
  };
}

/** Entrada de mercadoria (colheita, compra): soma ao estoque e registra o custo. */
export function registrarEntrada(estado: Estado, dados: DadosEntrada, agora: Date = new Date()): Resultado {
  const produto = estado.products.find((item) => item.id === dados.productId);
  if (!produto) return falha("Selecione um produto");
  const quantidade = num(dados.quantity);
  const custoUnitario = num(dados.unitCost);
  if (quantidade <= 0) return falha("Informe uma quantidade válida");
  if (custoUnitario < 0) return falha("O custo não pode ser negativo");
  return movimentar(
    estado,
    produto,
    {
      id: novoId(),
      type: TIPO_MOVIMENTO.ENTRADA,
      producerId: produto.producerId,
      productId: produto.id,
      quantity: quantidade,
      unitCost: custoUnitario,
      note: texto(dados.note),
      createdAt: agora.toISOString(),
    },
    produto.quantity + quantidade,
  );
}

/** Perda (estragou, avaria…): tira do estoque e guarda o motivo. */
export function registrarPerda(estado: Estado, dados: DadosPerda, agora: Date = new Date()): Resultado {
  const produto = estado.products.find((item) => item.id === dados.productId);
  if (!produto) return falha("Selecione um produto");
  const quantidade = num(dados.quantity);
  if (quantidade <= 0) return falha("Informe uma quantidade válida");
  if (quantidade > produto.quantity) return falha("A perda é maior que o estoque atual");
  if (!ehMotivoPerda(dados.reason)) return falha("Selecione o motivo da perda");
  return movimentar(
    estado,
    produto,
    {
      id: novoId(),
      type: TIPO_MOVIMENTO.PERDA,
      producerId: produto.producerId,
      productId: produto.id,
      quantity: quantidade,
      reason: dados.reason,
      note: texto(dados.note),
      createdAt: agora.toISOString(),
    },
    produto.quantity - quantidade,
  );
}
