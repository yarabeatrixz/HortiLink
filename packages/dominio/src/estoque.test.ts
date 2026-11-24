import { describe, expect, it } from "vitest";
import { MOTIVOS_PERDA, STATUS_ESTOQUE, STATUS_PEDIDO, TIPO_DESPESA, TIPO_MOVIMENTO } from "./constantes";
import { type DadosDespesa, excluirDespesa, registrarDespesa } from "./despesas";
import { registrarEntrada, registrarPerda, statusEstoque } from "./estoque";
import { criarExemplo } from "./exemplo";
import { calcularIndicadores } from "./indicadores";
import { falhaDe, porId, sucesso } from "./testes";

describe("status do estoque (alerta de reposição)", () => {
  it("ok no mínimo ou acima, baixo abaixo do mínimo, zerado sem quantidade", () => {
    expect(statusEstoque({ quantity: 31, minQuantity: 30 })).toBe(STATUS_ESTOQUE.OK);
    expect(statusEstoque({ quantity: 30, minQuantity: 30 })).toBe(STATUS_ESTOQUE.OK);
    expect(statusEstoque({ quantity: 29, minQuantity: 30 })).toBe(STATUS_ESTOQUE.BAIXO);
    expect(statusEstoque({ quantity: 0, minQuantity: 30 })).toBe(STATUS_ESTOQUE.ZERADO);
  });

  it("sem estoque mínimo definido só alerta quando zera", () => {
    expect(statusEstoque({ quantity: 1 })).toBe(STATUS_ESTOQUE.OK);
  });

  it("os dados de exemplo têm um produto com estoque baixo (cheiro-verde)", () => {
    expect(statusEstoque(porId(criarExemplo().products, "produto-3"))).toBe(STATUS_ESTOQUE.BAIXO);
  });
});

describe("entrada de mercadoria", () => {
  it("soma ao estoque e registra o custo", () => {
    const { state } = sucesso(
      registrarEntrada(criarExemplo(), { productId: "produto-3", quantity: "20", unitCost: "0,80", note: " colheita " }),
    );
    expect(porId(state.products, "produto-3").quantity).toBe(60);
    expect(state.stockMovements[0]).toMatchObject({
      type: TIPO_MOVIMENTO.ENTRADA,
      quantity: 20,
      unitCost: 0.8,
      note: "colheita",
      producerId: "user-produtor",
    });
  });

  it("recusa quantidade zero e custo negativo", () => {
    expect(falhaDe(registrarEntrada(criarExemplo(), { productId: "produto-1", quantity: 0, unitCost: 1 }))).toMatch(
      /quantidade válida/,
    );
    expect(falhaDe(registrarEntrada(criarExemplo(), { productId: "produto-1", quantity: 1, unitCost: -1 }))).toMatch(
      /negativo/,
    );
  });
});

describe("perdas", () => {
  const perda = { productId: "produto-1", quantity: "5", reason: MOTIVOS_PERDA[0] };

  it("tira do estoque e guarda o motivo", () => {
    const { state } = sucesso(registrarPerda(criarExemplo(), perda));
    expect(porId(state.products, "produto-1").quantity).toBe(115);
    expect(state.stockMovements[0]).toMatchObject({ type: TIPO_MOVIMENTO.PERDA, reason: MOTIVOS_PERDA[0] });
  });

  it("recusa perda maior que o estoque e sem motivo válido", () => {
    expect(falhaDe(registrarPerda(criarExemplo(), { ...perda, quantity: 999 }))).toMatch(/maior que o estoque/);
    expect(falhaDe(registrarPerda(criarExemplo(), { ...perda, reason: "" }))).toMatch(/motivo/);
  });
});

describe("custos e investimentos", () => {
  const despesa: DadosDespesa = {
    producerId: "user-produtor",
    type: TIPO_DESPESA.CUSTO,
    description: "Frete",
    amount: "50",
  };

  it("registra e exclui", () => {
    const { state } = sucesso(registrarDespesa(criarExemplo(), despesa));
    const criada = state.expenses[0];
    expect(criada).toMatchObject({ description: "Frete", amount: 50 });
    const semDespesa = sucesso(excluirDespesa(state, criada?.id ?? ""));
    expect(semDespesa.state.expenses.some((item) => item.description === "Frete")).toBe(false);
  });

  it("exige descrição, tipo válido e valor positivo", () => {
    expect(falhaDe(registrarDespesa(criarExemplo(), { ...despesa, description: "" }))).toMatch(/Descreva/);
    expect(falhaDe(registrarDespesa(criarExemplo(), { ...despesa, type: "Outro" }))).toMatch(/custo ou investimento/);
    expect(falhaDe(registrarDespesa(criarExemplo(), { ...despesa, amount: 0 }))).toMatch(/maior que zero/);
  });
});

describe("relatórios e indicadores", () => {
  it("calcula receita só de pedidos pagos, gastos, perdas e resultado", () => {
    const i = calcularIndicadores(criarExemplo(), "user-produtor");
    // exemplo: pedido-2 pago (12 × 2,20); pedido-1 aguardando pagamento não conta
    expect(i.receita).toBeCloseTo(26.4);
    expect(i.pedidos).toBe(1);
    expect(i.custoEntradas).toBeCloseTo(88); // 80 × 1,10
    expect(i.custos).toBe(85);
    expect(i.investimentos).toBe(420);
    expect(i.resultado).toBeCloseTo(26.4 - 88 - 85 - 420);
    expect(i.perdasQuantidade).toBe(6);
    expect(i.valorPerdido).toBeCloseTo(15); // 6 × 2,50
    expect(i.estoqueBaixo.map((produto) => produto.id)).toEqual(["produto-3"]);
    expect(i.porProduto[0]?.product.id).toBe("produto-1");
  });

  it("respeita o filtro de período e não mistura produtores", () => {
    const nada = calcularIndicadores(criarExemplo(), "user-produtor", () => false);
    expect(nada.receita).toBe(0);
    expect(nada.gastoTotal).toBe(0);
    const outro = calcularIndicadores(criarExemplo(), "user-produtor-2");
    expect(outro.custos).toBe(0);
    expect(outro.porProduto.map((item) => item.product.id)).toEqual(["produto-4"]);
  });

  it("pedido entregue na loja continua contando como venda", () => {
    const estado = criarExemplo();
    estado.orders = estado.orders.map((pedido) =>
      pedido.id === "pedido-2" ? { ...pedido, status: STATUS_PEDIDO.ENTREGUE_NA_LOJA } : pedido,
    );
    expect(calcularIndicadores(estado, "user-produtor").pedidos).toBe(1);
  });
});
