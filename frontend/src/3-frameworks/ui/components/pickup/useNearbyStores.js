import { useState } from "react";

export const RAIOS_KM = ["5", "10", "20", "Todos"];

const normalizar = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Filtra lojas por texto (nome, endereço ou cidade, sem diferenciar acentos) e por
 * raio, e ordena da mais próxima para a mais distante.
 *
 * PROD-05: o banco oficial não guarda a distância. Antes, loja sem distância recebia
 * 24,5 km e o raio padrão (10 km) escondia TODAS. Agora loja sem distância conhecida
 * nunca é cortada pelo raio (vai para o fim da lista) e o raio padrão é "Todos".
 */
export function useNearbyStores(stores) {
  const [search, setSearch] = useState("");
  const [radius, setRadius] = useState("Todos");
  const termo = normalizar(search);
  const visibleStores = stores
    .map((store) => ({ ...store, distance: store.distanceKm }))
    .filter(
      (store) =>
        (!termo || normalizar(`${store.name} ${store.address} ${store.city}`).includes(termo)) &&
        (radius === "Todos" || store.distance == null || store.distance <= Number(radius)),
    )
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  return { search, setSearch, radius, setRadius, visibleStores };
}
