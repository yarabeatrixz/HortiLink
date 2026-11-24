import { useEffect } from "react";
import { Button } from "./Button";

/** Diálogo de confirmação. Fecha com Esc ou clique fora. */
export function ConfirmModal({
  icon: Icon,
  danger = false,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const fecharComEsc = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className={danger ? "danger-modal-icon" : ""}>
          <Icon size={25} aria-hidden="true" />
        </span>
        <h2 id="confirm-modal-title">{title}</h2>
        <p>{children}</p>
        <div>
          <Button variant="secondary" onClick={onClose} autoFocus>
            Cancelar
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} locks>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
