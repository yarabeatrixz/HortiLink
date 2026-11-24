# Auditoria de segurança — 15/11/2026

Escopo: monorepo inteiro na branch `feat/front-api-fase-4`, mais o banco Supabase (migration, seed e as skills `Skills/supabase` do Obsidian) (`packages/dominio`, `packages/banco`, `backend/`, `frontend/`, `supabase/`).
Método: leitura do código e da migration, busca por APIs de risco e `pnpm audit` (nenhuma vulnerabilidade conhecida nas dependências).
Esta auditoria **só diagnostica**: não altera código nem propõe correções.

O sistema tem três modos de execução, e alguns achados dependem do modo:
- **Front demo**: tudo no `localStorage`, sem servidor.
- **API demo**: sem Supabase no `.env`; dados em memória e login `Bearer demo:<id>`.
- **Conectado**: o front lê do Supabase com a anon key (RLS), grava pela API, e a API usa a `service_role`.

## Resumo

| # | Item | Status | Gravidade | Confiança |
|---|---|---|---|---|
| 1 | Bypass de autenticação | **Presente** (condicional) | Alta, se ocorrer | Alta |
| 2 | Senhas fracas / tratamento de senha | **Presente** (modo demo e política) | Média | Alta |
| 3 | Autorização ausente ou falha | **Presente** (lógica de negócio) | Média | Média |
| 4 | XSS (CWE-80) | Não detectado | — | Alta |
| 5 | SQL Injection (CWE-89) | Não detectado | — | Alta |
| 6 | Command Injection (CWE-78) | Não detectado | — | Alta |
| 7 | Code Injection (CWE-94) | Não detectado | — | Alta |
| — | CSRF | Não detectado | — | Alta |
| — | Programação defensiva e erros | **Presente** (concorrência) | Média | Alta |
| — | Criptografia e aleatoriedade | **Presente** (seed previsível) | Baixa | Alta |
| — | Upload de arquivo | **Presente** (validação fraca) | Baixa | Alta |
| — | Segurança da API (limites) | **Presente** | Média | Média |

---

## 1. Bypass de autenticação — **Presente (condicional)**

### 1a. Login falso da API demo fora de produção
- **Onde:** `backend/src/3-frameworks/config/ambiente.ts` (`lerAmbiente`), `backend/src/composition.ts` (`escolherAdapters`), `backend/src/2-adapters/memoria/verificadorDemo.ts`.
- **Vetor:** sem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, a API entra no modo demo e aceita qualquer `Authorization: Bearer demo:<id>` como o usuário `<id>`. A trava existe só quando `NODE_ENV=production`. Uma hospedagem que não define `NODE_ENV` (ou usa outro valor, como `staging`) sobe a API no modo demo, acessível de fora. Por padrão o `HOST` é `0.0.0.0`, então na rede local qualquer máquina alcança a API de desenvolvimento.
- **Impacto:** quem conhece um id (os do exemplo são fixos, por exemplo `user-produtor`) age como qualquer usuário. Ficam expostos os dados em memória da instância; o banco real não é afetado, porque o modo demo não o usa.
- **Confiança:** Alta (o comportamento é intencional e documentado; o risco é de configuração).

### 1b. Contas de exemplo com senha conhecida no `seed.sql`
- **Onde:** `supabase/seed.sql` (gerado por `backend/src/2-adapters/supabase/seedSql.ts`, `SENHA_DEMONSTRACAO`).
- **Vetor:** o seed cria em `auth.users` cinco contas já confirmadas (`produtor@`, `comprador@`, `loja@`, `carlos@`, `loja-demo-2@hortilink.com`) com a senha `123456`, escrita no próprio arquivo e no README. Se o seed for aplicado ao projeto Supabase usado de verdade, qualquer pessoa entra nessas contas pelo login normal.
- **Impacto:** acesso completo aos perfis de exemplo (produtor, comprador, loja). Pela API dá para criar ofertas, comprar, "pagar" e editar a loja dessas contas, e pelo RLS dá para ler os pedidos, o estoque e os custos delas.
- **Confiança:** Alta (o efeito depende de o seed ser aplicado fora do ambiente de teste).

