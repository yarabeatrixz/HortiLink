// Regras comuns a pedido direto e proposta: validar a origem da compra e
// reservar estoque. Uso interno do domínio.

import { type Origem, ORIGEM } from "./constantes";
import { num } from "./formatacao";
import { lojaAprovada, lojaRecebePedido } from "./lojas";
import { ofertaAtiva } from "./ofertas";
import type { Estado, Numerico, Oferta, Produto } from "./tipos";
import { falha, substituir } from "./util";

export interface DadosCompra {
  type: Origem;
  /** Id da oferta (compra de oferta) ou do produto (compra do catálogo). */
  sourceId: string;
  productId: string;
  buyerId: string;
  quantity: Numerico;
  storeId: string;
}

type CompraValida = { ok: true; produto: Produto; oferta: Oferta | undefined };

export function validarCompra(
  estado: Estado,
  dados: DadosCompra,
  agora: Date,
): CompraValida | ReturnType<typeof falha> {
  const produto = estado.products.find((item) => item.id === dados.productId);
  if (!produto) return falha("Este produto não está mais disponível");

  const deOferta = dados.type === ORIGEM.OFERTA;
  const oferta = deOferta ? estado.offers.find((item) => item.id === dados.sourceId) : undefined;
  if (deOferta && (!oferta || !ofertaAtiva(oferta, agora)))
    return falha("Esta oferta não está mais disponível");

  const quantidade = num(dados.quantity);
  const disponivel = oferta ? oferta.quantity : produto.quantity;
  if (quantidade <= 0) return falha("Informe uma quantidade válida");
  if (quantidade > disponivel) return falha("Quantidade acima da disponível");

  const produtor = estado.users.find((item) => item.id === produto.producerId);
  const lojasPermitidas = oferta ? oferta.storeIds : (produtor?.pickupStoreIds ?? []);
  if (!lojasPermitidas.includes(dados.storeId))
    return falha("Selecione um ponto de retirada disponível");
  const loja = estado.stores.find((item) => item.id === dados.storeId);
  if (!lojaAprovada(loja)) return falha("Este ponto de retirada não está disponível no momento");
  if (!lojaRecebePedido(estado, loja)) return falha("Este ponto de retirada está lotado. Escolha outro.");

  return { ok: true, produto, oferta };
}

/** Baixa a quantidade do produto e, se a compra for de oferta, da oferta também. */
export function reservarEstoque(
  estado: Estado,
  reserva: { produtoId: string; ofertaId: string | undefined; quantidade: number },
): Pick<Estado, "products" | "offers"> {
  const baixar = <T extends { id: string; quantity: number }>(item: T): T => ({
    ...item,
    quantity: item.quantity - reserva.quantidade,
  });
  return {
    products: substituir(estado.products, reserva.produtoId, baixar),
    offers: reserva.ofertaId ? substituir(estado.offers, reserva.ofertaId, baixar) : estado.offers,
  };
}

export const numeroPedido = (sequencia: number): string => `#HL-${String(sequencia).padStart(6, "0")}`;
