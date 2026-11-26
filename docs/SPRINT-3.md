# Sprint 3: correções da banca de revisão e como publicar

Última sprint antes da entrega final. Antes de subir o código, uma banca de 5 revisores (segurança, usuário confuso, programador sênior, testador e chefe dos desenvolvedores) tentou reprovar o projeto. O veredito foi **reprovado, nota 6,5**, com 26 itens. Esta sprint corrige os **6 bloqueadores e os itens 7 a 22** que cabiam no prazo. O relatório completo está no PDF `Relatorio-Banca-Sprint3.pdf`, enviado à equipe.

> **Decisão da equipe:** o pagamento continua **simulado** (sem recurso nem tempo para integrar um provedor real). Por isso a recompensa das lojas é **demonstrativa**: as telas de recompensa avisam isso.

## O que foi corrigido

| # | Achado da banca | Correção | Onde |
|---|---|---|---|
| 1 | Preço manipulável: comprar um produto usando a oferta de **outro** produto | a compra confere se a oferta é daquele produto | `packages/dominio/src/compra.ts` |
| 2 | Venda em dobro com duas compras ao mesmo tempo | **fila de gravação** na API (uma escrita por vez) + número de pedido **único** no banco | `backend/src/1-application/casosDeUso.ts`, `0005_sprint3.sql` |
| 3 | Estoque negativo comprando pela oferta | disponível = o **menor** entre a oferta e o estoque real; ofertas ativas somadas não passam do estoque | `compra.ts`, `ofertas.ts` |
| 4 | Pedido não pago prendia o estoque para sempre | botão **Cancelar pedido** + pedido não pago em **30 minutos** é cancelado e o estoque volta | `pedidos.ts`, rota `POST /orders/:id/cancel`, `Checkout.jsx` |
| 5 | Recompensa poderia virar dinheiro real sem pagamento real | aviso **"Valores demonstrativos"** nas telas de recompensa (decisão da equipe) | `SimulatedRewardNotice.jsx` |
| 6 | `seed.sql` criava admin com a senha pública `123456` | o seed não cria mais admin e **recusa rodar** em banco com contas reais; a 0005 bloqueia a conta antiga se ela existir; a tela de login só mostra as contas de teste no **modo demo** | `seedSql.ts`, `0005_sprint3.sql`, `Auth.jsx` |
| 7 | Código de retirada fraco e sem limite de tentativas | **HMAC-SHA256** + bloqueio de 15 min depois de **5 erros** no mesmo pedido | `hmac.ts`, `pedidos.ts`, `casosDeUso.ts` |
| 8 | API pesada: um produtor podia derrubar o sistema | limite de **200 produtos por produtor** e teto de valores (parcial: ver "Pendências") | `produtos.ts`, `esquemas.ts` |
| 9 | Ninguém podia virar admin? (não estava no repositório) | trigger impede trocar o **perfil** pelo aplicativo (só SQL Editor ou API) | `0005_sprint3.sql` |
| 10 | Excluir produto com pedidos deixava pedidos sem produto | não exclui; a mensagem orienta a **zerar a quantidade** (editar agora aceita 0) | `produtos.ts` |
| 11 | Perfil errado no login dizia "senha incorreta" | mensagem diz qual é o perfil da conta | `usuarios.ts`, `supabaseAutenticacao.js` |
| 12 | Telas não atualizavam sozinhas | relê os dados a cada **20 s** e ao voltar para a aba | `AppProvider.jsx` |
| 13 | Pagar com a loja lotada ou suspensa | o pagamento confere a loja | `pedidos.ts` |
| 14 | Loja aprovada trocava o endereço e continuava aprovada; loja suspensa confirmava retiradas | mudar nome, endereço ou cidade volta para **Pendente**; loja não aprovada não movimenta pedidos | `lojas.ts`, `casosDeUso.ts` |
| 15 | Números absurdos (1e300) e categoria inventada | limites no esquema da API e no domínio; categoria e unidade só da lista | `esquemas.ts`, `produtos.ts`, `estoque.ts`, `ofertas.ts` |
| 16 | Admin fechava o mês ainda em andamento | só fecha depois que o mês termina | `recompensas.ts` |
| 22 | Limite de requisições igual para todos atrás do proxy | variável `TRUST_PROXY` (no Render: `1`) | `ambiente.ts`, `servidor.ts` |
| — | JSON malformado dava erro 500 | responde 400 | `servidor.ts` |
| — | Senha só com espaços era aceita | recusada | `usuarios.ts` |
| — | Tela em branco quando o pedido some do checkout | mensagem explicando o que houve | `Checkout.jsx` |