### 1c. Front demo confia no estado do cliente
- **Onde:** `frontend/src/2-adapters/localStorageRepository.js` (chave de sessão `hortilink:session:web:v2`), `packages/dominio/src/usuarios.ts` (`autenticar`).
- **Vetor:** no modo demo, a sessão é só o id do usuário no `localStorage`. Editar esse valor troca de usuário sem senha.
- **Impacto:** nenhum dado de servidor fica exposto (tudo está no próprio navegador). É do desenho do modo demo e não vale como segurança.
- **Confiança:** Alta.

### Fluxos verificados sem falha
- Modo conectado: o token é validado pelo Supabase Auth em cada requisição (`verificadorSupabase.ts`, `auth.getUser(token)`), e o hook `onRequest` de `autenticacao.ts` roda antes da validação do corpo em todas as rotas de escrita. A única rota pública é `GET /saude`.
- Não há fluxo de redefinição de senha nem OAuth no código (não avaliados).
- A configuração do Supabase Auth (confirmação de e-mail, tamanho mínimo de senha, proteção contra senhas vazadas, limites de tentativa) fica no painel, fora do repositório: **inconclusivo**.

## 2. Tratamento de senha fraco — **Presente (modo demo e política)**
- **Onde:** `packages/dominio/src/usuarios.ts` (`cadastrarUsuario` guarda `password` em texto puro; `autenticar` compara texto puro), `frontend/src/2-adapters/localStorageRepository.js`, `packages/dominio/src/constantes.ts` (`SENHA_MINIMA`).
- **Vetor:** no front demo, as senhas cadastradas ficam em texto puro no `localStorage` (chave `hortilink:data:web:v6`), legíveis por qualquer script da origem ou por quem usar o mesmo navegador. A política mínima é de 6 caracteres, sem outra exigência, nos dois modos.
- **Impacto:** no demo, quem reaproveitar uma senha real a expõe no navegador. No modo conectado, senhas curtas facilitam a adivinhação (força bruta), dependendo dos limites do Supabase.
- **Modo conectado:** a senha vai direto do navegador ao Supabase Auth (bcrypt, com sal, gerenciado pelo Supabase) e nunca passa pela API. O seed usa `crypt(..., gen_salt('bf'))`. Nada a apontar além da política e do item 1b.
- **Confiança:** Alta.

## 3. Autorização ausente ou falha — **Presente (lógica de negócio)**

Toda escrita passa pelos casos de uso de `backend/src/1-application/casosDeUso.ts`, que conferem o perfil (`exigirPerfil`) e o dono (`doUsuario`) no servidor. O RLS (`supabase/migrations/0001_schema.sql`) libera ao cliente só `SELECT`, sem nenhum grant de escrita. Pedidos, linha do tempo, propostas, estoque e despesas são filtrados por envolvido ou dono, e `profiles.email` não é liberado ao cliente. **Nenhum IDOR direto foi encontrado** nas rotas: produto, oferta, despesa e pedido conferem o dono antes da regra.

