// Casos de uso da API: quem pode fazer o quê (perfil e dono) + as regras do
// domínio. O domínio valida o NEGÓCIO; aqui se valida a AUTORIZAÇÃO.
// Toda escrita do sistema passa por aqui (o cliente só lê do banco, via RLS).

import {
  atualizarPerfil,
  avaliarLoja,
  cancelarPedido,
  expirarPedidosVencidos,
  codigoDeRetirada,
  confirmarEntregaNaLoja,
  confirmarRecebimentoNaLoja,
  confirmarRetirada,
  type DadosPerfil,
  excluirProdutos,
  fecharMesRecompensa,
  lojaAprovada,
  pedidoNaLoja,
  salvarConfigRecompensa,
  criarOferta,
  criarPedidoDireto,
  type DadosCompra,
  type DadosDespesa,
  type DadosEntrada,
  type DadosLoja,
  type DadosOferta,
  type DadosPerda,
  type DadosProduto,
  encerrarOferta,
  type Estado,
  excluirDespesa,
  excluirProduto,
  type MetodoPagamento,
  pagarPedido,
  type Perfil,
  registrarDespesa,
  registrarEntrada,
  registrarPerda,
  type Resultado,
  salvarLoja,
  salvarPontosRetirada,
  salvarProduto,
  type Usuario,
} from "@hortilink/dominio";
import { naoAutenticado, naoEncontrado, proibido, violouRegra } from "./erros";
import type { Relogio, RepositorioPort } from "./portas";

type Sucesso<E extends object> = Extract<Resultado<E>, { ok: true }>;

/** Dados de produto vindos do cliente: o dono é sempre quem está logado. */
export type EntradaProduto = Omit<DadosProduto, "producerId">;
/** Dados de compra vindos do cliente: o comprador é sempre quem está logado. */
export type EntradaCompra = Omit<DadosCompra, "buyerId">;
/** Dados de despesa vindos do cliente: o produtor é sempre quem está logado. */
export type EntradaDespesa = Omit<DadosDespesa, "producerId">;

export interface Dependencias {
  repositorio: RepositorioPort;
  relogio?: Relogio;
  /** Segredo do código de retirada (US10). Só o servidor conhece. */
  segredoRetirada?: string | undefined;
}

export const SEGREDO_RETIRADA_DEMO = "hortilink-demo";
/** Código de retirada: erros seguidos permitidos por pedido e tempo de bloqueio. */
export const TENTATIVAS_CODIGO = 5;
export const BLOQUEIO_CODIGO_MS = 15 * 60_000;

