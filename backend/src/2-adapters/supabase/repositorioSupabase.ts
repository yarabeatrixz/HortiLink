// RepositorioPort sobre o Supabase (Postgres via PostgREST), com a service_role.
// Este arquivo só faz I/O: a tradução e o cálculo de mudanças estão em @hortilink/banco.
//
// Limite conhecido (MVP): as operações de um salvamento não são uma transação.
// Próximo passo: uma função SQL `aplicar_mudancas(jsonb)` para gravar tudo de uma vez.

import {
  calcularOperacoes,
  chavesDaTabela,
  type Linhas,
  type Operacao,
  paraEstado,
  TABELAS,
  TABELAS_OPCIONAIS,
  type Tabela,
} from "@hortilink/banco";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RepositorioPort } from "../../1-application/portas";
import type { ConfigSupabase } from "./config";

export function clienteServidor(config: ConfigSupabase): SupabaseClient {
  return createClient(config.url, config.chaveServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function criarRepositorioSupabase(config: ConfigSupabase, cliente = clienteServidor(config)): RepositorioPort {
  async function lerTabela(tabela: Tabela) {
    const { data, error } = await cliente.from(tabela).select("*");
    // Tabela da migration 0004 ainda não criada: segue sem ela (a escrita é que vai avisar).
    if (error && TABELAS_OPCIONAIS.includes(tabela)) return [];
    if (error) throw new Error(`Falha ao ler ${tabela}: ${error.message}`);
    return data ?? [];
  }

  async function executar(operacao: Operacao): Promise<void> {
    if (operacao.tipo === "atualizar") {
      // users nasce no Auth: só atualiza nome e cidade, nunca cria nem muda o perfil.
      for (const { id, ...campos } of operacao.linhas) {
        const { error } = await cliente.from("users").update(campos).eq("id", String(id));
        if (error) throw new Error(`Falha ao atualizar users: ${error.message}`);
      }
      return;
    }
    if (operacao.tipo === "gravar") {
      // order_timeline só tem chave primária `id` (gerada pelo banco): os eventos são
      // só acrescentados e a "chave" deles é a linha inteira, então uma linha "mudada" é
      // sempre um evento novo → insert. As outras tabelas têm chave única → upsert.
      const { error } =
        operacao.tabela === "order_timeline"
          ? await cliente.from(operacao.tabela).insert(operacao.linhas)
          : await cliente
              .from(operacao.tabela)
              .upsert(operacao.linhas, {
                onConflict: chavesDaTabela(operacao.tabela as Exclude<Tabela, "users">).join(","),
              });
      if (error) throw new Error(`Falha ao gravar ${operacao.tabela}: ${error.message}`);
      return;
    }
    for (const chave of operacao.chaves) {
      const { error } = await cliente.from(operacao.tabela).delete().match(chave);
      if (error) throw new Error(`Falha ao apagar de ${operacao.tabela}: ${error.message}`);
    }
  }

  return {
    async carregar() {
      const lidas = await Promise.all(TABELAS.map(async (tabela) => [tabela, await lerTabela(tabela)] as const));
      return paraEstado(Object.fromEntries(lidas) as unknown as Linhas);
    },
    async salvar(antes, depois) {
      for (const operacao of calcularOperacoes(antes, depois)) await executar(operacao);
    },
  };
}
