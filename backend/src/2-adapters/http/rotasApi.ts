// Rotas de escrita da API (contrato em docs/BACKEND.md). Cada rota é fina:
// pega o usuário logado, repassa o corpo ao caso de uso e responde.
// Leituras são feitas pelo front direto no Supabase, protegidas por RLS.

import type {
  DadosEntrada,
  DadosLoja,
  DadosOferta,
  DadosPerda,
  MetodoPagamento,
} from "@hortilink/dominio";
import type { FastifyInstance } from "fastify";
import type {
  CasosDeUso,
  EntradaCompra,
  EntradaDespesa,
  EntradaProduto,
} from "../../1-application/casosDeUso";
import type { VerificadorDeTokenPort } from "../../1-application/portas";
import { exigirLogin } from "./autenticacao";
import * as esquemas from "./esquemas";

type ComId = { Params: { id: string } };

export function registrarRotasApi(
  app: FastifyInstance,
  casos: CasosDeUso,
  verificador: VerificadorDeTokenPort,
): void {
  app.register(async (rotas) => {
    exigirLogin(rotas, verificador);

    // ------------------------------------------------------------ Produtor
    rotas.post<{ Body: EntradaProduto }>("/products", { schema: { body: esquemas.esquemaProduto } }, async (req, res) => {
      await casos.salvarProduto(req.userId, { ...req.body, id: undefined });
      return res.code(201).send({ ok: true });
    });

    rotas.put<ComId & { Body: EntradaProduto }>(
      "/products/:id",
      { schema: { body: esquemas.esquemaProduto } },
      async (req) => {
        await casos.salvarProduto(req.userId, { ...req.body, id: req.params.id });
        return { ok: true };
      },
    );

    rotas.post<{ Body: { ids: string[] } }>(
      "/products/delete",
      { schema: { body: esquemas.esquemaExcluirProdutos } },
      async (req) => {
        await casos.excluirProdutos(req.userId, req.body.ids);
        return { ok: true };
      },
    );

    rotas.delete<ComId>("/products/:id", async (req) => {
      await casos.excluirProduto(req.userId, req.params.id);
      return { ok: true };
    });

    rotas.post<{ Body: DadosOferta }>("/offers", { schema: { body: esquemas.esquemaOferta } }, async (req, res) => {
      await casos.criarOferta(req.userId, req.body);
      return res.code(201).send({ ok: true });
    });

    rotas.post<ComId>("/offers/:id/end", async (req) => {
      await casos.encerrarOferta(req.userId, req.params.id);
      return { ok: true };
    });

    rotas.put<{ Body: { storeIds: string[] } }>(
      "/producers/me/pickup-stores",
      { schema: { body: esquemas.esquemaPontosRetirada } },
      async (req) => {
        await casos.salvarPontosRetirada(req.userId, req.body.storeIds);
        return { ok: true };
      },
    );

    rotas.post<ComId>("/orders/:id/delivered", async (req) => {
      await casos.confirmarEntregaNaLoja(req.userId, req.params.id);
      return { ok: true };
    });

    rotas.post<{ Body: DadosEntrada }>("/stock/entries", { schema: { body: esquemas.esquemaEntrada } }, async (req, res) => {
      await casos.registrarEntrada(req.userId, req.body);
      return res.code(201).send({ ok: true });
    });

    rotas.post<{ Body: DadosPerda }>("/stock/losses", { schema: { body: esquemas.esquemaPerda } }, async (req, res) => {
      await casos.registrarPerda(req.userId, req.body);
      return res.code(201).send({ ok: true });
    });

    rotas.post<{ Body: EntradaDespesa }>("/expenses", { schema: { body: esquemas.esquemaDespesa } }, async (req, res) => {
      await casos.registrarDespesa(req.userId, req.body);
      return res.code(201).send({ ok: true });
    });

    rotas.delete<ComId>("/expenses/:id", async (req) => {
      await casos.excluirDespesa(req.userId, req.params.id);
      return { ok: true };
    });

    // ------------------------------------------------------------ Comprador
    rotas.post<{ Body: EntradaCompra }>("/orders", { schema: { body: esquemas.esquemaPedido } }, async (req, res) => {
      const { order } = await casos.criarPedido(req.userId, req.body);
      return res.code(201).send({ ok: true, order });
    });

    rotas.post<ComId & { Body: { method: MetodoPagamento } }>(
      "/orders/:id/pay",
      { schema: { body: esquemas.esquemaPagamento } },
      async (req) => {
        await casos.pagarPedido(req.userId, req.params.id, req.body.method);
        return { ok: true };
      },
    );

    rotas.get<ComId>("/orders/:id/pickup-code", async (req) => ({
      code: await casos.codigoDeRetirada(req.userId, req.params.id),
    }));

    // ------------------------------------------------------------ Loja parceira
    rotas.put<{ Body: DadosLoja }>("/stores/me", { schema: { body: esquemas.esquemaLoja } }, async (req) => {
      await casos.salvarLoja(req.userId, req.body);
      return { ok: true };
    });

    rotas.post<ComId>("/orders/:id/received", async (req) => {
      await casos.confirmarRecebimento(req.userId, req.params.id);
      return { ok: true };
    });

    rotas.post<ComId & { Body: { code: string } }>(
      "/orders/:id/picked-up",
      { schema: { body: esquemas.esquemaCodigoRetirada } },
      async (req) => {
        await casos.confirmarRetirada(req.userId, req.params.id, req.body.code);
        return { ok: true };
      },
    );

    // ------------------------------------------------------------ Todos os perfis
    rotas.put<{ Body: { name: string; city: string } }>(
      "/users/me",
      { schema: { body: esquemas.esquemaPerfil } },
      async (req) => {
        await casos.atualizarPerfil(req.userId, req.body);
        return { ok: true };
      },
    );

    // ------------------------------------------------------------ Administrador
    rotas.post<ComId & { Body: { status: string; note?: string } }>(
      "/admin/stores/:id/review",
      { schema: { body: esquemas.esquemaAvaliarLoja } },
      async (req) => {
        await casos.avaliarLoja(req.userId, req.params.id, req.body);
        return { ok: true };
      },
    );

    rotas.put<{ Body: { fixedAmount: number | string; percent: number | string } }>(
      "/admin/reward-settings",
      { schema: { body: esquemas.esquemaConfigRecompensa } },
      async (req) => {
        await casos.salvarConfigRecompensa(req.userId, req.body);
        return { ok: true };
      },
    );

    rotas.post<{ Body: { storeId: string; month: string } }>(
      "/admin/reward-payouts",
      { schema: { body: esquemas.esquemaFechamento } },
      async (req, res) => {
        const { payout } = await casos.fecharMesRecompensa(req.userId, req.body.storeId, req.body.month);
        return res.code(201).send({ ok: true, payout });
      },
    );
  });
}
