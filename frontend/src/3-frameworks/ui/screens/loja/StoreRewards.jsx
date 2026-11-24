import { HandCoins } from "lucide-react";
import { useState } from "react";
import { brl, mesAtual } from "@hortilink/dominio";
import { EmptyState } from "../../components/base/EmptyState";
import { Field } from "../../components/base/Field";
import { PageTitle } from "../../components/base/PageTitle";
import { RewardStatement } from "../../components/RewardStatement";
import { useApp } from "../../state/AppProvider";

/** Extrato da loja: quanto ela recebe pelos pedidos retirados no ponto (US16). */
export function StoreRewards() {
  const app = useApp();
  const store = app.stores.find((item) => item.userId === app.currentUser.id);
  const [month, setMonth] = useState(mesAtual());
  const { fixedAmount, percent } = app.rewardSettings;

  return (
    <>
      <PageTitle
        eyebrow="RECOMPENSAS"
        title="Minhas recompensas"
        description={`Você recebe ${brl(fixedAmount)} + ${String(percent).replace(".", ",")}% do valor de cada pedido retirado no seu ponto.`}
      />
      {store ? (
        <>
          <div className="catalog-tools">
            <Field
              label="Mês"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value || mesAtual())}
            />
          </div>
          <RewardStatement state={app} storeId={store.id} month={month} />
        </>
      ) : (
        <EmptyState icon={HandCoins} title="Cadastre seu ponto de coleta" />
      )}
    </>
  );
}
