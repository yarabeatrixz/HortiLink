// Testes de funcionamento: renderizam o app inteiro (com o adapter localStorage
// e o seed fictício) e usam a tela como o usuário usaria.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

async function entrar(user, perfil, email) {
  render(<App />);
  await user.click(await screen.findByRole("radio", { name: perfil }));
  await user.type(screen.getByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), "123456");
  await user.click(screen.getByRole("button", { name: "Entrar na plataforma" }));
}

/** Clica numa aba do menu lateral (o menu do celular repete os mesmos botões). */
async function abrirMenu(user, aba) {
  const menu = await screen.findByRole("navigation", { name: "Menu principal" });
  await user.click(within(menu).getByRole("button", { name: aba }));
}

describe("login", () => {
  it("mostra erro com senha errada ou perfil errado", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("E-mail"), "comprador@hortilink.com");
    await user.type(screen.getByLabelText("Senha"), "123456");
    // perfil padrão é Produtor → não entra, e a mensagem diz qual é o perfil certo (Sprint 3)
    await user.click(screen.getByRole("button", { name: "Entrar na plataforma" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Esta conta é de Comprador");
    await user.type(screen.getByLabelText("Senha"), "x");
    await user.click(screen.getByRole("button", { name: "Entrar na plataforma" }));
    expect(screen.getByRole("alert")).toHaveTextContent("E-mail ou senha incorretos");
  });

  it("cadastro valida senha curta", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /Cadastre-se/ }));
    await user.type(screen.getByLabelText("Nome"), "Ana");
    await user.type(screen.getByLabelText("Cidade"), "Suzano");
    await user.type(screen.getByLabelText("E-mail"), "ana@x.com");
    await user.type(screen.getByLabelText("Senha"), "123");
    await user.click(screen.getByRole("button", { name: "Criar minha conta" }));
    expect(screen.getByRole("alert")).toHaveTextContent("pelo menos 8 caracteres");
  });

  it("sair volta para a tela de login", async () => {
    const user = userEvent.setup();
    await entrar(user, "Loja parceira", "loja@hortilink.com");
    expect(await screen.findByRole("heading", { name: "Meu ponto de coleta" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Sair" })[0]);
    expect(await screen.findByRole("button", { name: "Entrar na plataforma" })).toBeInTheDocument();
  });
});

describe("comprador", () => {
  it("compra uma oferta, paga com Pix e vê o pedido em Minhas compras", async () => {
    const user = userEvent.setup();
    await entrar(user, "Comprador", "comprador@hortilink.com");

    expect(await screen.findByRole("heading", { name: "Alface crespa" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Comprar" }));
    await user.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    expect(screen.getByText("R$ 4,40")).toBeInTheDocument(); // 2 × R$ 2,20
    await user.click(screen.getByRole("button", { name: "Ir para pagamento" }));

    expect(await screen.findByRole("heading", { name: "Checkout" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Simular pagamento recebido" }));
    expect(await screen.findByRole("heading", { name: "Pagamento aprovado" })).toBeInTheDocument();
    expect(screen.getByText("#HL-000003")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver meus pedidos" }));
    const card = (await screen.findByText("#HL-000003")).closest("button");
    expect(within(card).getByText("Pago")).toBeInTheDocument();
  });

  it("cartão de teste recusado leva à tela de recusa e permite pagar com Pix", async () => {
    const user = userEvent.setup();
    await entrar(user, "Comprador", "comprador@hortilink.com");
    await user.click(await screen.findByRole("button", { name: "Comprar" }));
    await user.click(screen.getByRole("button", { name: "Ir para pagamento" }));
    await user.click(await screen.findByRole("radio", { name: /Cartão/ }));
    await user.type(screen.getByLabelText("Número do cartão"), "4000 0000 0000 0002");
    await user.type(screen.getByLabelText("Nome impresso no cartão"), "TESTE");
    await user.type(screen.getByLabelText("Validade (MM/AA)"), "12/30");
    await user.type(screen.getByLabelText("CVV"), "123");
    await user.click(screen.getByRole("button", { name: /^Pagar/ }));
    expect(await screen.findByRole("heading", { name: "Pagamento recusado" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pagar com Pix" }));
    expect(await screen.findByRole("radio", { name: /Pix/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("abre o perfil público de um produtor pelo catálogo", async () => {
    const user = userEvent.setup();
    await entrar(user, "Comprador", "comprador@hortilink.com");
    await abrirMenu(user, "Produtores");
    await user.click(screen.getAllByRole("button", { name: /Ver perfil/ })[0]);
    expect(
      await screen.findByRole("heading", { name: "Produtos disponíveis" }),
    ).toBeInTheDocument();
  });
});

describe("produtor", () => {
  it("valida e publica oferta", async () => {
    const user = userEvent.setup();
    await entrar(user, "Produtor", "produtor@hortilink.com");
    await abrirMenu(user, "Ofertas");
    await user.click(screen.getByRole("button", { name: "Nova oferta" }));

    await user.type(screen.getByLabelText("Quantidade da oferta"), "10");
    await user.type(screen.getByLabelText("Preço promocional"), "2");
    await user.click(screen.getByRole("button", { name: "Publicar oferta" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Selecione ao menos um ponto de retirada");

    await user.click(screen.getByRole("checkbox", { name: /Mercado Alto Tietê/ }));
    await user.click(screen.getByRole("button", { name: "Publicar oferta" }));
    expect(
      await screen.findByRole("heading", { name: "Ofertas promocionais" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ativa").length).toBeGreaterThanOrEqual(2);
  });

  it("cadastra produto e ele aparece no catálogo", async () => {
    const user = userEvent.setup();
    await entrar(user, "Produtor", "produtor@hortilink.com");
    await user.click(await screen.findByRole("button", { name: "Cadastrar produto" }));
    await user.type(screen.getByLabelText("Nome do produto"), "Couve manteiga");
    await user.type(screen.getByLabelText("Preço"), "3");
    await user.type(screen.getByLabelText("Quantidade disponível"), "20");
    await user.click(screen.getByRole("button", { name: "Salvar produto" }));
    expect(await screen.findByRole("heading", { name: "Couve manteiga" })).toBeInTheDocument();
  });

  it("marca pedido pago como entregue na loja", async () => {
    const user = userEvent.setup();
    await entrar(user, "Produtor", "produtor@hortilink.com");
    await abrirMenu(user, "Atualizar status");
    await user.click(screen.getByRole("button", { name: "Marcar como entregue na loja" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Entregue na loja")).toBeInTheDocument();
  });
});

describe("loja parceira", () => {
  it("vê o pedido pago do seu ponto para retirada", async () => {
    const user = userEvent.setup();
    await entrar(user, "Loja parceira", "loja@hortilink.com");
    await abrirMenu(user, "Pedidos");
    expect(await screen.findByText("#HL-000002")).toBeInTheDocument();
    expect(screen.queryByText("#HL-000001")).not.toBeInTheDocument(); // ainda não pago
  });
});

describe("produtor: estoque, custos e relatórios", () => {
  it("catálogo avisa estoque baixo e leva para a tela de estoque", async () => {
    const user = userEvent.setup();
    await entrar(user, "Produtor", "produtor@hortilink.com");
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("1 produto precisa de reposição");
    expect(alerta).toHaveTextContent("Cheiro-verde");
    await user.click(within(alerta).getByRole("button", { name: "Ver estoque" }));
    expect(await screen.findByRole("heading", { name: "Estoque" })).toBeInTheDocument();
  });

  it("entrada de mercadoria tira o produto do alerta de estoque baixo", async () => {
    const user = userEvent.setup();
    await entrar(user, "Produtor", "produtor@hortilink.com");
    await abrirMenu(user, "Estoque");
    await user.click(screen.getByRole("button", { name: "Registrar entrada de Cheiro-verde" }));
    await user.type(screen.getByLabelText(/Quantidade/), "30");
    await user.type(screen.getByLabelText("Custo por unidade (R$)"), "1");
    expect(screen.getByText(/Custo total da entrada: R\$\s*30,00/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar entrada" }));

    expect(await screen.findByRole("heading", { name: "Estoque" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/Entrada: \+30 mç de Cheiro-verde/)).toBeInTheDocument();
  });

  it("perda maior que o estoque mostra erro; perda válida entra no histórico", async () => {
    const user = userEvent.setup();
    await entrar(user, "Produtor", "produtor@hortilink.com");
    await abrirMenu(user, "Estoque");
    await user.click(screen.getByRole("button", { name: "Registrar perda de Cenoura" }));
    await user.type(screen.getByLabelText(/Quantidade/), "999");
    await user.click(screen.getByRole("button", { name: "Salvar perda" }));
    expect(screen.getByRole("alert")).toHaveTextContent("A perda é maior que o estoque atual");

    await user.clear(screen.getByLabelText(/Quantidade/));
    await user.type(screen.getByLabelText(/Quantidade/), "5");
    await user.selectOptions(screen.getByLabelText("Motivo da perda"), "Avaria no transporte");
    await user.click(screen.getByRole("button", { name: "Salvar perda" }));
    expect(await screen.findByText(/Perda: −5 kg de Cenoura/)).toBeInTheDocument();
    expect(screen.getByText(/Avaria no transporte/)).toBeInTheDocument();
  });

  it("registra custo e investimento e atualiza os totais", async () => {
    const user = userEvent.setup();
    await entrar(user, "Produtor", "produtor@hortilink.com");
    await abrirMenu(user, "Custos");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Descreva o custo ou investimento");

    await user.type(screen.getByLabelText("Descrição"), "Frete até a loja");
    await user.type(screen.getByLabelText("Valor (R$)"), "15");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(await screen.findByText("Frete até a loja")).toBeInTheDocument();
    // seed: R$ 85 de custo + R$ 15 novo
    expect(screen.getByText(/R\$\s*100,00/)).toBeInTheDocument();
  });

  it("relatórios mostram receita, gastos e o produto a repor", async () => {
    const user = userEvent.setup();
    await entrar(user, "Produtor", "produtor@hortilink.com");
    await abrirMenu(user, "Relatórios");
    expect(await screen.findByRole("heading", { name: "Indicadores da produção" })).toBeInTheDocument();
    const receita = screen.getByText("Receita (vendas pagas)").parentElement;
    expect(receita).toHaveTextContent(/R\$\s*26,40/);
    const gastos = screen.getByText("Gastos totais").parentElement;
    expect(gastos).toHaveTextContent(/R\$\s*593,00/); // 88 + 85 + 420
    expect(screen.getByText(/Repor:/)).toHaveTextContent("Cheiro-verde");

    await user.selectOptions(screen.getByLabelText("Período do relatório"), "Hoje");
    expect(screen.getByText("Gastos totais").parentElement).toHaveTextContent(/R\$\s*0,00/);
  });
});
