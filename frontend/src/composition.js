// Composition root: fora das camadas, é o ÚNICO lugar que escolhe implementações.
// Com VITE_API_URL + VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY → modo conectado
// (lê do Supabase, escreve pela API). Sem elas → modo demo no localStorage.

import { createClient } from "@supabase/supabase-js";
import {
  criarApiEscrita,
  criarLocalStorageRepository,
  criarSupabaseAutenticacao,
  criarSupabaseLeitura,
} from "@adapters";
import { criarCasosDeUso, criarCasosDeUsoRemotos } from "@application";
import { lerConfigRemota } from "./configRemota";

function montarModoConectado({ urlApi, urlSupabase, chaveAnonSupabase }) {
  const cliente = createClient(urlSupabase, chaveAnonSupabase);
  const autenticacao = criarSupabaseAutenticacao(cliente);
  return criarCasosDeUsoRemotos({
    leitura: criarSupabaseLeitura(cliente),
    autenticacao,
    escrita: criarApiEscrita({ urlBase: urlApi, obterToken: autenticacao.obterToken }),
  });
}

const config = lerConfigRemota(import.meta.env);

/** Modo demonstração (dados fictícios no navegador). As contas de teste só aparecem nele. */
export const modoDemo = !config;

export const casosDeUso = config
  ? montarModoConectado(config)
  : criarCasosDeUso(criarLocalStorageRepository());
