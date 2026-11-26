// Sprint 3: testes de regressão dos achados da banca de revisão
// (docs/SPRINT-3.md). Cada teste reproduz um defeito que existia.
import { describe, expect, it } from "vitest";
import { ORIGEM, STATUS_LOJA, STATUS_PEDIDO } from "./constantes";
import { registrarPerda } from "./estoque";
import { criarExemplo } from "./exemplo";
import { hmacSha256Hex } from "./hmac";
import { salvarLoja } from "./lojas";
import { criarOferta } from "./ofertas";
import {
  cancelarPedido,
  codigoDeRetirada,
  criarPedidoDireto,
  expirarPedidosVencidos,
  pagarPedido,
} from "./pedidos";
import { compraDaOferta, falhaDe, porId, sucesso } from "./testes";
import type { Estado } from "./tipos";
import { autenticar, cadastrarUsuario, contaComSenha, mensagemPerfilErrado } from "./usuarios";

const AGORA = new Date("2026-11-20T12:00:00.000Z");
const minutosDepois = (minutos: number) => new Date(AGORA.getTime() + minutos * 60_000);

describe("compra: preço e estoque (itens 1 e 3)", () => {
  it("recusa usar a oferta de OUTRO produto (preço manipulado)", () => {
    const comOferta = sucesso(
      criarOferta(
        criarExemplo(AGORA),
        {
          productId: "produto-3",
          quantity: 10,
          promotionalPrice: 0.5,
          city: "Mogi",
          validityDays: 3,
          storeIds: ["loja-1"],
        },
        AGORA,
      ),
    ).state;
    const ofertaBarata = comOferta.offers[0];
    if (!ofertaBarata) throw new Error("oferta não criada");
    const compra = { ...compraDaOferta, sourceId: ofertaBarata.id, productId: "produto-1" };
    expect(falhaDe(criarPedidoDireto(comOferta, compra, AGORA))).toMatch(/não é deste produto/);
  });

  it("compra pela oferta não passa do estoque real do produto", () => {
    // produto-1 tem 120 e a oferta-1 tem 60; uma perda de 100 deixa o produto com 20.
    const aposPerda = sucesso(
      registrarPerda(
        criarExemplo(AGORA),
        { productId: "produto-1", quantity: 100, reason: "Estragou / passou do ponto" },
        AGORA,
      ),
    ).state;
    expect(
      falhaDe(criarPedidoDireto(aposPerda, { ...compraDaOferta, quantity: 50 }, AGORA)),
    ).toMatch(/acima da disponível/);
    const ok = sucesso(criarPedidoDireto(aposPerda, { ...compraDaOferta, quantity: 20 }, AGORA));
    expect(porId(ok.state.products, "produto-1").quantity).toBe(0);
  });

  it("ofertas ativas do mesmo produto somadas não passam do estoque", () => {
    const dados = {
      productId: "produto-1",
      quantity: 100,
      promotionalPrice: 2,
      city: "Mogi",
      validityDays: 3,
      storeIds: ["loja-1"],
    };
    expect(falhaDe(criarOferta(criarExemplo(AGORA), dados, AGORA))).toMatch(
      /outras ofertas ativas/,
    );
    expect(
      falhaDe(
        criarOferta(criarExemplo(AGORA), { ...dados, quantity: 1, validityDays: 2.5 }, AGORA),
      ),
    ).toMatch(/validade/);
  });
});

describe("cancelamento e prazo de pagamento (item 4)", () => {
  const comPedido = (): { estado: Estado; id: string } => {
    const r = sucesso(
      criarPedidoDireto(criarExemplo(AGORA), { ...compraDaOferta, quantity: 10 }, AGORA),
    );
    return { estado: r.state, id: r.order.id };
  };

  it("o comprador cancela e o estoque volta para o produto e a oferta", () => {
    const antes = criarExemplo(AGORA);
    const { estado, id } = comPedido();
    const cancelado = sucesso(cancelarPedido(estado, id, AGORA)).state;
    expect(porId(cancelado.orders, id).status).toBe(STATUS_PEDIDO.CANCELADO);
    expect(porId(cancelado.products, "produto-1").quantity).toBe(
      porId(antes.products, "produto-1").quantity,
    );
    expect(porId(cancelado.offers, "oferta-1").quantity).toBe(
      porId(antes.offers, "oferta-1").quantity,
    );
    expect(falhaDe(cancelarPedido(cancelado, id, AGORA))).toMatch(/aguardando pagamento/);
  });

  it("pedido não pago em 30 minutos expira e devolve o estoque; não dá mais para pagar", () => {
    const { estado, id } = comPedido();
    expect(porId(expirarPedidosVencidos(estado, minutosDepois(29)).orders, id).status).toBe(
      STATUS_PEDIDO.AGUARDANDO_PAGAMENTO,
    );
    const expirado = expirarPedidosVencidos(estado, minutosDepois(31));
    expect(porId(expirado.orders, id).status).toBe(STATUS_PEDIDO.CANCELADO);
    expect(porId(expirado.offers, "oferta-1").quantity).toBe(
      porId(criarExemplo(AGORA).offers, "oferta-1").quantity + 4,
    );
    expect(falhaDe(pagarPedido(estado, id, "Pix", minutosDepois(31)))).toMatch(/prazo/);
  });
});