**Testes:** 190 testes automáticos (antes eram 168), todos passando. Os novos testes de regressão estão em `packages/dominio/src/sprint3.test.ts`, `backend/src/2-adapters/http/rotasApi.test.ts` (bloco "rotas da Sprint 3") e `frontend/src/3-frameworks/ui/Sprint3.test.jsx`. Cada um reproduz um defeito que existia.

## Pendências conhecidas (para depois da entrega)

- **Transação no banco** (item 2 completo): a fila de gravação resolve com **uma** instância da API, que é o caso do Render gratuito. Com várias instâncias, seria preciso uma função SQL transacional por caso de uso.
- **Carga da API** (item 8 completo): cada escrita ainda lê as tabelas inteiras e as fotos ficam no banco em base64. O ideal é usar o Storage do Supabase e ler só o necessário.
- **Esquema real do banco versionado** (item 9 completo): exportar o esquema do banco da Yara (`supabase db dump`) para `supabase/migrations/` e rodar `supabase/auditoria/auditoria-completa.sql` nele.
- Rotas por URL (o botão Voltar do navegador sai do site) e refatorações do programador sênior (itens 17 a 21 e 26).

## Como publicar (a ordem importa)

1. **Banco (Supabase da Yara)** → SQL Editor → colar e rodar [`supabase/banco-oficial/0005_sprint3.sql`](../supabase/banco-oficial/0005_sprint3.sql). Pode rodar de novo sem problema. As três consultas do fim mostram se deu certo.
   - Se aparecer "Há números de pedido repetidos", corrija os pedidos listados e rode de novo.
2. **API no Render** → Environment:
   - `TRUST_PROXY` = `1`
   - `CODIGO_RETIRADA_SEGREDO` = um texto longo aleatório (recomendado). **Atenção:** o código de retirada passou a ser calculado com HMAC, então os códigos de pedidos que já estavam na loja mudam. O comprador vê o novo no acompanhamento.
   - Merge do PR e **Manual Deploy só da API**.
3. **Congelar o site da Sprint 2** (um link por versão, pedido do professor): no projeto `hortilink-sprint2` da Vercel → *Settings → Git → Production Branch* = `release/sprint-2`. Essa branch aponta para o código exato da Sprint 2, então o link antigo não muda mais.
4. **Site da Sprint 3 na Vercel**: *Add New → Project → importar `yarabeatrixz/HortiLink`*.
   - **Root Directory:** `frontend`.
   - **Production Branch:** `Yara_beatrix`.
   - **Environment Variables:** `VITE_API_URL`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, os mesmos valores da Sprint 2.
   - Nome do projeto: `hortilink-sprint3` → link `https://hortilink-sprint3.vercel.app`.
5. **Liberar o link novo na API**: no Render, `FRONTEND_ORIGIN` com as três versões separadas por vírgula, por exemplo `https://hortilink-site.onrender.com,https://hortilink-sprint2.vercel.app,https://hortilink-sprint3.vercel.app`.
6. **Testar no link da Sprint 3 (DoD):**
   - login das 4 contas, incluindo o perfil errado, que agora mostra a mensagem certa;
   - compra → **Cancelar pedido** → o estoque volta;
   - fluxo de retirada com o código;
   - aviso "Valores demonstrativos" nas recompensas.

### Versões publicadas

| Versão | Site | Código | API e banco |
|---|---|---|---|
| Sprint 1 | https://hortilink-site.onrender.com | — | https://hortilink.onrender.com · Supabase da Yara (compartilhados) |
| Sprint 2 | https://hortilink-sprint2.vercel.app | branch `release/sprint-2` | os mesmos |
| Sprint 3 | https://hortilink-sprint3.vercel.app | branch `Yara_beatrix` | os mesmos |

As versões antigas continuam abrindo, mas usam a mesma API e o mesmo banco, então as regras novas também valem nelas. Por exemplo, a Sprint 2 também não consegue comprar com a oferta de outro produto. O histórico completo de mudanças está no [`CHANGELOG.md`](../CHANGELOG.md).
