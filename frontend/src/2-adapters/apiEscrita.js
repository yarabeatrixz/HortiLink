// Adapter da porta `EscritaPort` (ver 1-application/ports.js): chama as rotas de
// escrita da API (docs/BACKEND.md) com `fetch` e o token do usuário logado.
// Envia só os campos que a rota aceita: a API recusa campos a mais (400).

const ERRO_DE_REDE = "Não foi possível falar com o servidor. Confira sua conexão e tente de novo.";
const ERRO_SEM_LOGIN = "Sua sessão expirou. Entre de novo.";
const ERRO_GENERICO = "Não foi possível concluir agora. Tente de novo.";

/** Campos aceitos pelo corpo de cada rota (os esquemas da API). */
const CAMPOS = {
  produto: ["name", "category", "unit", "price", "quantity", "minQuantity", "photo"],
  oferta: ["productId", "quantity", "promotionalPrice", "city", "validityDays", "storeIds"],
  pedido: ["type", "sourceId", "productId", "quantity", "storeId"],
  loja: ["name", "address", "city", "hours", "photo", "dryBoxes", "coldBoxes"],
  perfil: ["name", "city"],
  entrada: ["productId", "quantity", "unitCost", "note"],
  perda: ["productId", "quantity", "reason", "note"],
  despesa: ["type", "description", "amount"],
};

/** Copia só os campos da lista que têm valor. */
const escolher = (dados, campos) =>
  Object.fromEntries(
    campos.filter((campo) => dados[campo] != null).map((campo) => [campo, dados[campo]]),
  );

const lerJson = (resposta) => resposta.json().catch(() => ({}));

/**
 * @param {object} opcoes
 * @param {string} opcoes.urlBase  ex.: https://api.hortilink.app
 * @param {() => Promise<string|null>} opcoes.obterToken  token de sessão do Supabase Auth
 * @param {typeof fetch} [opcoes.fetch]  injetável para testes
 * @returns {import("@application/ports").EscritaPort}
 */
export function criarApiEscrita({ urlBase, obterToken, fetch = globalThis.fetch }) {
  const base = urlBase.replace(/\/+$/, "");

  /** Chama a rota e devolve o JSON; resposta de erro vira `Error(mensagem da API)`. */
  async function enviar(metodo, caminho, corpo) {
    const token = await obterToken();
    if (!token) throw new Error(ERRO_SEM_LOGIN);

    const headers = { Authorization: `Bearer ${token}` };
    if (corpo) headers["Content-Type"] = "application/json";

    let resposta;
    try {
      resposta = await fetch(`${base}${caminho}`, {
        method: metodo,
        headers,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch {
      throw new Error(ERRO_DE_REDE);
    }

    const json = await lerJson(resposta);
    if (resposta.ok) return json;
    if (json.error) throw new Error(json.error);
    throw new Error(resposta.status === 401 ? ERRO_SEM_LOGIN : ERRO_GENERICO);
  }

  const semRetorno = async (metodo, caminho, corpo) => {
    await enviar(metodo, caminho, corpo);
  };
  const id = encodeURIComponent;

  return {
    salvarProduto: (dados) =>
      dados.id
        ? semRetorno("PUT", `/products/${id(dados.id)}`, escolher(dados, CAMPOS.produto))
        : semRetorno("POST", "/products", escolher(dados, CAMPOS.produto)),
    excluirProduto: (produtoId) => semRetorno("DELETE", `/products/${id(produtoId)}`),
    criarOferta: (dados) => semRetorno("POST", "/offers", escolher(dados, CAMPOS.oferta)),
    encerrarOferta: (ofertaId) => semRetorno("POST", `/offers/${id(ofertaId)}/end`),
    salvarPontosRetirada: (storeIds) =>
      semRetorno("PUT", "/producers/me/pickup-stores", { storeIds }),

    async criarPedido(dados) {
      const { order } = await enviar("POST", "/orders", escolher(dados, CAMPOS.pedido));
      return { order };
    },
    pagarPedido: (pedidoId, metodo) =>
      semRetorno("POST", `/orders/${id(pedidoId)}/pay`, { method: metodo }),
    confirmarEntregaNaLoja: (pedidoId) =>
      semRetorno("POST", `/orders/${id(pedidoId)}/delivered`),

    salvarLoja: (dados) => semRetorno("PUT", "/stores/me", escolher(dados, CAMPOS.loja)),
    confirmarRecebimento: (pedidoId) => semRetorno("POST", `/orders/${id(pedidoId)}/received`),
    confirmarRetirada: (pedidoId, codigo) =>
      semRetorno("POST", `/orders/${id(pedidoId)}/picked-up`, { code: String(codigo) }),
    async codigoDeRetirada(pedidoId) {
      const { code } = await enviar("GET", `/orders/${id(pedidoId)}/pickup-code`);
      return code;
    },

    excluirProdutos: (ids) => semRetorno("POST", "/products/delete", { ids }),
    atualizarPerfil: (dados) => semRetorno("PUT", "/users/me", escolher(dados, CAMPOS.perfil)),

    avaliarLoja: (lojaId, decisao) =>
      semRetorno("POST", `/admin/stores/${id(lojaId)}/review`, {
        status: decisao.status,
        ...(decisao.note ? { note: decisao.note } : {}),
      }),
    salvarConfigRecompensa: (dados) =>
      semRetorno("PUT", "/admin/reward-settings", {
        fixedAmount: dados.fixedAmount,
        percent: dados.percent,
      }),
    fecharMesRecompensa: (storeId, month) =>
      semRetorno("POST", "/admin/reward-payouts", { storeId, month }),

    registrarEntrada: (dados) =>
      semRetorno("POST", "/stock/entries", escolher(dados, CAMPOS.entrada)),
    registrarPerda: (dados) => semRetorno("POST", "/stock/losses", escolher(dados, CAMPOS.perda)),
    registrarDespesa: (dados) =>
      semRetorno("POST", "/expenses", escolher(dados, CAMPOS.despesa)),
    excluirDespesa: (despesaId) => semRetorno("DELETE", `/expenses/${id(despesaId)}`),
  };
}
