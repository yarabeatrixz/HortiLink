# HortiLink · Back-end

API do HortiLink em **TypeScript estrito** (Fastify), em Clean Architecture. As regras de negócio vêm do pacote compartilhado `@hortilink/dominio`: o servidor roda **as mesmas regras** que o front-end e é a fonte da verdade. Banco e login: **Supabase**.

**Divisão de responsabilidades:** o front **lê** direto do Supabase (protegido por RLS) e **escreve só pela API**. A API confere login, perfil e dono, roda a regra do domínio e grava com a `service_role`.

## Camadas

```
src/
├── 1-application/
│   ├── portas.ts            RepositorioPort, VerificadorDeTokenPort, Relogio
│   ├── casosDeUso.ts        autorização (perfil e dono) + regras do domínio
│   └── erros.ts             ErroDeAplicacao: nao-autenticado | proibido | nao-encontrado | regra
├── 2-adapters/
│   ├── http/                rotas finas, login por Bearer token, esquemas de validação do corpo
│   ├── memoria/             repositório em memória + login demo (desenvolvimento e testes)
│   └── supabase/            repositório (tradução banco ↔ domínio em @hortilink/banco), verificador de token, gerador de seed
├── 3-frameworks/
│   ├── config/ambiente.ts   variáveis validadas; escolhe o modo demo ou supabase
│   └── http/servidor.ts     Fastify: CORS, tradução de erros, registro das rotas
├── composition.ts           único lugar que escolhe os adapters
└── main.ts                  lê o ambiente, monta e abre a porta
```

Dependências só para dentro: `3-frameworks → 2-adapters → 1-application → @hortilink/dominio`.

## Como rodar

```bash
pnpm install                              # na raiz do monorepo
cp backend/.env.example backend/.env      # opcional: sem Supabase roda em modo demo
pnpm --filter @hortilink/backend dev      # http://localhost:3333/saude
```

**Modo demo** (sem Supabase no `.env`): dados de exemplo em memória e login com o header `Authorization: Bearer demo:<id>`, ex.: `demo:user-produtor`. É proibido em produção: com `NODE_ENV=production`, a API se recusa a subir sem o Supabase.

| Script | O que faz |
|---|---|
| `pnpm dev` / `pnpm start` | API com / sem recarga automática |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | oxlint · `tsc` estrito · Vitest (rotas testadas com `app.inject`, sem rede) |
| `pnpm check` | lint + tipos + testes |
| `pnpm gerar:seed` | gera `supabase/seed.sql` a partir dos dados de exemplo |

## Rotas

Todas exigem `Authorization: Bearer <token do Supabase>`, menos `/saude`.

| Método | Rota | Perfil | O quê |
|---|---|---|---|
| `GET` | `/saude` | — | API no ar |
| `POST` · `PUT` · `DELETE` | `/products` · `/products/:id` | produtor (dono) | catálogo |
| `POST` | `/offers` · `/offers/:id/end` | produtor (dono) | criar / encerrar oferta |
| `PUT` | `/producers/me/pickup-stores` | produtor | pontos de retirada do catálogo |
| `POST` | `/stock/entries` · `/stock/losses` | produtor (dono) | entrada / perda de estoque |
| `POST` · `DELETE` | `/expenses` · `/expenses/:id` | produtor (dono) | custos e investimentos |
| `POST` | `/orders` | comprador | comprar (devolve o pedido com número) |
| `POST` | `/orders/:id/pay` | comprador (dono) | pagamento **simulado** |
| `POST` | `/orders/:id/delivered` | produtor (dono) | entregue na loja |
| `PUT` | `/stores/me` | loja | ponto de coleta (com foto e capacidade) |
| `POST` | `/products/delete` | produtor (dono) | excluir vários produtos (`{ ids }`) |
| `GET` | `/orders/:id/pickup-code` | comprador (dono) | código de retirada (só com o produto na loja) |
| `POST` | `/orders/:id/received` | loja do pedido | libera para retirada |
| `POST` | `/orders/:id/picked-up` | loja do pedido | confere o código (`{ code }`) → Retirado |
| `PUT` | `/users/me` | todos | nome e cidade |
| `POST` | `/admin/stores/:id/review` | admin | aprovar / reprovar / suspender (`{ status, note }`) |
| `PUT` | `/admin/reward-settings` | admin | regra da recompensa (`{ fixedAmount, percent }`) |
| `POST` | `/admin/reward-payouts` | admin | fecha o mês de uma loja (`{ storeId, month }`) |

Respostas de erro: `{ "error": "mensagem pronta para o usuário" }` com **400** (corpo inválido), **401** (sem login), **403** (perfil ou dono errado), **404** (não existe) ou **422** (regra de negócio).

## Limites conhecidos (MVP)

- O repositório Supabase carrega o estado inteiro a cada escrita e grava só o que mudou, mas **sem transação**. Próximo passo: uma função SQL `aplicar_mudancas(jsonb)` para gravar tudo de uma vez.
- O número do pedido é calculado na API (`#HL-000001`); dois pedidos simultâneos podem colidir (o banco recusa o duplicado com `unique`).
- Propostas (US04/US05) não têm rota: aguardam a decisão de produto.
