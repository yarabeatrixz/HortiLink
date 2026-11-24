// Loja parceira: cadastro do ponto de coleta (um por usuário com perfil loja),
// avaliação pelo administrador (US14) e capacidade de armazenamento (US15).

import { STATUS_LOJA, STATUS_PEDIDO, type StatusLoja } from "./constantes";
import { num } from "./formatacao";
import type { Estado, Loja, Numerico, Resultado } from "./tipos";
import { falha, novoId, substituir, texto } from "./util";

export interface DadosLoja {
  name: string;
  address: string;
  city: string;
  hours: string;
  photo?: string;
  dryBoxes?: Numerico;
  coldBoxes?: Numerico;
}

const CAMPOS_OBRIGATORIOS = ["name", "address", "city", "hours"] as const;

const caixas = (valor: Numerico | undefined): number =>
  valor === "" || valor === undefined || valor === null ? 0 : num(valor);

/**
 * Cria ou atualiza o ponto de coleta do usuário. Nunca cria um segundo ponto para
 * o mesmo usuário (LOJA-02). Loja nova começa "Pendente" até o administrador avaliar.
 */
export function salvarLoja(estado: Estado, userId: string, dados: DadosLoja): Resultado {
  if (CAMPOS_OBRIGATORIOS.some((campo) => !texto(dados[campo])))
    return falha("Preencha todos os dados do ponto de coleta");
  const dryBoxes = caixas(dados.dryBoxes);
  const coldBoxes = caixas(dados.coldBoxes);
  if (![dryBoxes, coldBoxes].every((valor) => Number.isInteger(valor) && valor >= 0))
    return falha("Informe a capacidade em número inteiro de caixas (0 ou mais)");

  const existente = estado.stores.find((item) => item.userId === userId);
  const foto = dados.photo === undefined ? existente?.photo : texto(dados.photo) || undefined;
  const loja: Loja = {
    ...existente,
    id: existente?.id ?? novoId(),
    userId,
    name: texto(dados.name),
    address: texto(dados.address),
    city: texto(dados.city),
    hours: texto(dados.hours),
    photo: foto,
    dryBoxes,
    coldBoxes,
    status: existente?.status ?? STATUS_LOJA.PENDENTE,
  };
  return {
    ok: true,
    state: {
      ...estado,
      stores: existente ? substituir(estado.stores, loja.id, () => loja) : [loja, ...estado.stores],
    },
  };
}

// ---------------------------------------------------------------- Administrador

export const DECISOES_LOJA = [STATUS_LOJA.APROVADA, STATUS_LOJA.REPROVADA, STATUS_LOJA.SUSPENSA] as const;

/** Aprovar, reprovar ou suspender um ponto de coleta. Reprovar/suspender exige motivo. */
export function avaliarLoja(
  estado: Estado,
  lojaId: string,
  decisao: { status: StatusLoja | string; note?: string },
  agora: Date = new Date(),
): Resultado {
  const loja = estado.stores.find((item) => item.id === lojaId);
  if (!loja) return falha("Ponto de coleta não encontrado");
  if (!(DECISOES_LOJA as readonly string[]).includes(decisao.status)) return falha("Decisão inválida");
  const motivo = texto(decisao.note);
  if (decisao.status !== STATUS_LOJA.APROVADA && !motivo) return falha("Explique o motivo para a loja");
  return {
    ok: true,
    state: {
      ...estado,
      stores: substituir(estado.stores, lojaId, (item) => ({
        ...item,
        status: decisao.status as StatusLoja,
        reviewNote: motivo || undefined,
        reviewedAt: agora.toISOString(),
      })),
    },
  };
}

// ---------------------------------------------------------------- Capacidade (US15)

/** Pedidos que ocupam espaço na loja: pagos e ainda não retirados. */
const OCUPAM_ESPACO: readonly string[] = [
  STATUS_PEDIDO.PAGO,
  STATUS_PEDIDO.ENTREGUE_NA_LOJA,
  STATUS_PEDIDO.PRONTO_PARA_RETIRADA,
];

export const capacidadeLoja = (loja: Pick<Loja, "dryBoxes" | "coldBoxes">): number =>
  (loja.dryBoxes || 0) + (loja.coldBoxes || 0);

/** Cada pedido pago e ainda não retirado ocupa uma caixa. */
export const ocupacaoLoja = (estado: Pick<Estado, "orders">, lojaId: string): number =>
  estado.orders.filter((pedido) => pedido.storeId === lojaId && OCUPAM_ESPACO.includes(pedido.status))
    .length;

/** Lotada = tem capacidade informada e todas as caixas estão ocupadas. */
export function lojaLotada(estado: Pick<Estado, "orders">, loja: Loja): boolean {
  const capacidade = capacidadeLoja(loja);
  return capacidade > 0 && ocupacaoLoja(estado, loja.id) >= capacidade;
}

export const lojaAprovada = (loja: Pick<Loja, "status"> | undefined): boolean =>
  loja?.status === STATUS_LOJA.APROVADA;

/** Lojas que o produtor pode escolher como ponto de retirada (só aprovadas). */
export const lojasAprovadas = (estado: Pick<Estado, "stores">): Loja[] =>
  estado.stores.filter((loja) => lojaAprovada(loja));

/** O comprador pode retirar nesta loja agora: aprovada e com espaço. */
export const lojaRecebePedido = (estado: Pick<Estado, "orders">, loja: Loja | undefined): boolean =>
  Boolean(loja && lojaAprovada(loja) && !lojaLotada(estado, loja));
