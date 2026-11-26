// Lê e valida as variáveis de ambiente uma única vez, na inicialização.
// Falta de configuração vira erro claro logo no início, não um bug no meio do uso.

import type { ConfigSupabase } from "../../2-adapters/supabase/config";

const HOST_LOCAL = "127.0.0.1";
const ENDERECOS_LOCAIS = new Set([HOST_LOCAL, "localhost", "::1"]);

export interface Ambiente {
  porta: number;
  host: string;
  /**
   * Origem(ns) do front-end liberada(s) no CORS. Várias versões do site (ex.: Sprint 1
   * no Render e Sprint 2 na Vercel) usam a mesma API: FRONTEND_ORIGIN aceita uma lista
   * separada por vírgula.
   */
  origemFrontend: string | string[];
  /**
   * "supabase" quando as chaves do Supabase estão no .env; senão "demo"
   * (dados de exemplo em memória e login de demonstração, só para desenvolvimento).
   */
  modo: "demo" | "supabase";
  supabase: ConfigSupabase | null;
  /** Segredo do código de retirada; sem CODIGO_RETIRADA_SEGREDO usa a chave secreta do Supabase. */
  segredoRetirada: string | undefined;
  /** Quantos proxies confiar no X-Forwarded-For (TRUST_PROXY; no Render, 1). false = nenhum. */
  proxiesConfiaveis: number | false;
}

const ORIGEM_PADRAO = "http://localhost:5173";

/** "https://a.com/, https://b.app" → ["https://a.com", "https://b.app"]; uma só vira texto. */
function lerOrigens(valor: string | undefined): string | string[] {
  const origens = (valor ?? ORIGEM_PADRAO)
    .split(",")
    .map((origem) => origem.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const invalida = origens.find((origem) => !/^https?:\/\/[^/\s]+$/.test(origem));
  if (invalida) {
    throw new Error(
      `FRONTEND_ORIGIN inválida: "${invalida}". Use só o endereço do site, ex.: https://hortilink.vercel.app (várias: separe por vírgula).`,
    );
  }
  if (!origens.length) return ORIGEM_PADRAO;
  return origens.length === 1 ? (origens[0] as string) : origens;
}

export function lerAmbiente(variaveis: Record<string, string | undefined> = process.env): Ambiente {
  const porta = Number(variaveis.PORT ?? 3333);
  if (!Number.isInteger(porta) || porta <= 0) {
    throw new Error(`PORT inválida: "${variaveis.PORT}". Use um número inteiro, ex.: 3333.`);
  }

  const url = variaveis.SUPABASE_URL?.trim();
  const chaveServiceRole = variaveis.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (Boolean(url) !== Boolean(chaveServiceRole)) {
    throw new Error("Informe SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY juntas (ou nenhuma, para o modo demo).");
  }
  const supabase = url && chaveServiceRole ? { url, chaveServiceRole } : null;

  if (supabase?.chaveServiceRole.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY recebeu a chave PUBLICÁVEL; use a chave secreta (sb_secret_…).");
  }

  const host = variaveis.HOST ?? HOST_LOCAL;
  if (!supabase && variaveis.NODE_ENV === "production") {
    throw new Error("Em produção a API exige o Supabase: o modo demo aceita login falso e é só para desenvolvimento.");
  }
  // O login falso do modo demo nunca fica acessível de outra máquina (auditoria, item 1a).
  if (!supabase && !ENDERECOS_LOCAIS.has(host)) {
    throw new Error(`Modo demo só escuta neste computador (HOST=${HOST_LOCAL}); configure o Supabase para usar HOST=${host}.`);
  }

  return {
    porta,
    host,
    origemFrontend: lerOrigens(variaveis.FRONTEND_ORIGIN),
    modo: supabase ? "supabase" : "demo",
    supabase,
    segredoRetirada: variaveis.CODIGO_RETIRADA_SEGREDO?.trim() || supabase?.chaveServiceRole,
    proxiesConfiaveis: lerProxies(variaveis.TRUST_PROXY),
  };
}

function lerProxies(valor: string | undefined): number | false {
  if (!valor?.trim()) return false;
  const quantidade = Number(valor);
  if (!Number.isInteger(quantidade) || quantidade < 0 || quantidade > 5) {
    throw new Error(`TRUST_PROXY inválido: "${valor}". Use o número de proxies na frente da API (no Render, 1).`);
  }
  return quantidade || false;
}
