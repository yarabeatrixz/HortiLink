// Recompensa às lojas parceiras (US16): para cada pedido RETIRADO na loja, ela
// recebe um valor fixo + uma porcentagem do valor do pedido. O administrador define
// a regra, acompanha o extrato e fecha o mês (o valor fechado não muda mais).

import { STATUS_PEDIDO } from "./constantes";
import { num } from "./formatacao";
import type { ConfigRecompensa, Estado, FechamentoRecompensa, Numerico, Pedido, Resultado } from "./tipos";
import { falha, novoId } from "./util";

const centavos = (valor: number): number => Math.round(valor * 100) / 100;

/** Mês AAAA-MM de uma data ISO (no fuso de Brasília não importa para o MVP: usa UTC). */
export const mesDe = (iso: string): string => iso.slice(0, 7);

export const mesAtual = (agora: Date = new Date()): string => mesDe(agora.toISOString());

const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;

export function salvarConfigRecompensa(
  estado: Estado,
  dados: { fixedAmount: Numerico; percent: Numerico },
): Resultado {
  const fixedAmount = num(dados.fixedAmount);
  const percent = num(dados.percent);
  if (!Number.isFinite(fixedAmount) || fixedAmount < 0) return falha("O valor fixo não pode ser negativo");
  if (!Number.isFinite(percent) || percent < 0 || percent > 100)
    return falha("A porcentagem precisa estar entre 0 e 100");
  return { ok: true, state: { ...estado, rewardSettings: { fixedAmount, percent } } };
}

export const valorRecompensa = (config: ConfigRecompensa, pedido: Pick<Pedido, "quantity" | "unitPrice">) =>
  centavos(config.fixedAmount + (pedido.quantity * pedido.unitPrice * config.percent) / 100);

export interface Extrato {
  storeId: string;
  month: string;
  pedidos: (Pedido & { recompensa: number })[];
  ordersCount: number;
  salesTotal: number;
  amount: number;
  /** Presente quando o mês já foi fechado: os valores vêm do fechamento. */
  fechamento?: FechamentoRecompensa;
}

/** Pedidos retirados na loja naquele mês e quanto a loja tem a receber. */
export function extratoDaLoja(estado: Estado, storeId: string, month: string): Extrato {
  const pedidos = estado.orders
    .filter(
      (pedido) =>
        pedido.storeId === storeId &&
        pedido.status === STATUS_PEDIDO.RETIRADO &&
        pedido.pickedUpAt &&
        mesDe(pedido.pickedUpAt) === month,
    )
    .map((pedido) => ({ ...pedido, recompensa: valorRecompensa(estado.rewardSettings, pedido) }));
  const fechamento = estado.rewardPayouts.find((item) => item.storeId === storeId && item.month === month);
  if (fechamento)
    return {
      storeId,
      month,
      pedidos,
      ordersCount: fechamento.ordersCount,
      salesTotal: fechamento.salesTotal,
      amount: fechamento.amount,
      fechamento,
    };
  return {
    storeId,
    month,
    pedidos,
    ordersCount: pedidos.length,
    salesTotal: centavos(pedidos.reduce((soma, p) => soma + p.quantity * p.unitPrice, 0)),
    amount: centavos(pedidos.reduce((soma, p) => soma + p.recompensa, 0)),
  };
}

/** Fecha o mês da loja: registra o valor a pagar. Não fecha duas vezes nem mês futuro. */
export function fecharMesRecompensa(
  estado: Estado,
  storeId: string,
  month: string,
  agora: Date = new Date(),
): Resultado<{ payout: FechamentoRecompensa }> {
  if (!estado.stores.some((loja) => loja.id === storeId)) return falha("Ponto de coleta não encontrado");
  if (!MES_VALIDO.test(month)) return falha("Mês inválido");
  if (month > mesAtual(agora)) return falha("Não dá para fechar um mês que ainda não começou");
  const extrato = extratoDaLoja(estado, storeId, month);
  if (extrato.fechamento) return falha("Este mês já foi fechado para esta loja");
  if (!extrato.ordersCount) return falha("Nenhum pedido retirado neste mês");
  const payout: FechamentoRecompensa = {
    id: novoId(),
    storeId,
    month,
    ordersCount: extrato.ordersCount,
    salesTotal: extrato.salesTotal,
    amount: extrato.amount,
    createdAt: agora.toISOString(),
  };
  return { ok: true, payout, state: { ...estado, rewardPayouts: [payout, ...estado.rewardPayouts] } };
}
