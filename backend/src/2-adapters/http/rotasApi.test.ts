import { criarExemplo } from "@hortilink/dominio/exemplo";
import { describe, expect, it } from "vitest";
import { criarCasosDeUso } from "../../1-application/casosDeUso";
import { criarServidor } from "../../3-frameworks/http/servidor";
import { criarRepositorioEmMemoria } from "../memoria/repositorioEmMemoria";
import { verificadorDemo } from "../memoria/verificadorDemo";

const ORIGEM = "http://localhost:5173";
const agora = new Date("2026-11-15T12:00:00.000Z");

function montar() {
  const repositorio = criarRepositorioEmMemoria(criarExemplo(agora));
  const casos = criarCasosDeUso({ repositorio, relogio: () => agora });
  const app = criarServidor({ origemFrontend: ORIGEM }, { casos, verificador: verificadorDemo });
  const como = (userId: string) => ({ authorization: `Bearer demo:${userId}` });
  return { app, repositorio, como };
}

const produto = { name: "Couve", category: "Verduras", unit: "mç", price: "3,20", quantity: 10 };

describe("rotas da API", () => {
  it("sem token responde 401 com mensagem clara", async () => {
    const { app } = montar();
    const resposta = await app.inject({ method: "POST", url: "/products", payload: produto });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual({ error: "Faça login para continuar" });
  });

  it("sem token, o login é conferido antes do corpo (401, não 400)", async () => {
    const { app } = montar();
    const resposta = await app.inject({ method: "POST", url: "/products", payload: {} });
    expect(resposta.statusCode).toBe(401);
  });

  it("token inválido responde 401", async () => {
    const { app } = montar();
    const resposta = await app.inject({
      method: "DELETE",
      url: "/expenses/x",
      headers: { authorization: "Bearer token-falso" },
    });
    expect(resposta.statusCode).toBe(401);
  });

  it("produtor cadastra produto (201) e ele vai para o repositório", async () => {
    const { app, repositorio, como } = montar();
    const resposta = await app.inject({ method: "POST", url: "/products", headers: como("user-produtor"), payload: produto });
    expect(resposta.statusCode).toBe(201);
    expect(repositorio.espiar().products[0]).toMatchObject({ name: "Couve", price: 3.2, producerId: "user-produtor" });
  });

  it("recusa foto que não é imagem e texto longo demais (400)", async () => {
    const { app, como } = montar();
    const enviar = (payload: object) =>
      app.inject({ method: "POST", url: "/products", headers: como("user-produtor"), payload: { ...produto, ...payload } });
    expect((await enviar({ photo: "data:text/html;base64,PHNjcmlwdD4=" })).statusCode).toBe(400);
    expect((await enviar({ photo: "javascript:alert(1)" })).statusCode).toBe(400);
    expect((await enviar({ name: "x".repeat(121) })).statusCode).toBe(400);
    expect((await enviar({ photo: "data:image/png;base64,iVBORw0KGgo=" })).statusCode).toBe(201);
  });

  it("oferta com ponto de retirada inexistente responde 404", async () => {
    const { app, repositorio, como } = montar();
    const produtoDoProdutor = repositorio.espiar().products.find((p) => p.producerId === "user-produtor");
    const resposta = await app.inject({
      method: "POST",
      url: "/offers",
      headers: como("user-produtor"),
      payload: {
        productId: produtoDoProdutor?.id,
        quantity: 1,
        promotionalPrice: "0,50",
        city: "Mogi das Cruzes",
        validityDays: 2,
        storeIds: ["loja-que-nao-existe"],
      },
    });
    expect(resposta.statusCode).toBe(404);
  });

  it("perfil errado responde 403", async () => {
    const { app, como } = montar();
    const resposta = await app.inject({ method: "POST", url: "/products", headers: como("user-comprador"), payload: produto });
    expect(resposta.statusCode).toBe(403);
  });

  it("corpo fora do formato responde 400 (campo faltando ou campo extra)", async () => {
    const { app, como } = montar();
    const semPreco = await app.inject({ method: "POST", url: "/products", headers: como("user-produtor"), payload: { name: "X" } });
    expect(semPreco.statusCode).toBe(400);
    const campoExtra = await app.inject({
      method: "POST",
      url: "/products",
      headers: como("user-produtor"),
      payload: { ...produto, producerId: "user-produtor-2" },
    });
    expect(campoExtra.statusCode).toBe(400);
  });

  it("regra do domínio violada responde 422 com a mensagem do domínio", async () => {
    const { app, como } = montar();
    const resposta = await app.inject({
      method: "POST",
      url: "/stock/losses",
      headers: como("user-produtor"),
      payload: { productId: "produto-1", quantity: 999, reason: "Outro" },
    });
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json()).toEqual({ error: "A perda é maior que o estoque atual" });
  });

  it("recurso de outro usuário responde 403 e inexistente responde 404", async () => {
    const { app, como } = montar();
    const deOutro = await app.inject({ method: "DELETE", url: "/products/produto-1", headers: como("user-produtor-2") });
    expect(deOutro.statusCode).toBe(403);
    const inexistente = await app.inject({ method: "DELETE", url: "/products/nao-existe", headers: como("user-produtor") });
    expect(inexistente.statusCode).toBe(404);
  });

  it("comprador cria pedido, recebe o número e paga", async () => {
    const { app, repositorio, como } = montar();
    const criado = await app.inject({
      method: "POST",
      url: "/orders",
      headers: como("user-comprador"),
      payload: { type: "offer", sourceId: "oferta-1", productId: "produto-1", quantity: 2, storeId: "loja-1" },
    });
    expect(criado.statusCode).toBe(201);
    const { order } = criado.json();
    expect(order.orderNumber).toBe("#HL-000003");

    const pago = await app.inject({ method: "POST", url: `/orders/${order.id}/pay`, headers: como("user-comprador"), payload: { method: "Pix" } });
    expect(pago.statusCode).toBe(200);
    expect(repositorio.espiar().orders.find((o) => o.id === order.id)?.status).toBe("Pago");
  });

  it("responde ao preflight de CORS do navegador com Authorization liberado", async () => {
    const { app } = montar();
    const resposta = await app.inject({
      method: "OPTIONS",
      url: "/orders",
      headers: { origin: ORIGEM, "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" },
    });
    expect(resposta.statusCode).toBe(204);
    expect(resposta.headers["access-control-allow-origin"]).toBe(ORIGEM);
    expect(String(resposta.headers["access-control-allow-headers"]).toLowerCase()).toContain("authorization");
  });
});

