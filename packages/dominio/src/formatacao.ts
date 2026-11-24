// Conversões e formatos em pt-BR usados pelas regras e pelas telas.

import type { DataIso, Numerico } from "./tipos";

export const brl = (valor: Numerico | null | undefined): string =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Converte "1.234,5" / "1234.5" / 12 em número; inválido vira 0. */
export const num = (valor: Numerico | null | undefined): number => {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor ?? "").trim();
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const resultado = Number(normalizado);
  return Number.isFinite(resultado) ? resultado : 0;
};

export const dataCurta = (iso: DataIso | number): string => new Date(iso).toLocaleDateString("pt-BR");

export const dataHora = (iso: DataIso | number): string => new Date(iso).toLocaleString("pt-BR");

export const km = (distancia: number | null | undefined): string =>
  distancia == null ? "Distância não informada" : `${String(distancia).replace(".", ",")} km`;

export const inicial = (nome: string | undefined): string => nome?.charAt(0) ?? "";
