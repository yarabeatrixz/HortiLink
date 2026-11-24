// Lê e valida as variáveis de ambiente uma única vez, na inicialização.
// Falta de configuração vira erro claro logo no início, não um bug no meio do uso.

import type { ConfigSupabase } from "../../2-adapters/supabase/config";

const HOST_LOCAL = "127.0.0.1";
const ENDERECOS_LOCAIS = new Set([HOST_LOCAL, "localhost", "::1"]);

export interface Ambiente {
  porta: number;
  host: string;
  /** Origem do front-end liberada no CORS (ex.: http://localhost:5173). */
  origemFrontend: string;
  /**
   * "supabase" quando as chaves do Supabase estão no .env; senão "demo"
   * (dados de exemplo em memória e login de demonstração, só para desenvolvimento).
   */
  modo: "demo" | "supabase";
  supabase: ConfigSupabase | null;
  /** Segredo do código de retirada; sem CODIGO_RETIRADA_SEGREDO usa a chave secreta do Supabase. */
  segredoRetirada: string | undefined;
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
    origemFrontend: variaveis.FRONTEND_ORIGIN ?? "http://localhost:5173",
    modo: supabase ? "supabase" : "demo",
    supabase,
    segredoRetirada: variaveis.CODIGO_RETIRADA_SEGREDO?.trim() || supabase?.chaveServiceRole,
  };
}
