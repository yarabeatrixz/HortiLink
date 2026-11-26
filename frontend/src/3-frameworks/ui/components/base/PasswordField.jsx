import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/**
 * Campo de senha com botão para mostrar/ocultar o que foi digitado (Sprint 3).
 * Ajuda quem digita no celular a conferir a senha antes de entrar.
 */
export function PasswordField({ label, ...inputProps }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <span className="password-field">
        <input {...inputProps} type={visivel ? "text" : "password"} />
        <button
          type="button"
          className="password-toggle"
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          title={visivel ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => setVisivel((atual) => !atual)}
        >
          {visivel ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}
