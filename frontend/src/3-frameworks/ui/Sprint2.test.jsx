// Testes de tela da Sprint 2 (modo demo, dados fictícios): itens do relatório de
// inconsistências e o perfil Administrador.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { codigoDeRetirada } from "@hortilink/dominio";
import App from "./App";

async function entrar(user, perfil, email) {
  await user.click(await screen.findByRole("radio", { name: perfil }));
  await user.type(screen.getByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), "123456");
  await user.click(screen.getByRole("button", { name: "Entrar na plataforma" }));
}

async function abrirMenu(user, aba) {
  const menu = await screen.findByRole("navigation", { name: "Menu principal" });
  await user.click(within(menu).getByRole("button", { name: aba }));
}

const sair = (user) => user.click(screen.getAllByRole("button", { name: "Sair" })[0]);

describe("Sprint 2: relatório de inconsistências", () => {
  it("PROD-05: busca de pontos de retirada encontra lojas por cidade", async () => {
    const user = userEvent.setup();
    render(<App />);
    await entrar(user, "Produtor", "produtor@hortilink.com");
    await abrirMenu(user, "Pontos de retirada");
    await user.type(screen.getByPlaceholderText("Buscar ponto por nome ou endereço"), "suzano");
    const lista = document.querySelector(".pickup-results");
    expect(within(lista).getByText("Empório Vila Verde")).toBeInTheDocument();
    expect(within(lista).queryByText("Mercado Alto Tietê")).not.toBeInTheDocument();
    // loja pendente (Quitanda Recanto) não aparece para escolha
    await user.clear(screen.getByPlaceholderText("Buscar ponto por nome ou endereço"));
    expect(within(lista).queryByText("Quitanda Recanto")).not.toBeInTheDocument();
  });

  it("PROD-02: exclui vários produtos de uma vez", async () => {
    const user = userEvent.setup();
    render(<App />);
    await entrar(user, "Produtor", "produtor@hortilink.com");
    await user.click(await screen.findByRole("checkbox", { name: "Selecionar Cenoura" }));
    await user.click(screen.getByRole("checkbox", { name: "Selecionar Cheiro-verde" }));
    await user.click(screen.getByRole("button", { name: "Excluir selecionados (2)" }));
    const dialogo = screen.getByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByRole("heading", { name: "Alface crespa" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cheiro-verde" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cenoura" })).not.toBeInTheDocument();
  });

  it("Sprint 3: produto com pedido não é excluído e a mensagem explica o motivo", async () => {
    const user = userEvent.setup();
    render(<App />);
    await entrar(user, "Produtor", "produtor@hortilink.com");
    await user.click(await screen.findByRole("checkbox", { name: "Selecionar Alface crespa" }));
    await user.click(screen.getByRole("button", { name: "Excluir selecionados (1)" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText(/já tem pedidos/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alface crespa" })).toBeInTheDocument();
  });

  it("LOJA-02: depois de salvar, a loja vê o ponto cadastrado e não o formulário vazio", async () => {
    const user = userEvent.setup();
    render(<App />);
    await entrar(user, "Loja parceira", "loja@hortilink.com");
    expect(await screen.findByRole("heading", { name: "Mercado Alto Tietê" })).toBeInTheDocument();
    expect(screen.getByText("Situação: Aprovada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar ponto de coleta" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar dados" }));
    expect(screen.getByLabelText("Nome da loja")).toHaveValue("Mercado Alto Tietê");
  });

  it("GER-01: todos os perfis têm a aba Meu perfil e podem trocar nome e cidade", async () => {
    const user = userEvent.setup();
    render(<App />);
    await entrar(user, "Comprador", "comprador@hortilink.com");
    await abrirMenu(user, "Meu perfil");
    const cidade = screen.getByLabelText("Cidade");
    await user.clear(cidade);
    await user.type(cidade, "Mogi das Cruzes");
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));
    expect(await screen.findByText("Dados atualizados com sucesso")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nova senha"), "abcdefgh");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "abcdefgx");
    await user.click(screen.getByRole("button", { name: "Trocar senha" }));
    expect(await screen.findByText("As senhas não conferem")).toBeInTheDocument();
  });
});

describe("Sprint 2: administrador e retirada", () => {
  it("o cadastro não oferece o perfil Administrador", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("radio", { name: "Administrador" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Cadastre-se/ }));
    expect(screen.queryByRole("radio", { name: "Administrador" })).not.toBeInTheDocument();
  });

  it("admin aprova um ponto pendente e define a recompensa (US14, US16)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await entrar(user, "Administrador", "admin@hortilink.com");
    expect(await screen.findByRole("heading", { name: "Quitanda Recanto" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reprovar" }));
    expect(await screen.findByText("Explique o motivo para a loja")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aprovar" }));
    expect(await screen.findByText("Quitanda Recanto: aprovada")).toBeInTheDocument();

    await abrirMenu(user, "Recompensas");
    const percentual = screen.getByLabelText("Porcentagem do pedido (%)");
    await user.clear(percentual);
    await user.type(percentual, "150");
    await user.click(screen.getByRole("button", { name: "Salvar regra" }));
    expect(await screen.findByText("A porcentagem precisa estar entre 0 e 100")).toBeInTheDocument();
  });

  it("produtor entrega, loja libera e confirma a retirada com o código do comprador (US10)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await entrar(user, "Produtor", "produtor@hortilink.com");
    await abrirMenu(user, "Atualizar status");
    await user.click(await screen.findByRole("button", { name: "Marcar como entregue na loja" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    await sair(user);

    await entrar(user, "Loja parceira", "loja@hortilink.com");
    await abrirMenu(user, "Pedidos");
    await user.click(await screen.findByRole("button", { name: "Liberar para retirada" }));
    expect(await screen.findByText("#HL-000002 liberado para retirada")).toBeInTheDocument();
    const campo = screen.getByLabelText("Código de retirada do pedido #HL-000002");
    await user.type(campo, "000000");
    await user.click(screen.getByRole("button", { name: "Confirmar retirada" }));
    expect(await screen.findByText(/Código de retirada incorreto/)).toBeInTheDocument();
    await user.clear(campo);
    await user.type(campo, codigoDeRetirada("pedido-2", "hortilink-demo"));
    await user.click(screen.getByRole("button", { name: "Confirmar retirada" }));
    expect(await screen.findByText("#HL-000002 retirado pelo comprador")).toBeInTheDocument();

    await abrirMenu(user, "Recompensas");
    expect(await screen.findByText("#HL-000002")).toBeInTheDocument();
  });
});
