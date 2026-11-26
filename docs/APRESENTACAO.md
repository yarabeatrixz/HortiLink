# Apresentação do HortiLink — roteiro para o professor

Duração sugerida: **12 a 15 minutos** + perguntas. Cada bloco traz o que mostrar na tela e o que dizer.

## Slide 1 — Abertura (30 s)
**Mostrar:** tela de login do HortiLink.
**Dizer:** "O HortiLink conecta produtores de hortaliças do Alto Tietê a compradores, com retirada em lojas parceiras. Fiz o projeto sozinha, do front ao banco: React, uma API em TypeScript e o Supabase."

## Slide 2 — Problema e solução (1 min)
- Problema: o produtor vende pouco direto, perde produto e não controla estoque nem custos.
- Solução: catálogo e ofertas para vender a sobra (queima de estoque), compra com retirada perto de casa, e gestão de estoque, perdas, custos e relatórios para o produtor.
- Três perfis: **Produtor**, **Comprador** e **Loja parceira**.

## Slide 3 — Demonstração ao vivo (5 min)
Rodar `pnpm --filter hortilink-frontend dev:demo` antes da aula (não precisa do banco; a internet só carrega fontes e fotos).
1. **Produtor** (`produtor@hortilink.com` / `123456`): mostrar o alerta de estoque baixo, cadastrar um produto e criar uma oferta.
2. **Comprador** (no celular ou com o navegador estreito): comprar a oferta, escolher a loja e pagar com Pix de teste. Mostrar "Pagamento aprovado".
3. **Loja**: ver o pedido pago para retirada.
4. **Produtor**: marcar "entregue na loja" e abrir os Relatórios.

> Se algo falhar na hora: há vídeo e áudio do tutorial em `docs/`.

## Slide 4 — Arquitetura (2 min)
**Mostrar:** o diagrama de `docs/ARQUITETURA.md`.
**Dizer:**
- "Usei **Clean Architecture** com camadas numeradas: 0 domínio, 1 casos de uso, 2 adapters e 3 frameworks. As dependências só apontam para dentro."
- "As **regras de negócio** ficam num pacote só (`@hortilink/dominio`), usado pelo front, para dar resposta rápida ao usuário, e pela API, que é a fonte da verdade."
- "Trocar o modo demo pelo banco real mudou **um arquivo só**, o `composition.js`. Nenhuma tela mudou."

## Slide 5 — Segurança (2 min)
**Dizer:**
- "O navegador **só lê** o banco, e o Supabase filtra cada linha com RLS. Quem grava é a API, que confere o login, o perfil e se a pessoa é dona do que está mudando."
- "Fiz uma **auditoria** seguindo o OWASP Top 10 e as checagens de segurança do Supabase e corrigi o que encontrei. Na Sprint 3, uma **banca de revisão** apontou mais 26 itens; corrigimos os bloqueadores, como o preço manipulável e a venda em dobro, cada um com um teste automático (`docs/SPRINT-3.md`)."
- "O **pagamento é simulado** por decisão da equipe: por isso a recompensa das lojas aparece como valor demonstrativo."
- "As chaves secretas ficam só no servidor; o front se recusa a abrir se alguém colocar a chave secreta nele."
**Mostrar:** a tabela de `docs/OWASP-TOP10.md`.

## Slide 6 — Qualidade (1 min)
- 190 testes automáticos (domínio 69, banco 10, API 52, front 59), rodando no CI a cada PR.
- Testes de usabilidade (Nielsen) no desktop e no celular, com acessibilidade pelo teclado: `docs/TESTES-USABILIDADE.md`.
- Fluxo de trabalho com branches, PRs, Conventional Commits e Dependabot.

## Slide 7 — Métodos ágeis (1 min)
- Três sprints (Scrum + Kanban), backlog de histórias US01–US12, incrementos entregues por PR.
- O que ficou para as próximas sprints: contraproposta (US06), código de retirada (US10), liquidação automática (US11/US12), deploy.

## Slide 8 — Aprendizados e próximos passos (1 min)
- Aprendi a separar regra de negócio de tecnologia, a pensar em segurança desde o banco e a testar cada camada.
- Próximos passos: transação nas compras, upload de fotos no Storage, deploy, teste com usuários reais.

---

## Perguntas prováveis (e respostas curtas)

| Pergunta | Resposta |
|---|---|
| Por que Supabase e não um banco próprio? | Postgres gerenciado com login e RLS prontos; deixa o foco nas regras e na segurança. |
| Por que uma API, se o Supabase já tem uma? | Para as regras de negócio (estoque, preço, dono) rodarem no servidor. Pelo navegador ninguém consegue gravar direto. |
| O que é RLS? | *Row Level Security*: o banco decide, linha por linha, o que cada usuário logado pode ver. |
| O pagamento é real? | Não, é simulado (ambiente de teste). Um provedor real (Pix/cartão) fica para depois. |
| E se duas pessoas comprarem o último item ao mesmo tempo? | É um limite conhecido (sem transação); o próximo passo é uma função SQL que grava tudo de uma vez. |
| Como você garante que nada quebra? | `pnpm check` (lint, tipos, testes e build) local e no CI antes de cada merge. |
| O código é aberto? | É um projeto acadêmico da equipe; o professor tem acesso ao repositório para avaliar. |

## Checklist do dia
- [ ] `pnpm install` e `pnpm check` na véspera.
- [ ] `dev:demo` aberto e testado (limpar os dados do site para começar do zero).
- [ ] Navegador com zoom de 125% para a turma enxergar.
- [ ] Vídeo do tutorial (`docs/tutorial-hortilink-video.mp4`) como plano B.
