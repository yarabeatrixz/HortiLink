// Composition root: ÚNICO lugar que escolhe as implementações das portas.
// Modo demo → memória + login de demonstração. Modo supabase → adapters do Supabase.

import { criarExemplo } from "@hortilink/dominio/exemplo";
import { criarCasosDeUso } from "./1-application/casosDeUso";
import type { RepositorioPort, VerificadorDeTokenPort } from "./1-application/portas";
import { criarRepositorioEmMemoria } from "./2-adapters/memoria/repositorioEmMemoria";
import { verificadorDemo } from "./2-adapters/memoria/verificadorDemo";
import { criarRepositorioSupabase } from "./2-adapters/supabase/repositorioSupabase";
import { criarVerificadorSupabase } from "./2-adapters/supabase/verificadorSupabase";
import type { Ambiente } from "./3-frameworks/config/ambiente";
import type { DependenciasServidor } from "./3-frameworks/http/servidor";

export function montarDependencias(ambiente: Ambiente): DependenciasServidor {
  const { repositorio, verificador } = escolherAdapters(ambiente);
  return {
    casos: criarCasosDeUso({ repositorio, segredoRetirada: ambiente.segredoRetirada }),
    verificador,
  };
}

function escolherAdapters(ambiente: Ambiente): {
  repositorio: RepositorioPort;
  verificador: VerificadorDeTokenPort;
} {
  if (ambiente.supabase) {
    return {
      repositorio: criarRepositorioSupabase(ambiente.supabase),
      verificador: criarVerificadorSupabase(ambiente.supabase),
    };
  }
  return { repositorio: criarRepositorioEmMemoria(criarExemplo()), verificador: verificadorDemo };
}
