// Regras da Sprint 2: administrador, capacidade, recompensa, retirada com código,
// exclusão em lote e configurações do perfil.

import { describe, expect, it } from "vitest";
import { STATUS_LOJA, STATUS_PEDIDO } from "./constantes";
import { criarExemplo } from "./exemplo";
import { avaliarLoja, lojaLotada, lojasAprovadas, ocupacaoLoja, salvarLoja } from "./lojas";
import {
  codigoDeRetirada,
  confirmarEntregaNaLoja,
  confirmarRecebimentoNaLoja,
  confirmarRetirada,
  criarPedidoDireto,
} from "./pedidos";
import { excluirProdutos } from "./produtos";
import { extratoDaLoja, fecharMesRecompensa, mesAtual, salvarConfigRecompensa } from "./recompensas";
import { compraDaOferta, falhaDe, porId, sucesso } from "./testes";
import type { Estado } from "./tipos";
import { atualizarPerfil, cadastrarUsuario, trocarSenhaDemo } from "./usuarios";

const SEGREDO = "segredo-de-teste";
const AGORA = new Date("2026-11-20T12:00:00.000Z");

/** Pedido-2 (pago, loja-1) já entregue na loja pelo produtor. */
const comPedidoNaLoja = (): Estado => sucesso(confirmarEntregaNaLoja(criarExemplo(), "pedido-2", AGORA)).state;

describe("loja: cadastro (LOJA-01/02) e avaliação do administrador (US14)", () => {
  it("loja nova começa pendente, com foto e capacidade; salvar de novo não duplica", () => {
    const dados = { name: "Sacolão", address: "Rua A, 1", city: "Suzano", hours: "8h", photo: "https://x.y/f.jpg", dryBoxes: "3", coldBoxes: 2 };
    const primeira = sucesso(salvarLoja(criarExemplo(), "user-nova", dados)).state;
    const segunda = sucesso(salvarLoja(primeira, "user-nova", { ...dados, name: "Sacolão 2" })).state;
    const minhas = segunda.stores.filter((loja) => loja.userId === "user-nova");
    expect(minhas).toHaveLength(1);
    expect(minhas[0]).toMatchObject({ name: "Sacolão 2", status: STATUS_LOJA.PENDENTE, dryBoxes: 3, coldBoxes: 2, photo: "https://x.y/f.jpg" });
  });

  it("capacidade precisa ser inteiro não negativo", () => {
    const dados = { name: "A", address: "B", city: "C", hours: "D", dryBoxes: -1 };
    expect(falhaDe(salvarLoja(criarExemplo(), "user-loja", dados))).toMatch(/capacidade/);
  });

  it("administrador aprova; reprovar ou suspender exige motivo", () => {
    expect(lojasAprovadas(criarExemplo()).map((loja) => loja.id)).not.toContain("loja-3");
    const aprovada = sucesso(avaliarLoja(criarExemplo(), "loja-3", { status: STATUS_LOJA.APROVADA }, AGORA));
    expect(lojasAprovadas(aprovada.state).map((loja) => loja.id)).toContain("loja-3");
    expect(falhaDe(avaliarLoja(criarExemplo(), "loja-1", { status: STATUS_LOJA.SUSPENSA }))).toMatch(/motivo/);
    const suspensa = sucesso(avaliarLoja(criarExemplo(), "loja-1", { status: STATUS_LOJA.SUSPENSA, note: "Fechada para reforma" }));
    expect(porId(suspensa.state.stores, "loja-1")).toMatchObject({ status: STATUS_LOJA.SUSPENSA, reviewNote: "Fechada para reforma" });
  });

  it("compra em loja suspensa ou lotada é recusada (US15)", () => {
    const suspensa = sucesso(avaliarLoja(criarExemplo(), "loja-1", { status: STATUS_LOJA.SUSPENSA, note: "x" })).state;
    expect(falhaDe(criarPedidoDireto(suspensa, compraDaOferta))).toMatch(/não está disponível/);

    const estado = criarExemplo();
    const lotada = { ...estado, stores: estado.stores.map((loja) => (loja.id === "loja-1" ? { ...loja, dryBoxes: 1, coldBoxes: 0 } : loja)) };
    expect(ocupacaoLoja(lotada, "loja-1")).toBe(1); // pedido-2 pago
    expect(lojaLotada(lotada, porId(lotada.stores, "loja-1"))).toBe(true);
    expect(falhaDe(criarPedidoDireto(lotada, compraDaOferta))).toMatch(/lotado/);
  });
});

