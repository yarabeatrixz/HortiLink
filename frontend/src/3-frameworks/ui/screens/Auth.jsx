import { ShieldCheck, ShoppingBasket, Sprout, Store } from "lucide-react";
import { useState } from "react";
import { PERFIS, PERFIS_CADASTRO, SENHA_MINIMA } from "@hortilink/dominio";
import { Button } from "../components/base/Button";
import { ErrorMessage } from "../components/base/ErrorMessage";
import { Field } from "../components/base/Field";
import { PasswordField } from "../components/base/PasswordField";
import { Logo } from "../components/Logo";
import { useApp } from "../state/AppProvider";

const ICONE_PERFIL = { produtor: Sprout, comprador: ShoppingBasket, loja: Store, admin: ShieldCheck };
const FORM_VAZIO = { name: "", city: "", email: "", password: "" };

export function Auth({ mostrarContasDemo = false }) {
  const { login, register } = useApp();
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("produtor");
  const [form, setForm] = useState(FORM_VAZIO);
  const [error, setError] = useState("");
  const isLogin = mode === "login";
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (isLogin) await login({ ...form, role });
      else await register({ ...form, role });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Logo />
        <div className="auth-visual-copy">
          <span className="auth-kicker">CONEXÕES QUE ALIMENTAM</span>
          <h1>Da produção local para toda a região.</h1>
          <p>Negocie hortaliças frescas diretamente e organize a retirada em lojas parceiras.</p>
        </div>
        <div className="visual-note">
          <span>Produção regional</span>
          <strong>Alto Tietê, SP</strong>
        </div>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div className="mobile-logo">
            <Logo />
          </div>
          <span className="eyebrow">{isLogin ? "BEM-VINDO DE VOLTA" : "NOVA CONTA"}</span>
          <h2>{isLogin ? "Acesse a HortiLink" : "Comece na HortiLink"}</h2>
          <p>
            {isLogin
              ? "Selecione seu perfil e use seus dados de acesso."
              : "Escolha como você participa da rede regional."}
          </p>
          <div className="role-grid" role="radiogroup" aria-label="Perfil de acesso">
            {/* Administrador só entra: a conta é criada pela equipe, não pelo cadastro. */}
            {(isLogin ? PERFIS : PERFIS_CADASTRO).map((perfil) => {
              const Icon = ICONE_PERFIL[perfil.id];
              const selecionado = role === perfil.id;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selecionado}
                  key={perfil.id}
                  className={selecionado ? "role-card selected" : "role-card"}
                  onClick={() => setRole(perfil.id)}
                >
                  <span>
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <b>{perfil.nome}</b>
                </button>
              );
            })}
          </div>
          {!isLogin && (
            <div className="two-cols">
              <Field
                label="Nome"
                value={form.name}
                onChange={update("name")}
                placeholder="Seu nome"
              />
              <Field
                label="Cidade"
                value={form.city}
                onChange={update("city")}
                placeholder="Sua cidade"
              />
            </div>
          )}
          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update("email")}
            placeholder="nome@exemplo.com"
          />
          <PasswordField
            label="Senha"
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={form.password}
            onChange={update("password")}
            placeholder={isLogin ? "Sua senha" : `Mínimo de ${SENHA_MINIMA} caracteres`}
          />
          <ErrorMessage>{error}</ErrorMessage>
          <Button type="submit" className="full">
            {isLogin ? "Entrar na plataforma" : "Criar minha conta"}
          </Button>
          <button
            type="button"
            className="switch-auth"
            onClick={() => {
              setMode(isLogin ? "cadastro" : "login");
              if (isLogin && role === "admin") setRole("produtor");
              setError("");
            }}
          >
            {isLogin ? "Não tem uma conta? Cadastre-se" : "Já possui conta? Entrar"}
          </button>
          {/* Sprint 3: as contas de teste só aparecem no modo demonstração, nunca no site real. */}
          {mostrarContasDemo && (
            <div className="demo-access">
              <b>Acessos de demonstração · senha 123456</b>
              <span>produtor@hortilink.com</span>
              <span>comprador@hortilink.com</span>
              <span>loja@hortilink.com</span>
              <span>admin@hortilink.com</span>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
