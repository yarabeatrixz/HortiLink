// Adapter da porta `AutenticacaoPort` sobre o Supabase Auth. O cadastro manda
// perfil, nome e cidade nos metadados; o gatilho da migration cria o `users`.

import { mensagemPerfilErrado } from "@hortilink/dominio";

const ERRO_LOGIN = "E-mail ou senha incorretos";
const ERRO_CADASTRO = "Não foi possível cadastrar agora. Tente de novo.";
const CONFIRMAR_EMAIL = "Cadastro feito! Confirme pelo link enviado ao seu e-mail e depois entre.";

const mensagemDeCadastro = (erro) =>
  erro.code === "user_already_exists" ? "Este e-mail já está cadastrado" : ERRO_CADASTRO;

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} cliente
 * @returns {import("@application/ports").AutenticacaoPort & { obterToken: () => Promise<string|null> }}
 */
export function criarSupabaseAutenticacao(cliente) {
  const sessaoAtual = async () => (await cliente.auth.getSession()).data.session;

  /** Perfil gravado no cadastro (null se não deu para ler). */
  async function perfilDaConta(userId) {
    const { data, error } = await cliente
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();
    return error ? null : (data?.role ?? null);
  }

  return {
    async entrar({ email, password, role }) {
      const { data, error } = await cliente.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error(ERRO_LOGIN);
      // O perfil escolhido na tela precisa ser o do cadastro (igual ao modo demo).
      const perfil = await perfilDaConta(data.user.id);
      if (perfil !== role) {
        await cliente.auth.signOut();
        throw new Error(perfil ? mensagemPerfilErrado(perfil) : ERRO_LOGIN);
      }
      return data.user.id;
    },

    async cadastrar({ role, name, city, email, password }) {
      const { data, error } = await cliente.auth.signUp({
        email,
        password,
        options: { data: { role, name, city } },
      });
      if (error) throw new Error(mensagemDeCadastro(error));
      // Com confirmação de e-mail ligada no Supabase, não há sessão até confirmar.
      if (!data.session) throw new Error(CONFIRMAR_EMAIL);
      return data.user.id;
    },

    async trocarSenha(senha) {
      const { error } = await cliente.auth.updateUser({ password: senha });
      if (error) throw new Error("Não foi possível trocar a senha agora. Entre de novo e tente outra vez.");
    },

    async sair() {
      await cliente.auth.signOut();
    },
    usuarioAtual: async () => (await sessaoAtual())?.user.id ?? null,
    obterToken: async () => (await sessaoAtual())?.access_token ?? null,
  };
}