Pontos presentes:
- **3a. Perfil escolhido pelo próprio usuário no cadastro.** O gatilho `criar_perfil_do_usuario` lê o `role` de `raw_user_meta_data`, que o cliente define no `signUp` (`frontend/src/2-adapters/supabaseAutenticacao.js`). Qualquer pessoa pode se cadastrar como **loja parceira** ou **produtor** sem verificação. Impacto: lojas falsas passam a aparecer na lista de pontos de retirada que os produtores escolhem e recebem a visibilidade dos pedidos retirados nelas; produtores falsos publicam ofertas. Confiança: Alta (é do desenho atual).
- **3b. Pagamento simulado.** `POST /orders/:id/pay` (`pagarPedido`) muda o pedido para pago só com o método no corpo, sem prova de pagamento. O comprador marca as próprias compras como pagas. Impacto: o produtor vê o pedido como pago e pode entregar sem ter recebido. Confiança: Alta (documentado como simulado).
- **3c. Pontos de retirada da oferta não conferidos.** `criarOferta` (`packages/dominio/src/ofertas.ts`) exige só `storeIds.length > 0`, sem conferir se as lojas existem ou se são pontos do produtor. Impacto: oferta ligada a uma loja qualquer, ou a um id inexistente, que no Supabase vira erro 500 por chave estrangeira. Confiança: Média.
- **3d. Enumeração por resposta.** `doUsuario` responde 404 para o id inexistente e 403 para o que é de outro usuário, o que revela se o id existe. Os ids são UUID aleatórios, então o efeito prático é pequeno. Confiança: Alta.

## 4. XSS (CWE-80) — **Não detectado**
- **Onde foi olhado:** todas as telas em `frontend/src/3-frameworks/ui`.
- Não há `dangerouslySetInnerHTML`, `innerHTML`, `eval` nem `href` montado com dado do usuário. Textos do usuário (nomes, cidades, descrições, endereço da loja) são renderizados como texto pelo React, com escape automático.
- `ProductImage` usa `photo` (dado do produtor) só em `<img src>`. Um `javascript:` não executa em `<img>`, e SVG em `data:` dentro de `<img>` não roda script. Ainda assim, uma URL externa em `photo_url` faz o navegador de quem vê o catálogo buscar um servidor de terceiros (vazamento de IP e rastreio). Isso não é XSS.
- Observação de contexto: não há Content-Security-Policy em `frontend/index.html`, e o `supabase-js` guarda a sessão no `localStorage`. Se algum XSS surgir no futuro, o token fica legível pelo script.
- **Confiança:** Alta.

## 5. SQL Injection (CWE-89) — **Não detectado**
- **Em tempo de execução:** API e front usam só o construtor de consultas do `supabase-js` (`from().select/upsert/delete().match/eq`), que vira requisição PostgREST parametrizada. Não há `rpc` nem SQL montado com entrada do usuário.
- **SQL bruto encontrado:** `backend/src/2-adapters/supabase/seedSql.ts` monta SQL por concatenação, escapando aspas simples (`texto()`). A entrada são os dados fixos de exemplo do domínio, não dado do usuário, e o arquivo só roda por script de desenvolvimento.
- A migration usa `set search_path = ''` na função `security definer` e revoga o `execute` de `anon`/`authenticated`.
- **Confiança:** Alta.

## 6. Command Injection (CWE-78) — **Não detectado**
Não há `child_process`, `exec`, `spawn` nem shell no código da aplicação. **Confiança:** Alta.

## 7. Code Injection (CWE-94) — **Não detectado**
Não há `eval`, `new Function`, `import()` com caminho variável nem templates executáveis. A configuração vem só de variáveis de ambiente lidas como texto. **Confiança:** Alta.

## CSRF — **Não detectado**
A API autentica só pelo cabeçalho `Authorization: Bearer`, sem cookie de sessão, então um site de terceiros não consegue mandar requisições autenticadas em nome do usuário. O CORS (`servidor.ts`) libera só as origens listadas em `FRONTEND_ORIGIN` (uma por versão publicada do site; endereço inválido impede a API de subir). **Confiança:** Alta.

