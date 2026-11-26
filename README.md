# 🥬 HortiLink — Hortaliças do Alto Tietê

## Sobre o projeto

O HortiLink é um projeto acadêmico de Engenharia de Software: um sistema web que conecta **produtores** de verduras e legumes do Alto Tietê a **compradores** (restaurantes, sacolões, mercados e famílias), com retirada em **lojas parceiras**. Além da venda, o produtor controla o próprio estoque: entradas, perdas, custos e indicadores.

## Objetivo

Facilitar o gerenciamento de produtos, entradas, vendas, perdas e quantidades disponíveis, aproximando quem produz de quem compra. O resultado esperado é uma gestão mais organizada, preço justo e menos desperdício.

## Perfis de acesso

| Perfil | O que faz |
|---|---|
| **Produtor** | Cadastra produtos, controla o estoque (entradas, perdas, alertas), publica ofertas, acompanha vendas, custos e relatórios |
| **Comprador** | Encontra ofertas e catálogos dos produtores, compra, paga (checkout simulado) e acompanha a retirada |
| **Loja parceira** | Cadastra o ponto de coleta e vê os pedidos que serão retirados ali |

## Funcionalidades

| Funcionalidade | Onde no app (perfil Produtor) | Status |
|---|---|---|
| Cadastro de produtos | Catálogo → Cadastrar produto (foto, categoria, unidade, preço, quantidade, estoque mínimo) | ✅ |
| Registro de entrada de mercadorias | Estoque → Registrar entrada (quantidade, custo por unidade, observação) | ✅ |
| Consulta de estoque | Estoque → tabela com quantidade, mínimo e situação de cada produto | ✅ |
| Registro de vendas | Pedidos dos compradores geram vendas numeradas (`#HL-000001`); Minhas vendas tem filtros e totais | ✅ |
| Controle de perdas | Estoque → Registrar perda (quantidade e motivo) | ✅ |
| Registro de entradas | Estoque → Movimentações (histórico de entradas e perdas, com filtro) | ✅ |
| Controle de custos e investimentos | Custos → custos do dia a dia e investimentos, com totais | ✅ |
| Alertas de estoque baixo | Aviso no Catálogo e no Estoque quando o produto chega ao estoque mínimo | ✅ |
| Relatórios e indicadores | Relatórios → receita, gastos, resultado, perdas e tabela por produto, por período | ✅ |
| Ofertas promocionais (queima de estoque) | Ofertas → criar e encerrar | ✅ |
| Compra com retirada em loja parceira | Perfil Comprador → Ofertas / Produtores → Comprar → Checkout | ✅ |

> O front-end tem dois modos: **demo** (dados fictícios no navegador, sem configuração) e **conectado** (lê do Supabase e grava pela API em TypeScript), ligado pelas variáveis de `frontend/.env.example` ([guia do back-end](docs/BACKEND.md)).

## Estrutura (monorepo pnpm)

