// Cadastro, autenticação (modo demonstração) e pontos de retirada do produtor.

import { PERFIS_CADASTRO, type Perfil, SENHA_MINIMA } from "./constantes";
import type { Estado, Resultado, Usuario } from "./tipos";
import { falha, novoId, substituir, texto } from "./util";

export interface DadosCadastro {
  role: Perfil;
  name: string;
  city: string;
  email: string;
  password: string;
}

export interface Credenciais {
  email: string;
  password: string;
  role: Perfil;
}

const emailNormalizado = (email: string): string => texto(email).toLowerCase();

export function validarCadastro(usuarios: Usuario[], dados: DadosCadastro): Resultado | { ok: true } {
  if (!PERFIS_CADASTRO.some((perfil) => perfil.id === dados.role)) return falha("Escolha um perfil válido");
  if (!texto(dados.name) || !texto(dados.city) || !texto(dados.email) || !dados.password) {
    return falha("Preencha nome, cidade, e-mail e senha");
  }
  const email = emailNormalizado(dados.email);
  if (usuarios.some((usuario) => emailNormalizado(usuario.email) === email)) {
    return falha("Este e-mail já está cadastrado");
  }
  if (dados.password.length < SENHA_MINIMA) {
    return falha(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres`);
  }
  return { ok: true };
}

/** Só para o modo demonstração: a senha é comparada em texto puro. */
export function autenticar(usuarios: Usuario[], credenciais: Credenciais): Usuario | null {
  const email = emailNormalizado(credenciais.email);
  return (
    usuarios.find(
      (usuario) =>
        emailNormalizado(usuario.email) === email &&
        usuario.password === credenciais.password &&
        usuario.role === credenciais.role,
    ) ?? null
  );
}

export function cadastrarUsuario(estado: Estado, dados: DadosCadastro): Resultado<{ user: Usuario }> {
  const validacao = validarCadastro(estado.users, dados);
  if (!validacao.ok) return validacao;
  const user: Usuario = {
    id: novoId(),
    role: dados.role,
    name: texto(dados.name),
    city: texto(dados.city),
    email: emailNormalizado(dados.email),
    password: dados.password,
    ...(dados.role === "produtor" ? { pickupStoreIds: [] } : {}),
  };
  return { ok: true, user, state: { ...estado, users: [...estado.users, user] } };
}

export function salvarPontosRetirada(estado: Estado, userId: string, storeIds: string[]): Resultado {
  return {
    ok: true,
    state: {
      ...estado,
      users: substituir(estado.users, userId, (user) => ({ ...user, pickupStoreIds: storeIds })),
    },
  };
}

// ---------------------------------------------------------------- Configurações do perfil (GER-01)

export interface DadosPerfil {
  name: string;
  city: string;
}

export function atualizarPerfil(estado: Estado, userId: string, dados: DadosPerfil): Resultado {
  if (!texto(dados.name) || !texto(dados.city)) return falha("Preencha nome e cidade");
  if (!estado.users.some((user) => user.id === userId)) return falha("Usuário não encontrado");
  return {
    ok: true,
    state: {
      ...estado,
      users: substituir(estado.users, userId, (user) => ({
        ...user,
        name: texto(dados.name),
        city: texto(dados.city),
      })),
    },
  };
}

/** Validação da nova senha (a troca em si é do Supabase Auth; no modo demo, do estado). */
export const validarNovaSenha = (senha: string, confirmacao: string): string | null => {
  if (!senha || senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres`;
  if (senha !== confirmacao) return "As senhas não conferem";
  return null;
};

/** Só no modo demonstração: a senha fica no estado do navegador. */
export function trocarSenhaDemo(estado: Estado, userId: string, senha: string, confirmacao: string): Resultado {
  const problema = validarNovaSenha(senha, confirmacao);
  if (problema) return falha(problema);
  return {
    ok: true,
    state: { ...estado, users: substituir(estado.users, userId, (user) => ({ ...user, password: senha })) },
  };
}
