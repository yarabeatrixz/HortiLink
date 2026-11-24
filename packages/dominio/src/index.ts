// API pública do domínio do HortiLink: regras puras, sem React, banco ou rede.
// Usado pelo front-end (experiência do usuário) e pelo back-end (fonte da verdade).

export * from "./constantes";
export * from "./tipos";
export * from "./formatacao";
export { novoId } from "./util";
export * from "./usuarios";
export * from "./produtos";
export * from "./ofertas";
export type { DadosCompra } from "./compra";
export * from "./pedidos";
export * from "./propostas";
export * from "./lojas";
export * from "./recompensas";
export * from "./estoque";
export * from "./despesas";
export * from "./indicadores";