describe("retirada com código (US10)", () => {
  it("código tem 6 dígitos, é estável e depende do segredo", () => {
    expect(codigoDeRetirada("pedido-2", SEGREDO)).toMatch(/^\d{6}$/);
    expect(codigoDeRetirada("pedido-2", SEGREDO)).toBe(codigoDeRetirada("pedido-2", SEGREDO));
    expect(codigoDeRetirada("pedido-2", "outro")).not.toBe(codigoDeRetirada("pedido-2", SEGREDO));
  });

  it("loja libera, confere o código e o pedido vira Retirado", () => {
    const pronto = sucesso(confirmarRecebimentoNaLoja(comPedidoNaLoja(), "pedido-2", AGORA)).state;
    expect(porId(pronto.orders, "pedido-2").status).toBe(STATUS_PEDIDO.PRONTO_PARA_RETIRADA);
    expect(falhaDe(confirmarRetirada(pronto, "pedido-2", "000000", SEGREDO))).toMatch(/incorreto/);
    const codigo = codigoDeRetirada("pedido-2", SEGREDO);
    const retirado = sucesso(confirmarRetirada(pronto, "pedido-2", codigo, SEGREDO, AGORA)).state;
    expect(porId(retirado.orders, "pedido-2")).toMatchObject({ status: STATUS_PEDIDO.RETIRADO, pickedUpAt: AGORA.toISOString() });
  });

  it("pedido que não chegou à loja não pode ser retirado", () => {
    const codigo = codigoDeRetirada("pedido-2", SEGREDO);
    expect(falhaDe(confirmarRetirada(criarExemplo(), "pedido-2", codigo, SEGREDO))).toMatch(/ainda não está na loja/);
  });
});

describe("recompensa das lojas (US16)", () => {
  const retirado = (): Estado =>
    sucesso(confirmarRetirada(comPedidoNaLoja(), "pedido-2", codigoDeRetirada("pedido-2", SEGREDO), SEGREDO, AGORA)).state;

  it("valida a regra e calcula fixo + porcentagem por pedido retirado", () => {
    expect(falhaDe(salvarConfigRecompensa(criarExemplo(), { fixedAmount: 1, percent: 120 }))).toMatch(/porcentagem/);
    const estado = sucesso(salvarConfigRecompensa(retirado(), { fixedAmount: "2", percent: "10" })).state;
    const extrato = extratoDaLoja(estado, "loja-1", mesAtual(AGORA));
    // pedido-2: 12 × R$ 2,20 = R$ 26,40 → 2 + 10% = R$ 4,64
    expect(extrato).toMatchObject({ ordersCount: 1, salesTotal: 26.4, amount: 4.64 });
  });

  it("fecha o mês uma única vez e congela o valor", () => {
    const DEPOIS = new Date("2026-12-02T12:00:00.000Z");
    expect(falhaDe(fecharMesRecompensa(retirado(), "loja-1", "2026-11", AGORA))).toMatch(/depois que ele terminar/);
    const fechado = sucesso(fecharMesRecompensa(retirado(), "loja-1", "2026-11", DEPOIS));
    expect(fechado.payout).toMatchObject({ storeId: "loja-1", month: "2026-11", ordersCount: 1 });
    expect(falhaDe(fecharMesRecompensa(fechado.state, "loja-1", "2026-11", DEPOIS))).toMatch(/já foi fechado/);
    const mudouRegra = sucesso(salvarConfigRecompensa(fechado.state, { fixedAmount: 50, percent: 50 })).state;
    expect(extratoDaLoja(mudouRegra, "loja-1", "2026-11").amount).toBe(fechado.payout.amount);
    expect(falhaDe(fecharMesRecompensa(criarExemplo(), "loja-1", "2026-11", DEPOIS))).toMatch(/Nenhum pedido/);
    expect(falhaDe(fecharMesRecompensa(criarExemplo(), "loja-1", "2027-01", AGORA))).toMatch(/não começou/);
  });
});

describe("catálogo e perfil", () => {
  it("exclui vários produtos e as ofertas deles de uma vez (PROD-02)", () => {
    const r = sucesso(excluirProdutos({ ...criarExemplo(), orders: [] }, ["produto-1", "produto-2"]));
    expect(r.state.products.map((p) => p.id)).not.toContain("produto-1");
    expect(r.state.offers.some((o) => ["produto-1", "produto-2"].includes(o.productId))).toBe(false);
    expect(falhaDe(excluirProdutos(criarExemplo(), []))).toMatch(/Selecione/);
  });

  it("atualiza nome e cidade e troca a senha no modo demo (GER-01)", () => {
    const r = sucesso(atualizarPerfil(criarExemplo(), "user-comprador", { name: " Marina C. ", city: "Mogi" }));
    expect(porId(r.state.users, "user-comprador")).toMatchObject({ name: "Marina C.", city: "Mogi" });
    expect(falhaDe(trocarSenhaDemo(criarExemplo(), "user-comprador", "12345678", "1234567x"))).toMatch(/não conferem/);
    expect(porId(sucesso(trocarSenhaDemo(criarExemplo(), "user-comprador", "12345678", "12345678")).state.users, "user-comprador").password).toBe("12345678");
  });

  it("ninguém se cadastra como administrador", () => {
    const dados = { role: "admin" as const, name: "X", city: "Y", email: "x@y.com", password: "12345678" };
    expect(falhaDe(cadastrarUsuario(criarExemplo(), dados))).toMatch(/perfil válido/);
  });
});
