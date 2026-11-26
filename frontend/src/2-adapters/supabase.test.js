import { describe, expect, it, vi } from "vitest";
import { criarSupabaseAutenticacao } from "./supabaseAutenticacao";
import { criarSupabaseLeitura } from "./supabaseLeitura";

/** Cliente Supabase falso: só o que os adapters usam, sem rede. */
function criarClienteFalso({ tabelas = {}, perfil = "produtor", login = {}, cadastro = {} } = {}) {
  const sessao = { access_token: "token-1", user: { id: "user-1" } };
  const consulta = (tabela) => ({
    select: vi.fn(async () => ({ data: tabelas[tabela] ?? [], error: null })),
  });
  return {
    from: vi.fn((tabela) =>
      tabela === "users" && !tabelas.users
        ? { select: () => ({ eq: () => ({ single: async () => ({ data: { role: perfil }, error: null }) }) }) }
        : consulta(tabela),
    ),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: sessao } })),
      signInWithPassword: vi.fn(async () => ({ data: { user: sessao.user }, error: null, ...login })),
      signUp: vi.fn(async () => ({ data: { user: sessao.user, session: sessao }, error: null, ...cadastro })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
}

describe("supabaseLeitura", () => {
  it("lê as tabelas e traduz para o Estado do domínio", async () => {
    const cliente = criarClienteFalso({
      tabelas: {
        users: [{ id: "user-1", role: "comprador", name: "Ana", city: "Suzano" }],
        products: [],
      },
    });
    const estado = await criarSupabaseLeitura(cliente).carregar();
    expect(estado.users).toEqual([
      { id: "user-1", role: "comprador", name: "Ana", city: "Suzano", email: "" },
    ]);
    expect(estado.nextOrderNumber).toBe(1);
  });

  it("pede só as colunas públicas de users (o RLS esconde o e-mail)", async () => {
    const cliente = criarClienteFalso({ tabelas: { users: [] } });
    await criarSupabaseLeitura(cliente).carregar();
    const indice = cliente.from.mock.calls.findIndex(([tabela]) => tabela === "users");
    const { select } = cliente.from.mock.results[indice].value;
    expect(select).toHaveBeenCalledWith("id, role, name, city");
  });
});

describe("supabaseAutenticacao", () => {
  it("entrar devolve o id quando senha e perfil conferem", async () => {
    const auth = criarSupabaseAutenticacao(criarClienteFalso());
    await expect(
      auth.entrar({ email: "a@exemplo.test", password: "123456", role: "produtor" }),
    ).resolves.toBe("user-1");
  });

  it("perfil diferente do cadastro sai da sessão e recusa", async () => {
    const cliente = criarClienteFalso({ perfil: "loja" });
    await expect(
      criarSupabaseAutenticacao(cliente).entrar({
        email: "a@exemplo.test",
        password: "123456",
        role: "produtor",
      }),
    ).rejects.toThrow('Esta conta é de Loja parceira. Selecione o perfil "Loja parceira" para entrar.');
    expect(cliente.auth.signOut).toHaveBeenCalled();
  });

  it("cadastro manda perfil, nome e cidade nos metadados", async () => {
    const cliente = criarClienteFalso();
    await criarSupabaseAutenticacao(cliente).cadastrar({
      role: "comprador",
      name: "Ana",
      city: "Suzano",
      email: "ana@exemplo.test",
      password: "123456",
    });
    expect(cliente.auth.signUp).toHaveBeenCalledWith({
      email: "ana@exemplo.test",
      password: "123456",
      options: { data: { role: "comprador", name: "Ana", city: "Suzano" } },
    });
  });

  it("e-mail já cadastrado tem mensagem igual à do modo demo", async () => {
    const cliente = criarClienteFalso({
      cadastro: { data: { user: null, session: null }, error: { code: "user_already_exists" } },
    });
    await expect(
      criarSupabaseAutenticacao(cliente).cadastrar({ email: "ana@exemplo.test", password: "123456" }),
    ).rejects.toThrow("Este e-mail já está cadastrado");
  });

  it("token e usuário atual vêm da sessão", async () => {
    const auth = criarSupabaseAutenticacao(criarClienteFalso());
    expect(await auth.obterToken()).toBe("token-1");
    expect(await auth.usuarioAtual()).toBe("user-1");
  });
});
