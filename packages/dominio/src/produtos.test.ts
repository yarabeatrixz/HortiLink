import { describe, expect, it } from "vitest";
import { criarExemplo } from "./exemplo";
import { type DadosProduto, excluirProduto, salvarProduto, validarArquivoDeFoto } from "./produtos";
import { falhaDe, sucesso } from "./testes";

const couve: DadosProduto = {
  producerId: "user-produtor",
  name: " Couve ",
  category: "Verduras",
  unit: "mç",
  price: "3,20",
  quantity: "15",
};

describe("produtos", () => {
  it("cria produto novo com id e números convertidos", () => {
    const { state } = sucesso(salvarProduto(criarExemplo(), couve));
    expect(state.products[0]).toMatchObject({ name: "Couve", price: 3.2, quantity: 15 });
    expect(state.products[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("edita produto existente sem trocar o id", () => {
    const { state } = sucesso(salvarProduto(criarExemplo(), { ...couve, id: "produto-1", name: "Alface roxa" }));
    expect(state.products.find((item) => item.id === "produto-1")?.name).toBe("Alface roxa");
    expect(state.products).toHaveLength(criarExemplo().products.length);
  });

  it("recusa produto sem nome, com preço zero ou estoque mínimo negativo", () => {
    expect(falhaDe(salvarProduto(criarExemplo(), { ...couve, name: "" }))).toMatch(/valores válidos/);
    expect(falhaDe(salvarProduto(criarExemplo(), { ...couve, price: 0 }))).toMatch(/valores válidos/);
    expect(falhaDe(salvarProduto(criarExemplo(), { ...couve, minQuantity: "-1" }))).toMatch(/negativo/);
  });

  it("aceita estoque mínimo informado como texto", () => {
    const { state } = sucesso(salvarProduto(criarExemplo(), { ...couve, minQuantity: "5" }));
    expect(state.products[0]?.minQuantity).toBe(5);
  });

  it("excluir produto remove as ofertas dele", () => {
    const semPedidos = { ...criarExemplo(), orders: [] };
    const { state } = sucesso(excluirProduto(semPedidos, "produto-1"));
    expect(state.products.some((item) => item.id === "produto-1")).toBe(false);
    expect(state.offers.some((item) => item.productId === "produto-1")).toBe(false);
  });

  it("não exclui produto que já tem pedido (Sprint 3)", () => {
    expect(falhaDe(excluirProduto(criarExemplo(), "produto-1"))).toMatch(/já tem pedidos/);
  });

  it("valida categoria, unidade e limites; editar pode zerar o estoque (Sprint 3)", () => {
    expect(falhaDe(salvarProduto(criarExemplo(), { ...couve, category: "Bombas" as never }))).toMatch(/categoria/);
    expect(falhaDe(salvarProduto(criarExemplo(), { ...couve, unit: "xyz" as never }))).toMatch(/unidade/);
    expect(falhaDe(salvarProduto(criarExemplo(), { ...couve, price: 1e15 }))).toMatch(/acima do permitido/);
    const produto = criarExemplo().products[0];
    if (!produto) throw new Error("exemplo sem produto");
    const zerado = sucesso(salvarProduto(criarExemplo(), { ...produto, quantity: 0 }));
    expect(zerado.state.products.find((item) => item.id === produto.id)?.quantity).toBe(0);
    expect(falhaDe(salvarProduto(criarExemplo(), { ...couve, quantity: 0 }))).toMatch(/valores válidos/);
  });
});

describe("foto do produto", () => {
  it("aceita JPG, PNG e WebP de até 1 MB", () => {
    expect(validarArquivoDeFoto({ type: "image/png", size: 500_000 })).toBeNull();
  });

  it("recusa outros formatos (SVG, HTML) e arquivos grandes", () => {
    expect(validarArquivoDeFoto({ type: "image/svg+xml", size: 10 })).toMatch(/JPG, PNG ou WebP/);
    expect(validarArquivoDeFoto({ type: "text/html", size: 10 })).toMatch(/JPG, PNG ou WebP/);
    expect(validarArquivoDeFoto({ type: "image/jpeg", size: 2_000_000 })).toMatch(/até 1 MB/);
  });
});
