# Sprint 2: o que mudou e como publicar

Itens do relatório de inconsistências (`HortiLink_Relatorio_Inconsistencias.pdf`, 18/11) e do replanejamento de 19/11.

## Correções do relatório de inconsistências

| ID | Causa | Correção |
|---|---|---|
| COMP-01 | RLS da tabela `users`: cada usuário só via a si mesmo | migration `0004` libera `id, role, name, city` para usuários logados (sem e-mail); o catálogo também não some se o perfil não vier |
| PROD-05 | loja sem distância recebia 24,5 km e o raio padrão (10 km) escondia todas | loja sem distância não é cortada pelo raio; raio padrão "Todos"; busca por cidade sem acento |
| LOJA-02 | a tela sempre abria o formulário | "Meu ponto" mostra o ponto cadastrado, a situação e o botão Editar; índice único `stores(user_id)` no banco |
| LOJA-01 | não havia campo de foto | foto do ponto (JPG/PNG/WebP até 1 MB) |
| PROD-01 | cada gravação relê o banco (e o Render grátis é lento) | aviso "Salvando…" no topo e no botão |
| PROD-03 | botão aceitava cliques durante a gravação | botões de envio travam; uma gravação por vez |
| PROD-04 | regra marcava baixo com quantidade **igual** ao mínimo | baixo só **abaixo** do mínimo |
| PROD-02 | exclusão só de um em um | seleção múltipla + `POST /products/delete` |
| GER-01 | não havia configurações de perfil | aba "Meu perfil" (nome, cidade, senha) em todos os perfis |

## Novidades

- **Administrador** (US14, US15, US16): aprova, reprova ou suspende pontos de coleta (com motivo), vê a capacidade e a ocupação, define a recompensa (valor fixo + % por pedido retirado), vê o extrato de cada loja e fecha o mês.
- **Retirada com código** (US10): produtor marca "entregue na loja" → loja libera → comprador vê o código de 6 dígitos no acompanhamento → loja digita o código → pedido "Retirado". O código não fica no banco: é calculado pela API com um segredo.
- **Loja**: aba Recompensas com o extrato do mês.
- Só lojas **aprovadas** aparecem para o produtor; loja **lotada** some da compra.

## Como publicar (ordem importa)

1. **Banco (Supabase da Yara)** → SQL Editor → colar e rodar [`supabase/banco-oficial/0004_sprint2.sql`](../supabase/banco-oficial/0004_sprint2.sql). Pode rodar de novo sem problema.
2. **Criar o administrador**: cadastrar a pessoa no site (perfil comprador, por exemplo) e rodar no SQL Editor, trocando o e-mail:
   ```sql
   update public.users set role = 'admin' where email = 'EMAIL_DO_ADMIN';
   ```
   Depois ela entra escolhendo o perfil **Administrador**.
3. **API no Render** (opcional): variável `CODIGO_RETIRADA_SEGREDO` com um texto longo aleatório. Sem ela a API usa a chave secreta do Supabase.
4. Fazer o merge do PR e clicar em **Manual Deploy** nos dois serviços do Render (API e site).
5. Testar no link publicado (DoD): login das 4 contas, comprador vendo os produtores (COMP-01), busca de pontos (PROD-05) e o fluxo de retirada.

> ⚠️ Rode o passo 1 **antes** do deploy. Sem a migration o site abre (lojas antigas contam como aprovadas), mas a API grava colunas novas em `stores` e `orders`: comprar, pagar, salvar loja e retirar dão erro até a migration rodar.
