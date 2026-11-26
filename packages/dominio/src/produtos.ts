// Catálogo do produtor: cadastrar, editar e excluir produtos.

import {
  CATEGORIAS,
  type Categoria,
  FORMATOS_FOTO,
  STATUS_PEDIDO,
  TAMANHO_MAXIMO_FOTO,
  type Unidade,
  UNIDADES,
} from "./constantes";
import { num } from "./formatacao";
import type { Estado, Numerico, Produto, Resultado } from "./tipos";
import { falha, novoId, substituir, texto } from "./util";

/** Limites de sanidade: evitam valores absurdos (1e300) que estouram o banco. */
export const PRECO_MAXIMO = 100_000;
export const QUANTIDADE_MAXIMA = 1_000_000;
/** Cada produtor pode ter até este número de produtos no catálogo. */
export const PRODUTOS_POR_PRODUTOR = 200;

/** Pedidos que ainda dependem do produto (não foram retirados nem cancelados). */
const PEDIDO_EM_ANDAMENTO: readonly string[] = [
  STATUS_PEDIDO.AGUARDANDO_PAGAMENTO,
  STATUS_PEDIDO.PAGO,
  STATUS_PEDIDO.ENTREGUE_NA_LOJA,
  STATUS_PEDIDO.PRONTO_PARA_RETIRADA,
];

export interface DadosProduto {
  /** Ausente ao cadastrar; presente ao editar. */
  id?: string | undefined;
  producerId: string;
  name: string;
  category: Categoria;
  unit: Unidade;
  price: Numerico;
  quantity: Numerico;
  minQuantity?: Numerico;
  photo?: string;
}

export function salvarProduto(estado: Estado, dados: DadosProduto): Resultado {
  const price = num(dados.price);
  const quantity = num(dados.quantity);
  const minQuantity = num(dados.minQuantity);
  const existente = dados.id ? estado.products.find((item) => item.id === dados.id) : undefined;
  // Cadastrar exige estoque; editar pode zerar (tirar da vitrine sem excluir).
  const quantidadeInvalida = existente ? quantity < 0 : quantity <= 0;
  if (!texto(dados.name) || price <= 0 || quantidadeInvalida) {
    return falha("Preencha nome, preço e quantidade com valores válidos");
  }
  if (price > PRECO_MAXIMO || quantity > QUANTIDADE_MAXIMA)
    return falha("Preço ou quantidade acima do permitido. Confira os valores.");
  if (minQuantity < 0) return falha("O estoque mínimo não pode ser negativo");
  if (!(CATEGORIAS as readonly string[]).includes(dados.category)) return falha("Escolha uma categoria válida");
  if (!(UNIDADES as readonly string[]).includes(dados.unit)) return falha("Escolha uma unidade válida");
  if (!existente) {
    const doProdutor = estado.products.filter((item) => item.producerId === dados.producerId).length;
    if (doProdutor >= PRODUTOS_POR_PRODUTOR)
      return falha(`Limite de ${PRODUTOS_POR_PRODUTOR} produtos por produtor atingido`);
  }

  const produto: Produto = {
    ...dados,
    id: existente?.id ?? novoId(),
    name: texto(dados.name),
    price,
    quantity,
    minQuantity,
  };
  return {
    ok: true,
    state: {
      ...estado,
      products: existente
        ? substituir(estado.products, produto.id, () => produto)
        : [produto, ...estado.products],
    },
  };
}

/** Excluir um produto remove também as ofertas dele. */
export const excluirProduto = (estado: Estado, produtoId: string): Resultado =>
  excluirProdutos(estado, [produtoId]);

/**
 * Exclusão em lote (PROD-02): remove os produtos e as ofertas deles de uma vez.
 * Produto que já tem pedido NÃO é excluído (Sprint 3): o pedido ficaria sem
 * produto no histórico do comprador, da loja e da recompensa.
 */
export function excluirProdutos(estado: Estado, produtoIds: string[]): Resultado {
  if (!produtoIds.length) return falha("Selecione ao menos um produto");
  const ids = new Set(produtoIds);
  const comPedido = estado.products.filter(
    (produto) => ids.has(produto.id) && estado.orders.some((pedido) => pedido.productId === produto.id),
  );
  if (comPedido.length) {
    const nomes = comPedido.map((produto) => produto.name).join(", ");
    const andamento = estado.orders.some(
      (pedido) => ids.has(pedido.productId) && PEDIDO_EM_ANDAMENTO.includes(pedido.status),
    );
    return falha(
      `Não dá para excluir ${nomes}: já ${comPedido.length > 1 ? "têm" : "tem"} pedidos` +
        (andamento ? " em andamento" : " no histórico") +
        ". Para tirar da vitrine, edite e zere a quantidade.",
    );
  }
  return {
    ok: true,
    state: {
      ...estado,
      products: estado.products.filter((item) => !ids.has(item.id)),
      offers: estado.offers.filter((item) => !ids.has(item.productId)),
    },
  };
}

/** Arquivo escolhido como foto do produto: devolve a mensagem de erro, ou null se serve. */
export function validarArquivoDeFoto(arquivo: { type: string; size: number }): string | null {
  if (!(FORMATOS_FOTO as readonly string[]).includes(arquivo.type)) return "Use uma foto JPG, PNG ou WebP";
  if (arquivo.size > TAMANHO_MAXIMO_FOTO) return "A foto precisa ter até 1 MB";
  return null;
}
