import { criarExemplo } from "@hortilink/dominio/exemplo";
import { describe, expect, it } from "vitest";
import { gerarSeedSql } from "./seedSql";

const referencia = new Date("2026-11-15T12:00:00.000Z");
const sql = gerarSeedSql(criarExemplo(referencia), referencia);

describe("gerarSeedSql", () => {
  it("cria usuários de demonstração no Auth com senha criptografada", () => {
    expect(sql).toContain("insert into auth.users");
    expect(sql).toContain("'produtor@hortilink.com'");
    expect(sql).toContain("crypt('123456', gen_salt('bf'))");
    expect(sql).not.toMatch(/"password"/);
  });

  it("não cria administrador e recusa rodar em banco com contas reais (Sprint 3)", () => {
    expect(sql).not.toContain("admin@hortilink.com");
    expect(sql).not.toMatch(/set role = 'admin'/);
    expect(sql).toMatch(/raise exception 'seed\.sql é só para um banco de DEMONSTRAÇÃO/);
  });

  it("cria um usuário loja para lojas do exemplo sem dono cadastrado", () => {
    expect(sql).toContain("'loja-demo-2@hortilink.com'");
  });

  it("usa UUIDs determinísticos no lugar dos ids do domínio", () => {
    expect(sql).toContain("md5('produto-1')::uuid");
    // O id cru nunca aparece como valor: só dentro de md5(...).
    expect(sql).not.toMatch(/(?<!md5)\('produto-1'/);
    expect(sql).not.toMatch(/, 'produto-1'/);
  });

  it("insere todas as tabelas e ajusta a sequência do número do pedido", () => {
    for (const tabela of [
      "public.stores",
      "public.producer_pickup_stores",
      "public.products",
      "public.offers",
      "public.offer_stores",
      "public.orders",
      "public.order_timeline",
      "public.stock_movements",
      "public.expenses",
    ]) {
      expect(sql).toContain(`insert into ${tabela} `);
    }
    expect(sql).toContain("setval('public.order_number_seq', 2)");
  });

  it("escreve datas relativas ao now() do banco", () => {
    expect(sql).toContain("now() - interval '0 seconds'");
    expect(sql).toContain(`now() - interval '${7 * 24 * 60 * 60} seconds'`);
  });

  it("escapa aspas simples em textos", () => {
    const estado = criarExemplo(referencia);
    estado.expenses[0] = { ...estado.expenses[0]!, description: "Adubo d'água" };
    expect(gerarSeedSql(estado, referencia)).toContain("'Adubo d''água'");
  });
});
