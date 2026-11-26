// Testes de tela da Sprint 3 (modo demo, dados fictícios): correções da banca de
// revisão (docs/SPRINT-3.md).

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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

describe("Sprint 3: correções da banca", () => {
  it("o comprador cancela o pedido não pago no checkout e ele aparece como cancelado", async () => {
    const user = userEvent.setup();
    render(<App />);
    await entrar(user, "Comprador", "comprador@hortilink.com");
    await abrirMenu(user, "Minhas compras");
    await user.click(await screen.findByText(/Pagamento pendente/));
    expect(screen.getByText(/Pague em até 30 minutos/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar pedido" }));
    await abrirMenu(user, "Minhas compras");
    expect(await screen.findByText(/o estoque voltou para a vitrine/)).toBeInTheDocument();
    expect(screen.queryByText(/Pagamento pendente/)).not.toBeInTheDocument();
  });
});

describe("Sprint 3: mostrar senha", () => {
  it("o botão do olho mostra e oculta a senha digitada no login", async () => {
    const user = userEvent.setup();
    render(<App />);
    const senha = await screen.findByLabelText("Senha");
    await user.type(senha, "123456");
    expect(senha).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(senha).toHaveAttribute("type", "text");
    expect(senha).toHaveValue("123456");
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(senha).toHaveAttribute("type", "password");
  });
});
