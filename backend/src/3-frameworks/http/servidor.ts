// Monta o servidor Fastify: CORS, tradução de erros e rotas. Não abre porta:
// quem chama decide (main.ts em produção; testes usam `app.inject` sem rede).

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { CasosDeUso } from "../../1-application/casosDeUso";
import { ErroDeAplicacao, type MotivoErro } from "../../1-application/erros";
import type { VerificadorDeTokenPort } from "../../1-application/portas";
import { registrarRotasApi } from "../../2-adapters/http/rotasApi";
import { registrarRotasSaude } from "../../2-adapters/http/rotasSaude";
import type { Ambiente } from "../config/ambiente";

const STATUS_POR_MOTIVO: Record<MotivoErro, number> = {
  "nao-autenticado": 401,
  proibido: 403,
  "nao-encontrado": 404,
  regra: 422,
};

/** Corpo máximo: a foto do produto (até ~1 MB em base64) é o maior campo. */
const LIMITE_CORPO_BYTES = 1.5 * 1024 * 1024;
/** Requisições por IP a cada minuto (protege o banco: cada escrita lê o estado inteiro). */
const REQUISICOES_POR_MINUTO = 120;

export interface DependenciasServidor {
  casos: CasosDeUso;
  verificador: VerificadorDeTokenPort;
}

export function criarServidor(
  ambiente: Pick<Ambiente, "origemFrontend"> & Partial<Pick<Ambiente, "proxiesConfiaveis">>,
  dependencias?: DependenciasServidor,
  opcoes = { log: false },
): FastifyInstance {
  // removeAdditional: false → campo desconhecido no corpo é recusado (400), não apagado em silêncio.
  const app = Fastify({
    logger: opcoes.log,
    bodyLimit: LIMITE_CORPO_BYTES,
    // Atrás do proxy do Render o IP do cliente vem no X-Forwarded-For; sem isso todos
    // os usuários dividiriam o mesmo limite de requisições (achado 22 da banca).
    // Confia só nos N saltos mais próximos (os proxies do provedor), não no que o cliente escreve.
    trustProxy: (_endereco: string, salto: number) => salto < (ambiente.proxiesConfiaveis || 0),
    ajv: { customOptions: { removeAdditional: false } },
  });

  // Cabeçalhos de segurança (HSTS, nosniff, frame-ancestors…): a API só devolve JSON.
  app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } } });
  app.register(rateLimit, {
    max: REQUISICOES_POR_MINUTO,
    timeWindow: "1 minute",
    // O plugin lança o que esta função devolve; o tratador de erros abaixo responde { error }.
    errorResponseBuilder: () =>
      Object.assign(new Error("Muitas requisições. Aguarde um minuto e tente de novo."), { statusCode: 429 }),
  });

  app.register(cors, {
    origin: ambiente.origemFrontend,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Erros viram { error: "mensagem" } com o status certo; o front mostra a mensagem.
  app.setErrorHandler((erro: FastifyError | ErroDeAplicacao, _requisicao, resposta) => {
    if (erro instanceof ErroDeAplicacao) {
      return resposta.code(STATUS_POR_MOTIVO[erro.motivo]).send({ error: erro.message });
    }
    if (erro.statusCode === 429 || erro.statusCode === 413) {
      const mensagem =
        erro.statusCode === 413 ? "Envio grande demais: use uma foto de até 1 MB." : erro.message;
      return resposta.code(erro.statusCode).send({ error: mensagem });
    }
    if (erro.validation) {
      return resposta.code(400).send({ error: "Dados inválidos: confira os campos enviados" });
    }
    // JSON malformado, tipo de conteúdo errado etc.: erro de quem enviou, não do servidor.
    if (erro.statusCode && erro.statusCode >= 400 && erro.statusCode < 500) {
      return resposta.code(erro.statusCode).send({ error: "Requisição inválida. Recarregue a página e tente de novo." });
    }
    app.log.error(erro);
    return resposta.code(500).send({ error: "Erro inesperado no servidor. Tente de novo." });
  });

  // As rotas entram depois dos plugins acima, para o limite de requisições valer em todas.
  app.register(async (rotas) => {
    registrarRotasSaude(rotas);
    if (dependencias) registrarRotasApi(rotas, dependencias.casos, dependencias.verificador);
  });
  return app;
}
