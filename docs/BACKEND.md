# Guia para o back-end e o banco de dados

O front-end está pronto e funciona com **dados fictícios no navegador**. Este documento descreve o contrato entre front, API e banco.

> **Estado (fase 3):** as rotas de escrita abaixo estão **implementadas** em `backend/` (lista final, status HTTP e modo demo em [`backend/README.md`](../backend/README.md)).
> **Leituras** são feitas pelo front direto no Supabase, protegidas por RLS (`supabase/migrations/0001_schema.sql`); **escritas** só pela API.

## Onde o back-end entra no front

Pronto (fase 4): `frontend/src/composition.js` escolhe o modo pelas variáveis do Vite.

| Modo | Quando | Adapters |
|---|---|---|
| Demo | nenhuma `VITE_*` definida | `localStorageRepository` (dados de exemplo no navegador) |
| Conectado | `VITE_API_URL` + `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (ver `frontend/.env.example`) | `supabaseLeitura` (lê com a anon key; RLS decide), `supabaseAutenticacao` (Supabase Auth) e `apiEscrita` (`fetch` + `Authorization: Bearer <token>`) |

No modo conectado os casos de uso (`1-application/useCasesRemotos.js`) têm a **mesma interface** dos locais: escrevem pela API e releem o estado do banco; nenhuma tela muda. A tradução banco ↔ domínio é a mesma da API (`packages/banco`). Configuração pela metade dá erro claro ao abrir o app.

## Regras = validações do servidor

As regras ficam no pacote `@hortilink/dominio` (`packages/dominio/src`, TypeScript) e a API **importa as mesmas funções**: o servidor é a fonte da verdade e roda exatamente a mesma validação do front. As mensagens de erro do front são as que o usuário vê; a API pode devolver `{ "error": "mensagem" }` com status 4xx e o adapter repassa a mensagem.

## Entidades (formato atual dos dados)

| Entidade | Campos | Observações |
|---|---|---|
| `users` | `id, role (produtor\|comprador\|loja), name, city, email, password, pickupStoreIds[]` | `password` em texto puro **só no modo demo**. No servidor: hash (bcrypt/argon2) e nunca devolver a senha. `pickupStoreIds` só em produtor. |
| `products` | `id, producerId, name, category, unit, price, quantity, minQuantity, photo` | `photo` hoje é URL ou base64 → trocar por upload (storage) e salvar a URL. |
| `offers` | `id, producerId, productId, quantity, promotionalPrice, city, validityDays, storeIds[], createdAt, endedAt?` | Status calculado: `Encerrada` se `endedAt` ou vencida; `Esgotada` se `quantity <= 0`; senão `Ativa`. |
| `stores` | `id, userId, name, address, city, hours, distanceKm` | `distanceKm` é simulado; calcular por geolocalização no futuro. |
| `orders` | `id, orderNumber (#HL-000001), type (offer\|product), sourceId, producerId, buyerId, productId, quantity, unitPrice, storeId, status, createdAt, paidAt?, paymentMethod?, deliveredAt?, proposalId?, timeline[{label, at}]` | Sequência do número de pedido no servidor. |
| `stockMovements` | `id, type (Entrada\|Perda), producerId, productId, quantity, unitCost (entrada), reason (perda), note, createdAt` | Entrada soma e perda subtrai de `products.quantity` na mesma transação. Motivos de perda em `MOTIVOS_PERDA`. |
| `expenses` | `id, producerId, type (Custo\|Investimento), description, amount, createdAt` | Custos e investimentos que não são entrada de mercadoria. |
| `proposals` | `id, type, sourceId, producerId, buyerId, productId, quantity, unitPrice, storeId, status, createdAt, orderId?` | Regras prontas; a tela atual usa compra direta (ver "Pontos em aberto"). |

Valores fixos (status, categorias, unidades, eventos da linha do tempo): `packages/dominio/src/constantes.ts`. Use **exatamente as mesmas strings**.

Fluxo de status do pedido: `Aguardando pagamento → Pago → Entregue na loja (produtor) → Pronto para retirada (loja libera) → Retirado (loja confere o código do comprador)` (ou `Cancelado`).

Sprint 2 (detalhes e como publicar em [`SPRINT-2.md`](SPRINT-2.md)): perfil **admin**, lojas com `status` (só `Aprovada` aparece para escolha), capacidade em caixas (cada pedido pago e não retirado ocupa uma; loja lotada some da compra) e recompensa = valor fixo + % de cada pedido retirado.

## Operações (caso de uso → rota)

| Caso de uso (`useCases.js`) | Rota sugerida | Validações principais |
|---|---|---|
| `entrar` | `POST /auth/login` | e-mail + senha + perfil |
| `cadastrar` | `POST /auth/register` | campos obrigatórios, e-mail único, senha ≥ 6 |
| `sair` | `POST /auth/logout` | |
| `salvarProduto` | `POST /products` · `PUT /products/:id` | nome, preço > 0, quantidade > 0; só o dono edita |
| `excluirProduto` | `DELETE /products/:id` | remove as ofertas do produto |
| `criarOferta` | `POST /offers` | qtd > 0 e ≤ estoque; 0 < preço promocional < preço normal; cidade; validade > 0; ≥ 1 ponto |
| `encerrarOferta` | `POST /offers/:id/end` | só oferta ativa |
| `salvarPontosRetirada` | `PUT /producers/me/pickup-stores` | |
| `criarPedido` | `POST /orders` | oferta ativa; qtd ≤ disponível; ponto permitido; baixa estoque da oferta **e** do produto |
| `pagarPedido` | `POST /orders/:id/pay` | só "Aguardando pagamento" (pagamento hoje é simulado) |
| `confirmarEntregaNaLoja` | `POST /orders/:id/delivered` | só pedido "Pago"; só o produtor do pedido |
| `criarProposta` / `aceitarProposta` / `recusarProposta` | `POST /proposals` · `POST /proposals/:id/accept` · `/reject` | não decide duas vezes; aceitar reserva estoque e cria pedido |
| `salvarLoja` | `PUT /stores/me` | nome, endereço, cidade e horário; capacidade inteira ≥ 0; loja nova = Pendente |
| `excluirProdutos` | `POST /products/delete` | só produtos do próprio produtor |
| `codigoDeRetirada` | `GET /orders/:id/pickup-code` | só o comprador; só com o pedido na loja |
| `confirmarRecebimento` / `confirmarRetirada` | `POST /orders/:id/received` · `/picked-up` | só a loja do pedido; código de 6 dígitos |
| `atualizarPerfil` | `PUT /users/me` | nome e cidade (senha: Supabase Auth, no front) |
| `avaliarLoja` | `POST /admin/stores/:id/review` | só admin; reprovar/suspender exige motivo |
| `salvarConfigRecompensa` / `fecharMesRecompensa` | `PUT /admin/reward-settings` · `POST /admin/reward-payouts` | só admin; % entre 0 e 100; mês fecha uma vez |
| `registrarEntrada` | `POST /stock/entries` | qtd > 0; custo ≥ 0; soma ao estoque |
| `registrarPerda` | `POST /stock/losses` | qtd > 0 e ≤ estoque; motivo da lista; subtrai do estoque |
| `registrarDespesa` / `excluirDespesa` | `POST /expenses` · `DELETE /expenses/:id` | descrição; tipo Custo/Investimento; valor > 0 |
| relatórios (`calcularIndicadores`) | `GET /reports/producer?from=&to=` | receita só de pedidos pagos em diante; gastos = entradas + custos + investimentos |

Leituras de que as telas precisam: ofertas ativas, produtos por produtor, lojas, pedidos do usuário (comprador/produtor/loja), movimentações de estoque e despesas do produtor, usuário logado.

Alerta de estoque baixo: `quantity <= minQuantity` (ou `quantity <= 0`), regra em `packages/dominio/src/estoque.ts` (`statusEstoque`).

## Segurança (checklist antes de ir para produção)

- Senha com hash no servidor; sessão por cookie `HttpOnly` ou token com expiração (hoje o id do usuário fica no `localStorage`, aceitável só no modo demo).
- Autorização por perfil e por dono do recurso em toda rota de escrita.
- Nenhum dado real no seed nem nos testes (DoD).
- Pagamento real só por provedor (Pix/cartão); o front nunca deve receber nem guardar dados de cartão.

## Pontos em aberto (decisões de produto)

1. **Proposta × compra direta:** o backlog (US04/US05) descreve proposta → aceitar/recusar; a tela atual faz compra direta com pagamento. As regras de proposta existem e têm testes, mas não há tela.
