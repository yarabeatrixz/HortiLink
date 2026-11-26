import { CircleAlert } from "lucide-react";

/**
 * Aviso de valores demonstrativos (Sprint 3, decisão da equipe): o pagamento do
 * TCC é simulado, então a recompensa das lojas é um cálculo, não um repasse real.
 */
export function SimulatedRewardNotice() {
  return (
    <div className="test-banner" role="note">
      <CircleAlert size={18} aria-hidden="true" />
      <b>Valores demonstrativos</b> — o pagamento é simulado, então nenhuma recompensa é paga de
      verdade
    </div>
  );
}
