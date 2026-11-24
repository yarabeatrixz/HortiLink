// Listas fixas e enums do domínio. Os valores (strings) são gravados no banco,
// então front, back e banco usam exatamente os mesmos.

export const PERFIS = [
  { id: "produtor", nome: "Produtor" },
  { id: "comprador", nome: "Comprador" },
  { id: "loja", nome: "Loja parceira" },
  { id: "admin", nome: "Administrador" },
] as const;

export type Perfil = (typeof PERFIS)[number]["id"];

/**
 * Perfis que qualquer pessoa pode escolher no cadastro. O administrador NÃO entra:
 * a conta é promovida no banco pela equipe (supabase/migrations/0004_sprint2_admin.sql).
 */
export const PERFIS_CADASTRO = PERFIS.filter((perfil) => perfil.id !== "admin");

export const nomePerfil = (perfil: Perfil): string =>
  PERFIS.find((item) => item.id === perfil)?.nome ?? perfil;

export const CATEGORIAS = [
  "Frutas",
  "Verduras",
  "Legumes",
  "Raízes",
  "Grãos",
  "Temperos",
  "Laticínios",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const UNIDADES = [
  "kg",
  "g",
  "t",
  "L",
  "mL",
  "un",
  "mç",
  "dz",
  "cx",
  "sc",
  "saco",
  "bdj",
  "cumb",
  "eng",
  "pct",
  "fd",
  "pt",
  "pç",
  "tb",
  "lt",
  "bag",
] as const;

export type Unidade = (typeof UNIDADES)[number];

export const STATUS_OFERTA = {
  ATIVA: "Ativa",
  ESGOTADA: "Esgotada",
  ENCERRADA: "Encerrada",
} as const;

export type StatusOferta = (typeof STATUS_OFERTA)[keyof typeof STATUS_OFERTA];

export const STATUS_PROPOSTA = {
  AGUARDANDO: "Aguardando fornecedor",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
} as const;

export type StatusProposta = (typeof STATUS_PROPOSTA)[keyof typeof STATUS_PROPOSTA];

/** Situação do ponto de coleta, decidida pelo administrador (US14). */
export const STATUS_LOJA = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REPROVADA: "Reprovada",
  SUSPENSA: "Suspensa",
} as const;

export type StatusLoja = (typeof STATUS_LOJA)[keyof typeof STATUS_LOJA];

export const STATUS_PEDIDO = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago",
  ENTREGUE_NA_LOJA: "Entregue na loja",
  PRONTO_PARA_RETIRADA: "Pronto para retirada",
  RETIRADO: "Retirado",
  CANCELADO: "Cancelado",
} as const;

export type StatusPedido = (typeof STATUS_PEDIDO)[keyof typeof STATUS_PEDIDO];

/** Rótulos gravados em `pedido.timeline[].label`. */
export const EVENTO_PEDIDO = {
  REALIZADO: "Pedido realizado",
  PROPOSTA_ACEITA: "Proposta aceita",
  PAGAMENTO_APROVADO: "Pagamento aprovado",
  ENTREGUE_NA_LOJA: "Produto entregue na loja",
  PRONTO_PARA_RETIRADA: "Pronto para retirada",
  RETIRADO: "Retirado",
} as const;

export type EventoPedido = (typeof EVENTO_PEDIDO)[keyof typeof EVENTO_PEDIDO];

export const METODO_PAGAMENTO = {
  PIX: "Pix",
  CARTAO: "Cartão de crédito",
} as const;

export type MetodoPagamento = (typeof METODO_PAGAMENTO)[keyof typeof METODO_PAGAMENTO];

/** De onde vem uma compra ou proposta: de uma oferta ou direto do catálogo. */
export const ORIGEM = {
  OFERTA: "offer",
  CATALOGO: "product",
} as const;

export type Origem = (typeof ORIGEM)[keyof typeof ORIGEM];

export const SENHA_MINIMA = 8;

/** Foto do produto: formatos aceitos e tamanho máximo do arquivo (1 MB). */
export const FORMATOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export const TAMANHO_MAXIMO_FOTO = 1024 * 1024;

// ------------------------------------------------- Estoque e financeiro

export const TIPO_MOVIMENTO = {
  ENTRADA: "Entrada",
  PERDA: "Perda",
} as const;

export type TipoMovimento = (typeof TIPO_MOVIMENTO)[keyof typeof TIPO_MOVIMENTO];

export const MOTIVOS_PERDA = [
  "Estragou / passou do ponto",
  "Avaria no transporte",
  "Pragas ou clima",
  "Sobra não vendida",
  "Outro",
] as const;

export type MotivoPerda = (typeof MOTIVOS_PERDA)[number];

export const STATUS_ESTOQUE = {
  OK: "Estoque ok",
  BAIXO: "Estoque baixo",
  ZERADO: "Sem estoque",
} as const;

export type StatusEstoque = (typeof STATUS_ESTOQUE)[keyof typeof STATUS_ESTOQUE];

/** Custo = gasto do dia a dia (adubo, frete, embalagem); investimento = bem durável. */
export const TIPO_DESPESA = {
  CUSTO: "Custo",
  INVESTIMENTO: "Investimento",
} as const;

export type TipoDespesa = (typeof TIPO_DESPESA)[keyof typeof TIPO_DESPESA];