## Programação defensiva e tratamento de erros — **Presente (concorrência)**
- **Corrida de dados / sem transação.** `executar` em `casosDeUso.ts` carrega o estado inteiro, aplica a regra e grava as diferenças (`repositorioSupabase.ts`, `calcularOperacoes`), sem transação nem trava. Duas compras simultâneas leem o mesmo estoque e gravam por cima uma da outra, o que permite vender acima do estoque (perda de atualização). Os passos de um salvamento também não são atômicos: uma falha no meio deixa o banco pela metade. O número do pedido é calculado na API, e duas compras ao mesmo tempo podem gerar o mesmo número (o `unique` do banco recusa a segunda com erro 500). **Confiança:** Alta (limite já documentado em `docs/BACKEND.md`).
- **Erros:** o tratador global (`servidor.ts`) responde `{ error }` sem pilha nem detalhe interno; falhas do Supabase viram 500 genérico e só aparecem no log. Erro de validação não ecoa o corpo. Sem achado.
- **Números:** `num()` (`packages/dominio/src/formatacao.ts`) converte entrada inválida em 0, e as regras recusam valor ≤ 0. Sem achado.

## Criptografia e aleatoriedade — **Presente (baixo)**
- Os ids novos usam `crypto.randomUUID()` (`packages/dominio/src/util.ts`). Adequado.
- O seed gera UUIDs **determinísticos** (`md5('user-produtor')::uuid`). Os ids das contas e registros de exemplo são previsíveis, o que importa junto com o item 1b e com o login demo (1a).
- O número do pedido (`#HL-000001`) é sequencial e previsível, mas não é usado para dar acesso.
- **Confiança:** Alta.

## Upload de arquivos — **Presente (validação fraca)**
- **Onde:** `frontend/src/3-frameworks/ui/screens/produtor/ProductForm.jsx` (`FileReader.readAsDataURL`, `accept="image/*"`), campo `photo` em `backend/src/2-adapters/http/esquemas.ts` (texto livre), coluna `products.photo_url`.
- **Vetor:** o tipo e o tamanho da imagem só são restringidos no navegador. Pela API, `photo` aceita qualquer texto (outro `data:` com outro tipo ou uma URL externa) até o limite padrão de corpo do Fastify (1 MiB por requisição), e o valor vai inteiro para o banco.
- **Impacto:** o banco e as leituras do front incham, porque cada carga lê todas as fotos em base64, e há o rastreio por URL externa (item 4). Nenhuma execução de código foi identificada.
- **Confiança:** Alta.

## Segurança da API — **Presente**
- **Sem limite de taxa** (nenhum rate limit nas rotas). Como cada escrita lê **todas** as tabelas antes de gravar, um usuário logado consegue gerar muita carga no banco com poucas requisições (amplificação de negação de serviço). **Confiança:** Média.
- **Sem limite de tamanho nos textos** (`name`, `description`, `note`, `address`, `photo`): só o limite global de corpo. **Confiança:** Alta.
- **Leitura completa no front:** `supabaseLeitura.js` lê todas as linhas que o RLS libera, sem paginação. O catálogo inteiro e todas as ofertas vão para cada usuário logado. É o que o RLS permite por desenho, então não vaza dado de outros usuários além do previsto. **Confiança:** Alta.
- Positivos: corpo validado por esquema com `additionalProperties: false` (campos a mais são recusados), dono sempre vindo do token e nunca do corpo, CORS restrito, `service_role` só no back-end (`.env` ignorado pelo git; o front só lê variáveis `VITE_*`).

## Banco Supabase (skills do Obsidian `Skills/supabase`)

Auditoria **estática** de `supabase/migrations/0001_schema.sql` e `supabase/seed.sql`, seção por seção da skill `full-security-audit`. O projeto Supabase ainda não tinha sido criado. O mesmo roteiro, somente leitura, está em `supabase/auditoria/auditoria-completa.sql`, para rodar no SQL Editor e confirmar no banco real (o resultado esperado de cada seção está no cabeçalho do arquivo).

