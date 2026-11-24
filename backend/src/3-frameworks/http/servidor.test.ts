import { describe, expect, it } from "vitest";
import { lerAmbiente } from "../config/ambiente";
import { criarServidor } from "./servidor";

const ORIGEM = "http://localhost:5173";

describe("servidor", () => {
  it("GET /saude responde ok com CORS para o front-end", async () => {
    const app = criarServidor({ origemFrontend: ORIGEM });
    const resposta = await app.inject({ method: "GET", url: "/saude", headers: { origin: ORIGEM } });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({ status: "ok", servico: "hortilink-api" });
    expect(resposta.headers["access-control-allow-origin"]).toBe(ORIGEM);
    await app.close();
  });

  it("envia cabeçalhos de segurança", async () => {
    const app = criarServidor({ origemFrontend: ORIGEM });
    const resposta = await app.inject({ method: "GET", url: "/saude" });
    expect(resposta.headers["x-content-type-options"]).toBe("nosniff");
    expect(resposta.headers["content-security-policy"]).toContain("default-src 'none'");
    await app.close();
  });

  it("limita requisições por minuto (429 com mensagem clara)", async () => {
    const app = criarServidor({ origemFrontend: ORIGEM });
    let ultima = await app.inject({ method: "GET", url: "/saude" });
    for (let i = 0; i < 120; i += 1) ultima = await app.inject({ method: "GET", url: "/saude" });
    expect(ultima.statusCode).toBe(429);
    expect(ultima.json()).toEqual({ error: "Muitas requisições. Aguarde um minuto e tente de novo." });
    await app.close();
  });

  it("libera várias versões do site (Render e Vercel) e bloqueia as outras", async () => {
    const vercel = "https://hortilink-sprint2.vercel.app";
    const app = criarServidor({ origemFrontend: [ORIGEM, vercel] });
    const de = async (origin: string) =>
      (await app.inject({ method: "GET", url: "/saude", headers: { origin } })).headers["access-control-allow-origin"];
    expect(await de(vercel)).toBe(vercel);
    expect(await de(ORIGEM)).toBe(ORIGEM);
    expect(await de("https://site-qualquer.com")).toBeUndefined();
    await app.close();
  });

  it("rota inexistente devolve 404", async () => {
    const app = criarServidor({ origemFrontend: ORIGEM });
    const resposta = await app.inject({ method: "GET", url: "/nao-existe" });
    expect(resposta.statusCode).toBe(404);
    await app.close();
  });
});

describe("ambiente", () => {
  it("sem Supabase usa o modo demo e padrões seguros", () => {
    expect(lerAmbiente({})).toEqual({
      porta: 3333,
      host: "127.0.0.1",
      origemFrontend: ORIGEM,
      modo: "demo",
      supabase: null,
    });
  });

  it("FRONTEND_ORIGIN aceita lista separada por vírgula e ignora a barra final", () => {
    expect(lerAmbiente({ FRONTEND_ORIGIN: "https://a.onrender.com/, https://b.vercel.app" }).origemFrontend).toEqual([
      "https://a.onrender.com",
      "https://b.vercel.app",
    ]);
    expect(lerAmbiente({ FRONTEND_ORIGIN: "https://a.onrender.com/" }).origemFrontend).toBe("https://a.onrender.com");
    expect(() => lerAmbiente({ FRONTEND_ORIGIN: "https://a.com/painel" })).toThrow(/FRONTEND_ORIGIN inválida/);
  });

  it("com URL e service_role usa o modo supabase", () => {
    const ambiente = lerAmbiente({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "chave" });
    expect(ambiente.modo).toBe("supabase");
    expect(ambiente.supabase).toEqual({ url: "https://x.supabase.co", chaveServiceRole: "chave" });
  });

  it("recusa porta inválida, chave do Supabase pela metade e modo demo em produção", () => {
    expect(() => lerAmbiente({ PORT: "abc" })).toThrow(/PORT inválida/);
    expect(() => lerAmbiente({ SUPABASE_URL: "https://x.supabase.co" })).toThrow(/juntas/);
    expect(() => lerAmbiente({ NODE_ENV: "production" })).toThrow(/exige o Supabase/);
  });

  it("modo demo (login falso) não escuta fora deste computador", () => {
    expect(() => lerAmbiente({ HOST: "0.0.0.0" })).toThrow(/Modo demo só escuta neste computador/);
    expect(lerAmbiente({ HOST: "localhost" }).modo).toBe("demo");
  });

  it("com Supabase pode escutar em qualquer endereço", () => {
    const ambiente = lerAmbiente({ HOST: "0.0.0.0", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x" });
    expect(ambiente.host).toBe("0.0.0.0");
  });

  it("recusa a chave publicável no lugar da secreta", () => {
    expect(() =>
      lerAmbiente({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_x" }),
    ).toThrow(/chave PUBLICÁVEL/);
  });
});
