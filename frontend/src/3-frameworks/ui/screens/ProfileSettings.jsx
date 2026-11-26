import { KeyRound, Save } from "lucide-react";
import { useState } from "react";
import { SENHA_MINIMA, nomePerfil } from "@hortilink/dominio";
import { Button } from "../components/base/Button";
import { ErrorMessage } from "../components/base/ErrorMessage";
import { Field } from "../components/base/Field";
import { PasswordField } from "../components/base/PasswordField";
import { PageTitle } from "../components/base/PageTitle";
import { SuccessMessage } from "../components/base/SuccessMessage";
import { useApp } from "../state/AppProvider";

/** Formulário com mensagem de sucesso/erro: devolve `submit` pronto para o <form>. */
function useEnvio(acao, sucesso) {
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    try {
      await acao();
      setError("");
      setOk(sucesso);
    } catch (err) {
      setError(err.message);
      setOk("");
    }
  };
  return { submit, error, ok };
}

/** GER-01: configurações do próprio perfil (todos os perfis). */
export function ProfileSettings() {
  const { currentUser, updateProfile, changePassword } = useApp();
  const [perfil, setPerfil] = useState({ name: currentUser.name, city: currentUser.city });
  const [senha, setSenha] = useState({ nova: "", confirmacao: "" });

  const dados = useEnvio(() => updateProfile(perfil), "Dados atualizados com sucesso");
  const troca = useEnvio(async () => {
    await changePassword(senha.nova, senha.confirmacao);
    setSenha({ nova: "", confirmacao: "" });
  }, "Senha alterada com sucesso");

  return (
    <>
      <PageTitle
        eyebrow="CONFIGURAÇÕES"
        title="Meu perfil"
        description={`Você entra como ${nomePerfil(currentUser.role)}. Atualize seus dados e sua senha.`}
      />
      <div className="settings-grid">
        <form className="form-card" onSubmit={dados.submit}>
          <h2>Dados pessoais</h2>
          <Field
            label="Nome"
            value={perfil.name}
            onChange={(event) => setPerfil({ ...perfil, name: event.target.value })}
          />
          <Field
            label="Cidade"
            value={perfil.city}
            onChange={(event) => setPerfil({ ...perfil, city: event.target.value })}
          />
          {currentUser.email && <Field label="E-mail" value={currentUser.email} disabled readOnly />}
          <ErrorMessage>{dados.error}</ErrorMessage>
          {dados.ok && <SuccessMessage>{dados.ok}</SuccessMessage>}
          <Button type="submit" icon={Save}>
            Salvar dados
          </Button>
        </form>

        <form className="form-card" onSubmit={troca.submit}>
          <h2>Trocar senha</h2>
          <PasswordField
            label="Nova senha"
            autoComplete="new-password"
            value={senha.nova}
            onChange={(event) => setSenha({ ...senha, nova: event.target.value })}
            placeholder={`Mínimo de ${SENHA_MINIMA} caracteres`}
          />
          <PasswordField
            label="Confirmar nova senha"
            autoComplete="new-password"
            value={senha.confirmacao}
            onChange={(event) => setSenha({ ...senha, confirmacao: event.target.value })}
          />
          <ErrorMessage>{troca.error}</ErrorMessage>
          {troca.ok && <SuccessMessage>{troca.ok}</SuccessMessage>}
          <Button type="submit" icon={KeyRound}>
            Trocar senha
          </Button>
        </form>
      </div>
    </>
  );
}
