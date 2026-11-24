// Adapter FAKE da porta `RepositorioPort` (ver 1-application/ports.js):
// guarda tudo no localStorage do navegador e começa com dados fictícios.

import { criarSeed } from "./mock/seed";

const STORAGE_KEY = "hortilink:data:web:v7";
const SESSION_KEY = "hortilink:session:web:v2";

/**
 * @param {Storage} storage  injetável para testes
 * @returns {import("@application/ports").RepositorioPort}
 */
export function criarLocalStorageRepository(storage = globalThis.localStorage) {
  return {
    async carregar() {
      try {
        return JSON.parse(storage.getItem(STORAGE_KEY)) ?? criarSeed();
      } catch {
        return criarSeed();
      }
    },
    async salvar(estado) {
      storage.setItem(STORAGE_KEY, JSON.stringify(estado));
    },
    async carregarSessao() {
      return storage.getItem(SESSION_KEY);
    },
    async salvarSessao(userId) {
      if (userId) storage.setItem(SESSION_KEY, userId);
      else storage.removeItem(SESSION_KEY);
    },
  };
}
