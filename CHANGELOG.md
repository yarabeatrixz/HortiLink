# Histórico de versões do HortiLink

Cada sprint é uma versão publicada com link próprio (pedido do professor). O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [3.1.0] — Sprint 3 · 25/11/2026 · mostrar senha

Site: https://hortilink-sprint3.vercel.app (mesmo link da 3.0.0)

### Adicionado
- Botão de olho para mostrar ou ocultar a senha no login, no cadastro e na troca de senha do perfil.

## [3.0.0] — Sprint 3 · 25/11/2026 · correções da banca de revisão

Site: https://hortilink-sprint3.vercel.app · Detalhes e passos de publicação: [`docs/SPRINT-3.md`](docs/SPRINT-3.md)

### Segurança
- A compra confere se a oferta é do produto (antes dava para pagar o preço promocional de outro item).
- Código de retirada com HMAC-SHA256 e bloqueio de 15 minutos depois de 5 erros no mesmo pedido.
- O `seed.sql` não cria mais administrador e recusa rodar em banco com contas reais; a migration 0005 bloqueia a conta antiga `admin@hortilink.com`.
- Trigger no banco impede trocar o perfil da conta pelo aplicativo.
- As contas de demonstração só aparecem na tela de login no modo demo.
- A API limita valores (preço, quantidade, listas) e aceita só categorias e unidades da lista.
- `TRUST_PROXY` faz o limite de requisições valer por usuário atrás do proxy do Render.

### Corrigido
- Venda em dobro com duas compras ao mesmo tempo (fila de gravação na API + número de pedido único no banco).
- O estoque não fica negativo ao comprar pela oferta; ofertas do mesmo produto somadas não passam do estoque.
- O pagamento confere se a loja ainda está aprovada e com espaço.
- Uma loja aprovada que muda nome, endereço ou cidade volta para análise; uma loja suspensa não movimenta pedidos.
- Produto com pedidos não é mais excluído (o pedido ficava sem produto); editar aceita estoque 0.
- O admin só fecha o mês depois que ele termina.
- Perfil errado no login mostra qual é o perfil da conta, em vez de "senha incorreta".
- JSON malformado responde 400 (antes, 500); senha só com espaços é recusada.

### Adicionado
- Cancelar pedido não pago, com o estoque voltando. Pedido não pago em 30 minutos é cancelado sozinho.
- As telas se atualizam sozinhas a cada 20 s e ao voltar para a aba.
- Aviso "Valores demonstrativos" nas recompensas (o pagamento é simulado).
- 22 testes de regressão (190 no total).

## [2.0.0] — Sprint 2 · 24/11/2026 · administrador e retirada com código

Site: https://hortilink-sprint2.vercel.app (branch `release/sprint-2`) · Detalhes: [`docs/SPRINT-2.md`](docs/SPRINT-2.md)

- Perfil **Administrador**: aprova, reprova e suspende pontos de coleta, define a recompensa das lojas e fecha o mês.
- **Retirada com código** de 6 dígitos (produtor entrega → loja libera → comprador mostra o código).
- Capacidade das lojas (caixas secas e refrigeradas), foto do ponto e aba "Meu perfil".
- Correções do relatório de inconsistências (COMP-01, PROD-01 a 05, LOJA-01 e 02, GER-01).

## [1.0.0] — Sprint 1 · 17/11/2026 · MVP conectado

Site: https://hortilink-site.onrender.com

- Monorepo (domínio em TypeScript, API Fastify, front React) em Clean Architecture.
- Catálogo, ofertas, compra com pagamento simulado, estoque, custos e relatórios do produtor.
- Supabase com RLS (o navegador só lê; quem grava é a API) e auditoria OWASP Top 10.
