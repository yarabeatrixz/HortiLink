// Casos de uso do MODO CONECTADO: mesma interface de `criarCasosDeUso`, então as
// telas não mudam. Escreve pela API (que confere login, perfil, dono e regras) e
// relê o estado do banco depois de cada escrita.

import { RECOMPENSA_PADRAO } from "@hortilink/banco";
import { validarCadastro, validarNovaSenha } from "@hortilink/dominio";

const PROPOSTAS_INDISPONIVEIS = "Propostas ainda não estão disponíveis.";

/** Estado de quem ainda não entrou: o banco só mostra dados a usuários logados. */
const estadoVazio = () => ({
  users: [],
  products: [],
  offers: [],
  stores: [],
  orders: [],
  proposals: [],
  stockMovements: [],
  expenses: [],
  rewardSettings: { ...RECOMPENSA_PADRAO },
  rewardPayouts: [],
  nextOrderNumber: 1,
});

/**
 * @param {object} portas
 * @param {import("./ports").LeituraPort} portas.leitura
 * @param {import("./ports").AutenticacaoPort} portas.autenticacao
 * @param {import("./ports").EscritaPort} portas.escrita
 */
export function criarCasosDeUsoRemotos({ leitura, autenticacao, escrita }) {
  /** Roda a escrita na API e devolve o estado relido, como os casos de uso locais. */
  const escrever = async (operacao) => {
    const resposta = await operacao();
    return { ...resposta, ok: true, state: await leitura.carregar() };
  };

  /** Lê o estado e acha o usuário que acabou de entrar. */
  const entrarComo = async (userId) => {
    const state = await leitura.carregar();
    const user = state.users.find((usuario) => usuario.id === userId);
    if (!user) throw new Error("Não encontramos o seu perfil. Tente entrar de novo.");
    return { ok: true, user, state };
  };

  const propostaIndisponivel = async () => {
    throw new Error(PROPOSTAS_INDISPONIVEIS);
  };

  return {
    async carregarEstado() {
      return (await autenticacao.usuarioAtual()) ? leitura.carregar() : estadoVazio();
    },
    carregarSessao: () => autenticacao.usuarioAtual(),

    entrar: async (credenciais) => entrarComo(await autenticacao.entrar(credenciais)),
    async cadastrar(dados) {
      // Mesmas mensagens do modo demo; e-mail repetido quem confere é o Supabase Auth.
      const validacao = validarCadastro([], dados);
      if (!validacao.ok) throw new Error(validacao.error);
      return entrarComo(await autenticacao.cadastrar(dados));
    },
    sair: () => autenticacao.sair(),

    salvarProduto: (dados) => escrever(() => escrita.salvarProduto(dados)),
    excluirProduto: (id) => escrever(() => escrita.excluirProduto(id)),
    excluirProdutos: (ids) => escrever(() => escrita.excluirProdutos(ids)),
    criarOferta: (dados) => escrever(() => escrita.criarOferta(dados)),
    encerrarOferta: (id) => escrever(() => escrita.encerrarOferta(id)),
    // O dono é sempre quem está logado (a API usa o token), então o userId não vai na rota.
    salvarPontosRetirada: (_userId, storeIds) =>
      escrever(() => escrita.salvarPontosRetirada(storeIds)),

    criarPedido: (dados) => escrever(() => escrita.criarPedido(dados)),
    pagarPedido: (id, metodo) => escrever(() => escrita.pagarPedido(id, metodo)),
    confirmarEntregaNaLoja: (id) => escrever(() => escrita.confirmarEntregaNaLoja(id)),

    criarProposta: propostaIndisponivel,
    aceitarProposta: propostaIndisponivel,
    recusarProposta: propostaIndisponivel,

    salvarLoja: (_userId, dados) => escrever(() => escrita.salvarLoja(dados)),
    confirmarRecebimento: (id) => escrever(() => escrita.confirmarRecebimento(id)),
    confirmarRetirada: (id, codigo) => escrever(() => escrita.confirmarRetirada(id, codigo)),
    codigoDeRetirada: (id) => escrita.codigoDeRetirada(id),

    atualizarPerfil: (_userId, dados) => escrever(() => escrita.atualizarPerfil(dados)),
    async trocarSenha(_userId, senha, confirmacao) {
      const problema = validarNovaSenha(senha, confirmacao);
      if (problema) throw new Error(problema);
      await autenticacao.trocarSenha(senha);
      return { ok: true, state: await leitura.carregar() };
    },

    avaliarLoja: (lojaId, decisao) => escrever(() => escrita.avaliarLoja(lojaId, decisao)),
    salvarConfigRecompensa: (dados) => escrever(() => escrita.salvarConfigRecompensa(dados)),
    fecharMesRecompensa: (storeId, month) =>
      escrever(() => escrita.fecharMesRecompensa(storeId, month)),

    registrarEntrada: (dados) => escrever(() => escrita.registrarEntrada(dados)),
    registrarPerda: (dados) => escrever(() => escrita.registrarPerda(dados)),
    registrarDespesa: (dados) => escrever(() => escrita.registrarDespesa(dados)),
    excluirDespesa: (id) => escrever(() => escrita.excluirDespesa(id)),
  };
}