export function criarCasosDeUso({
  repositorio,
  relogio = () => new Date(),
  segredoRetirada = SEGREDO_RETIRADA_DEMO,
}: Dependencias) {
  /**
   * Fila de gravação (Sprint 3, achado 2 da banca): uma escrita por vez nesta
   * instância da API. Sem ela, duas compras simultâneas liam o mesmo estoque e o
   * mesmo número de pedido e as duas "vendiam". A API roda em UMA instância no
   * Render; com várias instâncias seria preciso uma trava no banco (docs/SPRINT-3.md).
   */
  let fila: Promise<unknown> = Promise.resolve();
  function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const vez = fila.then(tarefa, tarefa);
    fila = vez.catch(() => undefined);
    return vez;
  }

  /**
   * Carrega o estado, identifica o usuário, roda `regra` e grava o resultado.
   * `regra` pode lançar erros de autorização antes de chamar o domínio.
   * Antes da regra, pedidos não pagos no prazo são cancelados e o estoque volta.
   */
  function executar<E extends object>(
    userId: string,
    regra: (estado: Estado, usuario: Usuario, agora: Date) => Resultado<E>,
  ): Promise<Sucesso<E>> {
    return emFila(async () => {
      const antes = await repositorio.carregar();
      const usuario = antes.users.find((item) => item.id === userId);
      if (!usuario) throw naoAutenticado();
      const agora = relogio();
      const resultado = regra(expirarPedidosVencidos(antes, agora), usuario, agora);
      if (!resultado.ok) throw violouRegra(resultado.error);
      await repositorio.salvar(antes, resultado.state);
      return resultado as Sucesso<E>;
    });
  }

  /**
   * Erros do código de retirada por pedido (achado 7 da banca): depois de
   * TENTATIVAS_CODIGO erros seguidos o pedido fica bloqueado por BLOQUEIO_CODIGO_MS.
   */
  const errosDoCodigo = new Map<string, { erros: number; bloqueadoAte: number }>();
  function conferirBloqueio(pedidoId: string, agora: Date) {
    if ((errosDoCodigo.get(pedidoId)?.bloqueadoAte ?? 0) > agora.getTime())
      throw violouRegra("Muitos códigos errados para este pedido. Aguarde 15 minutos e confira com o comprador.");
  }
  function registrarErroDoCodigo(pedidoId: string, agora: Date) {
    const erros = (errosDoCodigo.get(pedidoId)?.erros ?? 0) + 1;
    errosDoCodigo.set(
      pedidoId,
      erros >= TENTATIVAS_CODIGO
        ? { erros: 0, bloqueadoAte: agora.getTime() + BLOQUEIO_CODIGO_MS }
        : { erros, bloqueadoAte: 0 },
    );
  }

  const exigirPerfil = (usuario: Usuario, perfil: Perfil) => {
    if (usuario.role !== perfil) throw proibido(`Ação disponível só para o perfil ${perfil}`);
  };

  /** Busca por id e confere se pertence ao usuário (campo de dono informado). */
  function doUsuario<T extends { id: string }>(
    lista: T[],
    id: string,
    dono: (item: T) => string,
    usuario: Usuario,
    nome: string,
  ): T {
    const item = lista.find((atual) => atual.id === id);
    if (!item) throw naoEncontrado(`${nome} não encontrado`);
    if (dono(item) !== usuario.id) throw proibido(`Este ${nome.toLowerCase()} não é seu`);
    return item;
  }

  /**
   * Toda loja citada precisa existir e estar aprovada pelo administrador (US14).
   * `jaEscolhidas` continuam aceitas (o produtor pode remover outras sem erro).
   */
  const exigirLojas = (estado: Estado, storeIds: string[], jaEscolhidas: string[] = []) => {
    for (const id of storeIds) {
      const loja = estado.stores.find((item) => item.id === id);
      if (!loja) throw naoEncontrado("Ponto de retirada não encontrado");
      if (!lojaAprovada(loja) && !jaEscolhidas.includes(id))
        throw violouRegra(`O ponto "${loja.name}" ainda não foi aprovado pela HortiLink`);
    }
  };

  /** Confere que o pedido é retirado na loja do usuário logado (perfil loja). */
  const exigirPedidoDaMinhaLoja = (estado: Estado, usuario: Usuario, pedidoId: string) => {
    exigirPerfil(usuario, "loja");
    const loja = estado.stores.find((item) => item.userId === usuario.id);
    if (!loja) throw naoEncontrado("Cadastre seu ponto de coleta primeiro");
    const pedido = estado.orders.find((item) => item.id === pedidoId);
    if (!pedido) throw naoEncontrado("Pedido não encontrado");
    if (pedido.storeId !== loja.id) throw proibido("Este pedido não é retirado no seu ponto");
    // Loja suspensa ou em análise não movimenta pedidos (achado 14 da banca).
    if (!lojaAprovada(loja))
      throw proibido("Seu ponto não está aprovado no momento. Fale com a HortiLink sobre os pedidos.");
    return pedido;
  };

  return {
    // ------------------------------------------------------------ Produtor
    salvarProduto: (userId: string, dados: EntradaProduto) =>
      executar(userId, (estado, usuario) => {
        exigirPerfil(usuario, "produtor");
        if (dados.id) doUsuario(estado.products, dados.id, (p) => p.producerId, usuario, "Produto");
        return salvarProduto(estado, { ...dados, producerId: usuario.id });
      }),

    excluirProdutos: (userId: string, produtoIds: string[]) =>
      executar(userId, (estado, usuario) => {
        exigirPerfil(usuario, "produtor");
        for (const id of produtoIds) doUsuario(estado.products, id, (p) => p.producerId, usuario, "Produto");
        return excluirProdutos(estado, produtoIds);
      }),

    excluirProduto: (userId: string, produtoId: string) =>
      executar(userId, (estado, usuario) => {
        exigirPerfil(usuario, "produtor");
        doUsuario(estado.products, produtoId, (p) => p.producerId, usuario, "Produto");
        return excluirProduto(estado, produtoId);
      }),

    criarOferta: (userId: string, dados: DadosOferta) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPerfil(usuario, "produtor");
        doUsuario(estado.products, dados.productId, (p) => p.producerId, usuario, "Produto");
        exigirLojas(estado, dados.storeIds);
        return criarOferta(estado, dados, agora);
      }),

    encerrarOferta: (userId: string, ofertaId: string) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPerfil(usuario, "produtor");
        doUsuario(estado.offers, ofertaId, (o) => o.producerId, usuario, "Oferta");
        return encerrarOferta(estado, ofertaId, agora);
      }),

    salvarPontosRetirada: (userId: string, storeIds: string[]) =>
      executar(userId, (estado, usuario) => {
        exigirPerfil(usuario, "produtor");
        exigirLojas(estado, storeIds, usuario.pickupStoreIds);
        return salvarPontosRetirada(estado, usuario.id, storeIds);
      }),

    confirmarEntregaNaLoja: (userId: string, pedidoId: string) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPerfil(usuario, "produtor");
        doUsuario(estado.orders, pedidoId, (o) => o.producerId, usuario, "Pedido");
        return confirmarEntregaNaLoja(estado, pedidoId, agora);
      }),

    registrarEntrada: (userId: string, dados: DadosEntrada) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPerfil(usuario, "produtor");
        doUsuario(estado.products, dados.productId, (p) => p.producerId, usuario, "Produto");
        return registrarEntrada(estado, dados, agora);
      }),

    registrarPerda: (userId: string, dados: DadosPerda) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPerfil(usuario, "produtor");
        doUsuario(estado.products, dados.productId, (p) => p.producerId, usuario, "Produto");
        return registrarPerda(estado, dados, agora);
      }),

    registrarDespesa: (userId: string, dados: EntradaDespesa) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPerfil(usuario, "produtor");
        return registrarDespesa(estado, { ...dados, producerId: usuario.id }, agora);
      }),

    excluirDespesa: (userId: string, despesaId: string) =>
      executar(userId, (estado, usuario) => {
        exigirPerfil(usuario, "produtor");
        doUsuario(estado.expenses, despesaId, (d) => d.producerId, usuario, "Registro");
        return excluirDespesa(estado, despesaId);
      }),

    // ------------------------------------------------------------ Comprador
    criarPedido: (userId: string, dados: EntradaCompra) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPerfil(usuario, "comprador");
        return criarPedidoDireto(estado, { ...dados, buyerId: usuario.id }, agora);
      }),

    /** O comprador desiste antes de pagar: o estoque volta (Sprint 3). */
    cancelarPedido: (userId: string, pedidoId: string) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPerfil(usuario, "comprador");
        doUsuario(estado.orders, pedidoId, (o) => o.buyerId, usuario, "Pedido");
        return cancelarPedido(estado, pedidoId, agora);
      }),

    /**
     * Pagamento SIMULADO: decisão da equipe para o TCC (sem provedor real).
     * Por isso a recompensa das lojas é só demonstrativa (docs/SPRINT-3.md).
     */
    pagarPedido: (userId: string, pedidoId: string, metodo: MetodoPagamento) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPerfil(usuario, "comprador");
        doUsuario(estado.orders, pedidoId, (o) => o.buyerId, usuario, "Pedido");
        return pagarPedido(estado, pedidoId, metodo, agora);
      }),

    /** Código de retirada: só o comprador do pedido, e só quando o produto está na loja. */
    async codigoDeRetirada(userId: string, pedidoId: string): Promise<string> {
      const estado = await repositorio.carregar();
      const usuario = estado.users.find((item) => item.id === userId);
      if (!usuario) throw naoAutenticado();
      exigirPerfil(usuario, "comprador");
      const pedido = doUsuario(estado.orders, pedidoId, (o) => o.buyerId, usuario, "Pedido");
      if (!pedidoNaLoja(pedido)) throw violouRegra("O código aparece quando o produto chegar à loja");
      return codigoDeRetirada(pedido.id, segredoRetirada);
    },

    // ------------------------------------------------------------ Loja parceira
    salvarLoja: (userId: string, dados: DadosLoja) =>
      executar(userId, (estado, usuario) => {
        exigirPerfil(usuario, "loja");
        return salvarLoja(estado, usuario.id, dados);
      }),

    confirmarRecebimento: (userId: string, pedidoId: string) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPedidoDaMinhaLoja(estado, usuario, pedidoId);
        return confirmarRecebimentoNaLoja(estado, pedidoId, agora);
      }),

    confirmarRetirada: (userId: string, pedidoId: string, codigo: string) =>
      executar(userId, (estado, usuario, agora) => {
        const pedido = exigirPedidoDaMinhaLoja(estado, usuario, pedidoId);
        conferirBloqueio(pedidoId, agora);
        const digitado = String(codigo ?? "").replace(/\D/g, "");
        if (pedidoNaLoja(pedido) && digitado !== codigoDeRetirada(pedidoId, segredoRetirada)) {
          registrarErroDoCodigo(pedidoId, agora);
          throw violouRegra("Código de retirada incorreto. Confira com o comprador.");
        }
        errosDoCodigo.delete(pedidoId);
        return confirmarRetirada(estado, pedidoId, codigo, segredoRetirada, agora);
      }),

    // ------------------------------------------------------------ Todos os perfis
    atualizarPerfil: (userId: string, dados: DadosPerfil) =>
      executar(userId, (estado, usuario) => atualizarPerfil(estado, usuario.id, dados)),

    // ------------------------------------------------------------ Administrador
    avaliarLoja: (userId: string, lojaId: string, decisao: { status: string; note?: string }) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPerfil(usuario, "admin");
        return avaliarLoja(estado, lojaId, decisao, agora);
      }),

    salvarConfigRecompensa: (userId: string, dados: { fixedAmount: number | string; percent: number | string }) =>
      executar(userId, (estado, usuario) => {
        exigirPerfil(usuario, "admin");
        return salvarConfigRecompensa(estado, dados);
      }),

    fecharMesRecompensa: (userId: string, storeId: string, month: string) =>
      executar(userId, (estado, usuario, agora) => {
        exigirPerfil(usuario, "admin");
        return fecharMesRecompensa(estado, storeId, month, agora);
      }),
  };
}

export type CasosDeUso = ReturnType<typeof criarCasosDeUso>;