| Seção (skill) | Status | Evidência | Confiança |
|---|---|---|---|
| 1. Tabelas sem RLS (`audit-rls`) | Não detectado | As 11 tabelas com `enable` + `force row level security` | Alta |
| 2. RLS sem policy (`audit-rls`) | Não detectado | Toda tabela tem uma policy `for select to authenticated` | Alta |
| 3. Policies de escrita permissivas (`audit-policies`) | Não detectado | Não há policy de INSERT/UPDATE/DELETE; `revoke all` de `anon`/`authenticated` e só `grant select` | Alta |
| 4. Colunas sensíveis (`audit-sensitive-columns`) | Não detectado | Nenhuma coluna de senha/token em `public`; `profiles.email` (PII) fica fora do grant por coluna (`id, role, name, city`); a senha só existe no `auth.users` | Alta |
| 5. Permissões de `anon` (`audit-api-exposure`) | Não detectado | `revoke all on all tables/sequences ... from anon`; nenhum `grant` a `anon` | Alta |
| 6–7. Funções e SECURITY DEFINER (`audit-rpc-functions`) | Não detectado | Só `criar_perfil_do_usuario`: `security definer` com `search_path = ''` e `execute` revogado de `public`, `anon` e `authenticated` | Alta |
| 8–9. Storage (`audit-storage`) | Inconclusivo | Nenhum bucket nas migrations; as fotos vão em base64 na coluna `photo_url` (ver "Upload de arquivos"). Conferir no projeto real | Média |
| 10. Realtime (`audit-realtime`) | Não detectado (estático) | Nenhuma tabela adicionada à publicação `supabase_realtime`; conferir no painel | Média |
| 12. Auth (`audit-auth`) | **Presente** | Ver abaixo | Alta |
| API: privilégios padrão de objetos futuros | **Presente** (risco futuro) | Ver abaixo | Alta |

### Auth — **Presente**
- **Seed com senha conhecida**: `seed.sql` insere cinco usuários em `auth.users` já **confirmados** (`email_confirmed_at = now()`), com `crypt('123456', gen_salt('bf'))`. O hash é bcrypt (adequado), mas a senha é pública. Em qualquer projeto onde o seed for aplicado, essas contas ficam abertas a quem ler o repositório (item 1b). A seção 17 do script lista essas contas.
- **Perfil escolhido pelo cliente**: o gatilho `criar_perfil_do_usuario` converte `raw_user_meta_data ->> 'role'` em `public.perfil`. O cliente controla esses metadados no `signUp`, então escolhe ser `loja` ou `produtor` (item 3a). Mudanças posteriores de metadados (`updateUser`) **não** alteram o perfil, porque o gatilho só roda no `insert`.
- **Inconclusivo (painel, fora do repositório):** confirmação de e-mail, tamanho mínimo de senha, proteção contra senhas vazadas, MFA, limites de tentativa e hooks de Auth.
- `service_role`: não aparece no front (`frontend/src`, `index.html`, `vite.config.js`), só em `backend/.env.example` (vazia) e na documentação.

### Privilégios padrão para tabelas futuras — **Presente (risco futuro)**
- **Onde:** `0001_schema.sql` revoga os privilégios das tabelas que **já existem** (`revoke all on all tables in schema public`), mas não altera os privilégios padrão (`alter default privileges`).
- **Vetor:** no Supabase, uma tabela nova criada em `public` recebe por padrão todos os privilégios para `anon` e `authenticated`. Uma migration futura que esqueça `enable row level security` deixa essa tabela legível **e gravável** pela REST API com a anon key, que fica pública no front. A seção 16 do script mostra esses privilégios padrão.
- **Impacto:** leitura e escrita sem login na tabela nova.
- **Confiança:** Alta. O risco só aparece em migrations futuras; o `supabase/README.md` já alerta, mas nada no banco impede.

### Outras observações do esquema
- Colunas de texto sem limite de tamanho (`name`, `description`, `address`, `note`, `photo_url`): só os `check` de texto não vazio. **Confiança:** Alta.
- `order_events` herda o filtro de `orders` por subconsulta, e o RLS de `orders` vale dentro da subconsulta. Correto.
- `profiles` é legível por qualquer usuário logado (`using (true)`), limitado às colunas `id, role, name, city`. Os dados de todos os perfis (nome, cidade, papel) ficam listáveis. Aceito por desenho (catálogos públicos para quem está logado).