describe("pagamento confere a loja (item 13)", () => {
  it("recusa pagar se a loja foi suspensa ou lotou depois da compra", () => {
    const r = sucesso(criarPedidoDireto(criarExemplo(AGORA), compraDaOferta, AGORA));
    const suspensa: Estado = {
      ...r.state,
      stores: r.state.stores.map((loja) =>
        loja.id === "loja-1" ? { ...loja, status: STATUS_LOJA.SUSPENSA } : loja,
      ),
    };
    expect(falhaDe(pagarPedido(suspensa, r.order.id, "Pix", AGORA))).toMatch(/não está disponível/);
    const lotada: Estado = {
      ...r.state,
      stores: r.state.stores.map((loja) =>
        loja.id === "loja-1" ? { ...loja, dryBoxes: 1, coldBoxes: 0 } : loja,
      ),
    };
    expect(falhaDe(pagarPedido(lotada, r.order.id, "Pix", AGORA))).toMatch(/lotou/);
  });
});

describe("loja aprovada que muda de endereço volta para análise (item 14)", () => {
  it("nome/endereço/cidade novos → Pendente; só horário → continua Aprovada", () => {
    const estado = criarExemplo(AGORA);
    const loja = porId(estado.stores, "loja-1");
    expect(loja.status).toBe(STATUS_LOJA.APROVADA);
    const dados = { name: loja.name, address: loja.address, city: loja.city, hours: "8h às 20h" };
    expect(
      porId(sucesso(salvarLoja(estado, loja.userId, dados)).state.stores, "loja-1").status,
    ).toBe(STATUS_LOJA.APROVADA);
    const mudou = sucesso(salvarLoja(estado, loja.userId, { ...dados, address: "Outra rua, 1" }));
    expect(porId(mudou.state.stores, "loja-1").status).toBe(STATUS_LOJA.PENDENTE);
  });
});

describe("código de retirada com HMAC (item 7)", () => {
  it("bate com o vetor de teste do RFC 4231 e gera 6 dígitos estáveis", () => {
    expect(hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog")).toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    );
    const codigo = codigoDeRetirada("pedido-2", "segredo");
    expect(codigo).toMatch(/^\d{6}$/);
    expect(codigoDeRetirada("pedido-2", "segredo")).toBe(codigo);
    expect(codigoDeRetirada("pedido-2", "outro segredo")).not.toBe(codigo);
  });
});

describe("login e senha (itens 11 e 25)", () => {
  it("perfil errado diz qual é o perfil certo da conta", () => {
    const { users } = criarExemplo(AGORA);
    const produtor = porId(users, "user-produtor");
    const credenciais = {
      email: produtor.email,
      password: produtor.password ?? "",
      role: "comprador" as const,
    };
    expect(autenticar(users, credenciais)).toBeNull();
    expect(contaComSenha(users, credenciais)?.role).toBe("produtor");
    expect(mensagemPerfilErrado("produtor")).toMatch(/conta é de Produtor/);
  });

  it("senha só com espaços não vale", () => {
    const dados = {
      role: "comprador" as const,
      name: "A",
      city: "B",
      email: "a@b.com",
      password: "        ",
    };
    expect(falhaDe(cadastrarUsuario(criarExemplo(AGORA), dados))).toMatch(/pelo menos 8/);
  });
});

describe("origem da compra", () => {
  it("compra do catálogo continua funcionando", () => {
    const r = sucesso(
      criarPedidoDireto(
        criarExemplo(AGORA),
        {
          type: ORIGEM.CATALOGO,
          sourceId: "produto-1",
          productId: "produto-1",
          buyerId: "user-comprador",
          quantity: 2,
          storeId: "loja-1",
        },
        AGORA,
      ),
    );
    expect(r.order.unitPrice).toBe(porId(criarExemplo(AGORA).products, "produto-1").price);
  });
});