describe("rotas da Sprint 2", () => {
  it("só o admin avalia lojas; loja aprovada passa a aceitar pontos de retirada", async () => {
    const { app, repositorio, como } = montar();
    const avaliar = (userId: string, payload: object) =>
      app.inject({ method: "POST", url: "/admin/stores/loja-3/review", headers: como(userId), payload });
    expect((await avaliar("user-loja", { status: "Aprovada" })).statusCode).toBe(403);
    expect((await avaliar("user-admin", { status: "Suspensa" })).statusCode).toBe(422); // sem motivo
    const pontos = () =>
      app.inject({ method: "PUT", url: "/producers/me/pickup-stores", headers: como("user-produtor"), payload: { storeIds: ["loja-1", "loja-3"] } });
    expect((await pontos()).statusCode).toBe(422); // loja-3 pendente
    expect((await avaliar("user-admin", { status: "Aprovada" })).statusCode).toBe(200);
    expect((await pontos()).statusCode).toBe(200);
    expect(repositorio.espiar().stores.find((l) => l.id === "loja-3")?.status).toBe("Aprovada");
  });

  it("retirada: produtor entrega, loja libera, comprador vê o código e a loja confere", async () => {
    const { app, repositorio, como } = montar();
    const post = (url: string, userId: string, payload?: object) =>
      app.inject({ method: "POST", url, headers: como(userId), ...(payload ? { payload } : {}) });
    const codigo = () => app.inject({ method: "GET", url: "/orders/pedido-2/pickup-code", headers: como("user-comprador") });

    expect((await codigo()).statusCode).toBe(422); // ainda não chegou à loja
    expect((await post("/orders/pedido-2/delivered", "user-produtor")).statusCode).toBe(200);
    expect((await post("/orders/pedido-2/received", "user-comprador")).statusCode).toBe(403);
    expect((await post("/orders/pedido-2/received", "user-loja")).statusCode).toBe(200);
    const { code } = (await codigo()).json();
    expect(code).toMatch(/^\d{6}$/);
    expect((await post("/orders/pedido-2/picked-up", "user-loja", { code: "000000" })).statusCode).toBe(422);
    expect((await post("/orders/pedido-2/picked-up", "user-loja", { code })).statusCode).toBe(200);
    expect(repositorio.espiar().orders.find((o) => o.id === "pedido-2")?.status).toBe("Retirado");

    const fechar = await post("/admin/reward-payouts", "user-admin", { storeId: "loja-1", month: agora.toISOString().slice(0, 7) });
    expect(fechar.statusCode).toBe(201);
    expect(fechar.json().payout).toMatchObject({ ordersCount: 1 });
  });

  it("exclui vários produtos, atualiza o perfil e salva a regra de recompensa", async () => {
    const { app, repositorio, como } = montar();
    const excluir = await app.inject({ method: "POST", url: "/products/delete", headers: como("user-produtor"), payload: { ids: ["produto-1", "produto-2"] } });
    expect(excluir.statusCode).toBe(200);
    expect(repositorio.espiar().products.some((p) => p.id === "produto-1")).toBe(false);
    const alheio = await app.inject({ method: "POST", url: "/products/delete", headers: como("user-produtor-2"), payload: { ids: ["produto-3"] } });
    expect(alheio.statusCode).toBe(403);

    const perfil = await app.inject({ method: "PUT", url: "/users/me", headers: como("user-comprador"), payload: { name: "Marina", city: "Mogi" } });
    expect(perfil.statusCode).toBe(200);
    expect(repositorio.espiar().users.find((u) => u.id === "user-comprador")?.city).toBe("Mogi");

    const regra = (userId: string) =>
      app.inject({ method: "PUT", url: "/admin/reward-settings", headers: como(userId), payload: { fixedAmount: "2", percent: 10 } });
    expect((await regra("user-loja")).statusCode).toBe(403);
    expect((await regra("user-admin")).statusCode).toBe(200);
    expect(repositorio.espiar().rewardSettings).toEqual({ fixedAmount: 2, percent: 10 });
  });
});
