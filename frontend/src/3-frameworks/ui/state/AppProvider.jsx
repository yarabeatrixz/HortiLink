// Ponte entre React e a camada de aplicação: guarda o estado para renderizar e
// expõe ações que chamam os casos de uso. As telas usam só `useApp()`.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SalvandoContext } from "./Salvando";

const AppContext = createContext(null);

export function AppProvider({ casosDeUso, children }) {
  const [data, setData] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  /** Gravação em andamento: um segundo clique reaproveita a mesma (PROD-03). */
  const emAndamento = useRef(null);

  useEffect(() => {
    Promise.all([casosDeUso.carregarEstado(), casosDeUso.carregarSessao()])
      .then(([estado, userId]) => {
        setData(estado);
        setCurrentUserId(userId);
      })
      .catch(() => setLoadError("Não foi possível carregar os dados. Recarregue a página."));
  }, [casosDeUso]);

  const value = useMemo(() => {
    if (!data) return null;
    /** Roda um caso de uso e atualiza a tela com o novo estado (uma gravação por vez). */
    const aplicar = (casoDeUso, ...args) => {
      if (emAndamento.current) return emAndamento.current;
      setSaving(true);
      const execucao = (async () => {
        try {
          const resultado = await casoDeUso(...args);
          setData(resultado.state);
          return resultado;
        } finally {
          emAndamento.current = null;
          setSaving(false);
        }
      })();
      emAndamento.current = execucao;
      return execucao;
    };

    return {
      ...data,
      saving,
      currentUser: data.users.find((user) => user.id === currentUserId) ?? null,

      login: async (credenciais) => {
        const { user } = await aplicar(casosDeUso.entrar, credenciais);
        setCurrentUserId(user.id);
      },
      register: async (dados) => {
        const { user } = await aplicar(casosDeUso.cadastrar, dados);
        setCurrentUserId(user.id);
      },
      logout: async () => {
        await casosDeUso.sair();
        setCurrentUserId(null);
      },
      updateProfile: (dados) => aplicar(casosDeUso.atualizarPerfil, currentUserId, dados),
      changePassword: (senha, confirmacao) =>
        aplicar(casosDeUso.trocarSenha, currentUserId, senha, confirmacao),

      saveProduct: (dados) => aplicar(casosDeUso.salvarProduto, dados),
      deleteProduct: (id) => aplicar(casosDeUso.excluirProduto, id),
      deleteProducts: (ids) => aplicar(casosDeUso.excluirProdutos, ids),
      addOffer: (dados) => aplicar(casosDeUso.criarOferta, dados),
      endOffer: (id) => aplicar(casosDeUso.encerrarOferta, id),
      saveProducerPickupStores: (storeIds) =>
        aplicar(casosDeUso.salvarPontosRetirada, currentUserId, storeIds),

      addOrder: async (dados) => (await aplicar(casosDeUso.criarPedido, dados)).order,
      payOrder: (id, metodo) => aplicar(casosDeUso.pagarPedido, id, metodo),
      confirmOrderDelivered: (id) => aplicar(casosDeUso.confirmarEntregaNaLoja, id),
      getPickupCode: (id) => casosDeUso.codigoDeRetirada(id),

      saveStore: (dados) => aplicar(casosDeUso.salvarLoja, currentUserId, dados),
      confirmOrderReceived: (id) => aplicar(casosDeUso.confirmarRecebimento, id),
      confirmPickup: (id, codigo) => aplicar(casosDeUso.confirmarRetirada, id, codigo),

      reviewStore: (id, decisao) => aplicar(casosDeUso.avaliarLoja, id, decisao),
      saveRewardSettings: (dados) => aplicar(casosDeUso.salvarConfigRecompensa, dados),
      closeRewardMonth: (storeId, month) =>
        aplicar(casosDeUso.fecharMesRecompensa, storeId, month),

      addStockEntry: (dados) => aplicar(casosDeUso.registrarEntrada, dados),
      addStockLoss: (dados) => aplicar(casosDeUso.registrarPerda, dados),
      addExpense: (dados) =>
        aplicar(casosDeUso.registrarDespesa, { ...dados, producerId: currentUserId }),
      deleteExpense: (id) => aplicar(casosDeUso.excluirDespesa, id),
    };
  }, [data, currentUserId, casosDeUso, saving]);

  if (loadError) return <p className="app-loading">{loadError}</p>;
  if (!value) return <p className="app-loading">Carregando…</p>;
  return (
    <AppContext.Provider value={value}>
      <SalvandoContext.Provider value={saving}>{children}</SalvandoContext.Provider>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp precisa estar dentro de <AppProvider>");
  return context;
}
