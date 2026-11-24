import { MOTIVOS_PERDA, registrarPerda, salvarLoja } from "@hortilink/dominio";
import { criarExemplo } from "@hortilink/dominio/exemplo";
import { describe, expect, it } from "vitest";
import { calcularOperacoes, type Linhas, paraEstado, paraLinhas } from "./mapeamento";

const agora = new Date("2026-11-15T12:00:00.000Z");

/** Linhas do banco equivalentes ao exemplo (users vem dos usuários). */
function linhasDoExemplo() {
  const estado = criarExemplo(agora);
  const linhas: Linhas = {
    users: estado.users.map((u) => ({ id: u.id, role: u.role, name: u.name, city: u.city, email: u.email })),
    ...paraLinhas(estado),
  };
  return { estado, linhas };
}

describe("mapeamento banco ↔ domínio", () => {
  it("ida e volta preserva o estado (sem senhas, que ficam no Auth; foto vazia = sem foto; distância não é gravada)", () => {
    const { estado, linhas } = linhasDoExemplo();
    const esperado = {
      ...estado,
      users: estado.users.map(({ password: _senha, ...u }) => u),
      products: estado.products.map((p) => ({ ...p, photo: p.photo || undefined })),
      stores: estado.stores.map(({ distanceKm: _distancia, ...loja }) => loja),
    };
    expect(paraEstado(linhas)).toEqual(esperado);
  });

  it("calcula o próximo número de pedido a partir do maior existente", () => {
    expect(paraEstado(linhasDoExemplo().linhas).nextOrderNumber).toBe(3);
  });

  it("converte números que o banco devolve como texto", () => {
    const { linhas } = linhasDoExemplo();
    linhas.products = linhas.products.map((p) => ({ ...p, price: String(p.price) }));
    expect(paraEstado(linhas).products[0]?.price).toBe(3.5);
  });

  it("aceita perfis sem e-mail (leitura do front, que o RLS não deixa ver)", () => {
    const { linhas } = linhasDoExemplo();
    linhas.users = linhas.users.map(({ email: _email, ...perfil }) => perfil);
    expect(paraEstado(linhas).users.every((u) => u.email === "")).toBe(true);
  });
});

describe("calcularOperacoes", () => {
  it("sem mudança, nenhuma operação", () => {
    const { estado } = linhasDoExemplo();
    expect(calcularOperacoes(estado, structuredClone(estado))).toEqual([]);
  });

  it("perda grava só o produto alterado e o novo movimento", () => {
    const { estado } = linhasDoExemplo();
    const resultado = registrarPerda(estado, { productId: "produto-1", quantity: 5, reason: MOTIVOS_PERDA[0] }, agora);
    if (!resultado.ok) throw new Error(resultado.error);
    const operacoes = calcularOperacoes(estado, resultado.state);
    expect(operacoes.map((o) => [o.tipo, o.tabela])).toEqual([
      ["gravar", "products"],
      ["gravar", "stock_movements"],
    ]);
    const produtos = operacoes[0]?.tipo === "gravar" ? operacoes[0].linhas : [];
    expect(produtos).toEqual([expect.objectContaining({ id: "produto-1", quantity: 115 })]);
  });

  it("apaga filhos antes dos pais e grava pais antes dos filhos", () => {
    const { estado } = linhasDoExemplo();
    const semProduto1 = {
      ...estado,
      products: estado.products.filter((p) => p.id !== "produto-1"),
      offers: estado.offers.filter((o) => o.productId !== "produto-1"),
    };
    const operacoes = calcularOperacoes(estado, semProduto1);
    const apagadas = operacoes.filter((o) => o.tipo === "apagar").map((o) => o.tabela);
    expect(apagadas.indexOf("offer_stores")).toBeLessThan(apagadas.indexOf("offers"));
    expect(apagadas.indexOf("offers")).toBeLessThan(apagadas.indexOf("products"));
  });

  it("loja nova gera um gravar em stores", () => {
    const { estado } = linhasDoExemplo();
    const r = salvarLoja(estado, "user-comprador", { name: "Nova", address: "Rua C", city: "Suzano", hours: "8h" });
    if (!r.ok) throw new Error(r.error);
    expect(calcularOperacoes(estado, r.state)).toEqual([
      { tipo: "gravar", tabela: "stores", linhas: [expect.objectContaining({ name: "Nova", user_id: "user-comprador" })] },
    ]);
  });
});

describe("mapeamento da Sprint 2", () => {
  it("lojas sem as colunas novas (banco antes da migration 0004) continuam aprovadas", () => {
    const { linhas } = linhasDoExemplo();
    linhas.stores = linhas.stores.map(({ status: _s, dry_boxes: _d, cold_boxes: _c, ...resto }) => resto);
    linhas.reward_settings = [];
    linhas.reward_payouts = [];
    const estado = paraEstado(linhas);
    expect(estado.stores[0]).toMatchObject({ status: "Aprovada", dryBoxes: 0, coldBoxes: 0 });
    expect(estado.rewardSettings).toEqual({ fixedAmount: 0, percent: 0 });
  });

  it("mudar nome/cidade gera só um update em users (sem tocar e-mail nem perfil)", () => {
    const antes = criarExemplo(agora);
    const depois = { ...antes, users: antes.users.map((u) => (u.id === "user-loja" ? { ...u, city: "Suzano" } : u)) };
    expect(calcularOperacoes(antes, depois)).toEqual([
      { tipo: "atualizar", tabela: "users", linhas: [{ id: "user-loja", name: "Ana Pereira", city: "Suzano" }] },
    ]);
  });
});