| Pasta | Conteúdo | Status |
|---|---|---|
| [`packages/dominio/`](packages/dominio/) | `@hortilink/dominio`: regras de negócio puras em TypeScript estrito, usadas pelo front e pelo back | ✅ 44 testes |
| [`packages/banco/`](packages/banco/) | `@hortilink/banco`: tradução pura entre as tabelas do Supabase e o estado do domínio (front e back) | ✅ 8 testes |
| [`frontend/`](frontend/) | Interface web (React 19 + Vite), em camadas de Clean Architecture | ✅ modo demo (dados fictícios) · ✅ modo conectado (Supabase + API) |
| [`backend/`](backend/) | API em TypeScript (Fastify), em camadas de Clean Architecture | ✅ rotas de escrita com login, testada no Supabase real |
| [`supabase/`](supabase/) | Migrations SQL (tabelas, RLS e permissões), auditoria e seed fictício | ✅ aplicado no projeto Supabase |
| [`tests/`](tests/) | Teste ponta a ponta com o Supabase real (`pnpm test:e2e`) | ✅ |
| [`docs/`](docs/) | [Arquitetura](docs/ARQUITETURA.md), [contrato do back-end](docs/BACKEND.md) e tutorial em vídeo/áudio | ✅ |
| `.vscode/` | Tarefas, depuração e extensões recomendadas ([como usar](#rodar-no-vs-code)) | ✅ |
| `.github/` | CI (lint, tipos, testes e build a cada push/PR) e Dependabot (dependências e Actions) | ✅ |

## Como rodar

Pré-requisitos: Node 22+ e pnpm 10 (`npm i -g pnpm`, ou use `npx --yes pnpm@10.34.3` no lugar de `pnpm`).

```bash
pnpm install
pnpm dev      # front-end em http://localhost:5173 e API em http://localhost:3333
pnpm check    # lint + tipos + testes + build de todos os pacotes
```

Para o modo conectado, copie `frontend/.env.example` → `frontend/.env` e `backend/.env.example` → `backend/.env` e preencha (os `.env` não vão para o git; a `service_role` fica **só** no `backend/.env`).

Contas de demonstração (senha `123456`, **só para teste**: não aplique o `supabase/seed.sql` num projeto em produção): `produtor@hortilink.com`, `comprador@hortilink.com`, `loja@hortilink.com`. Mais detalhes em [`frontend/README.md`](frontend/README.md) e [`backend/README.md`](backend/README.md).

### Rodar no VS Code

1. **File → Open Folder…** e abra a pasta `HortiControl` (a raiz, não `frontend/`). Aceite instalar as **extensões recomendadas** quando o VS Code oferecer.
2. **Terminal → Run Task…** e escolha:
   - **1. Instalar dependências** (só na primeira vez ou quando o `pnpm-lock.yaml` mudar);
   - **2. Rodar modo demo (sem banco)**: abre o site em http://localhost:5173 com dados de exemplo;
   - **3. Rodar conectado (API + site + Supabase)**: precisa dos dois `.env` preenchidos;
   - **4. Verificar tudo**: o mesmo `pnpm check` do CI (também em **Terminal → Run Test Task**);
   - **5. Teste ponta a ponta no Supabase real**: com a tarefa 3 rodando.
3. Para **depurar** (parar em breakpoints): **Run and Debug** (Ctrl+Shift+D), escolha a configuração e aperte **F5**:
   - *Demo no Chrome* ou *Conectado no Chrome*: sobe o site e abre o Chrome ligado ao VS Code;
   - *Depurar a API*: breakpoints no `backend/src` (feche a tarefa 3 antes, para não brigar pela porta 3333).
4. Para parar: clique no ícone de lixeira do terminal da tarefa (ou **Ctrl+C** nele).

## Segurança

- [Política de segurança](SECURITY.md): como relatar falhas e as regras do projeto.
- [Sprint 3: correções da banca](docs/SPRINT-3.md) · [Histórico de versões](CHANGELOG.md) · [OWASP Top 10](docs/OWASP-TOP10.md) · [Manutenção](docs/MANUTENCAO.md) · [Testes de usabilidade](docs/TESTES-USABILIDADE.md) · [Roteiro da apresentação](docs/APRESENTACAO.md)

- [Auditoria de segurança](docs/AUDITORIA-SEGURANCA.md) do código (autenticação, autorização, injeções, API) e do banco Supabase (RLS e políticas).
- Escritas só pela API, que confere login, perfil e dono; o cliente só **lê** do banco, protegido por RLS em todas as tabelas.
- Segredos fora do git (`.env*` no `.gitignore`); o front só recebe variáveis públicas `VITE_*`.
- **Dependabot** ([`.github/dependabot.yml`](.github/dependabot.yml)) abre PRs semanais de atualização das dependências npm/pnpm e das GitHub Actions. Os alertas e as atualizações de segurança são ligados em *Settings → Code security* do repositório.

## Fluxo de trabalho

1. Uma branch por tarefa (`feat/...`, `fix/...`, `docs/...`).
2. Commits pequenos no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat(backend): ...`).
3. Pull Request com descrição e checklist; merge só com o CI verde e depois de revisão (checklist próprio + revisão de código automatizada).

## Equipe

- Yara — Scrum Master e organização do projeto.
- Bruna — Desenvolvedora Front-end.
- Laura — Desenvolvedora Back-end.

## Metodologia

Desenvolvimento organizado em três Sprints, utilizando Scrum e Kanban.

## Informações acadêmicas

- Universidade: Universidade de Mogi das Cruzes (UMC).
- Curso: Engenharia de Software.
- Disciplina: Métodos Ágeis.
- Projeto: M2 — 2026.02.