## Correções aplicadas (16/11/2026)

A primeira parte deste documento é o diagnóstico; depois dele vieram as correções abaixo (commit `8562e8a` e seguintes, PR #3). A conferência foi feita no banco real (projeto `hortilink`, região São Paulo) com a consulta somente leitura das skills.

| Achado | Correção | Onde |
|---|---|---|
| 1a. Login falso da API demo | O modo demo só sobe em `127.0.0.1`/`localhost` (o `HOST` padrão passou a ser local) e nunca com `NODE_ENV=production` | `backend/src/3-frameworks/config/ambiente.ts` |
| 1b. Seed com senha pública | Não aplicado no projeto real; aviso no README e na política de segurança | `README.md`, `SECURITY.md` |
| 2. Senha fraca | Mínimo de 8 caracteres no domínio e no Supabase Auth | `packages/dominio/src/constantes.ts`, painel do Auth |
| 3c. Oferta com ponto de retirada inexistente | 404 "Ponto de retirada não encontrado" | `backend/src/1-application/casosDeUso.ts` |
| Upload sem validação | Foto só JPG/PNG/WebP até 1 MB (tela), formato `data:image/…` ou `https://` (API e banco) | `validarArquivoDeFoto`, `esquemas.ts`, `0002_endurecimento.sql` |
| API sem limites | Limite de corpo de 1,5 MB, `maxLength` nos textos, 120 requisições/min por IP (429), cabeçalhos de segurança (helmet) | `backend/src/3-frameworks/http/servidor.ts`, `esquemas.ts` |
| Privilégios padrão de tabelas futuras | `alter default privileges … revoke`; projeto criado com "expor novas tabelas" **desligado** e RLS automático **ligado** | `0002_endurecimento.sql`, painel do Supabase |
| Textos sem limite no banco | `check (length(...) <= N)` | `0002_endurecimento.sql` |
| Chave errada no lugar errado | O front recusa chave secreta; a API recusa a chave publicável como secreta | `frontend/src/configRemota.js`, `ambiente.ts` |
| Sem CSP | Content-Security-Policy no build (scripts só do próprio site, conexões só com a API e o Supabase) | `frontend/src/politicaDeConteudo.js`, `vite.config.js` |
| (bug) upsert da linha do tempo sem chave única | Índice único `(order_id, label, at)` | `0002_endurecimento.sql` |
| (bug) API sem permissão nas tabelas: com "expor novas tabelas" desligado, o Supabase não concede nada nem à `service_role` | `grant` explícito de `SELECT/INSERT/UPDATE/DELETE` só para `service_role` (cliente continua só com `SELECT`) | `0003_grants_service_role.sql` |

**Teste ponta a ponta no banco real (16/11/2026, após a 0003):** 3 contas de teste (loja, produtor, comprador) criaram ponto, produto, oferta, pedido, pagamento e entrega pela API; sem login → 401, papel errado → 403, escrita direta no Supabase com token de usuário → 403. Contas e dados apagados no fim.

**Conferência no banco real (após a 0001):** tabelas sem RLS: 0 · sem `force`: 0 · policies de escrita: 0 · grants para `anon`: 0 · `authenticated`: só `SELECT` · `profiles`: colunas `id, role, name, city` · buckets: 0 · Realtime: 0 tabelas · usuários: 0.

**Continuam abertos (aceitos e documentados):** escritas sem transação, pagamento simulado, perfil escolhido no cadastro e logs/alertas de segurança (OWASP A09). Ver [OWASP-TOP10.md](OWASP-TOP10.md).

## Dependências
`pnpm audit` em 15/11/2026: **nenhuma vulnerabilidade conhecida**. O monitoramento contínuo passa a ser feito pelo Dependabot (`.github/dependabot.yml`).
