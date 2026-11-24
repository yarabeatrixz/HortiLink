import { useSalvando } from "../../state/Salvando";

/**
 * Botão padrão. Botões de envio (`type="submit"`) e os marcados com `locks` ficam
 * travados e mostram "Salvando…" enquanto uma gravação está em andamento: assim um
 * clique repetido não cria registros duplicados (PROD-03) e o atraso fica visível (PROD-01).
 */
export function Button({
  children,
  variant = "primary",
  icon: Icon,
  className = "",
  locks = false,
  disabled = false,
  ...props
}) {
  const salvando = useSalvando();
  const travado = salvando && (locks || props.type === "submit");
  return (
    <button
      className={`button button-${variant} ${className}`}
      disabled={disabled || travado}
      aria-busy={travado || undefined}
      {...props}
    >
      {Icon && <Icon size={17} aria-hidden="true" />}
      {travado ? "Salvando…" : children}
    </button>
  );
}
