import { CalendarCheck, Save } from "lucide-react";
import { useState } from "react";
import { brl, extratoDaLoja, mesAtual } from "@hortilink/dominio";
import { Button } from "../../components/base/Button";
import { ErrorMessage } from "../../components/base/ErrorMessage";
import { Field } from "../../components/base/Field";
import { PageTitle } from "../../components/base/PageTitle";
import { SuccessMessage } from "../../components/base/SuccessMessage";
import { RewardStatement } from "../../components/RewardStatement";
import { SimulatedRewardNotice } from "../../components/SimulatedRewardNotice";
import { useApp } from "../../state/AppProvider";

/** Regra da recompensa (valor fixo + %) definida pelo administrador. */
function RegraDeRecompensa() {
  const { rewardSettings, saveRewardSettings } = useApp();
  const [form, setForm] = useState({
    fixedAmount: rewardSettings.fixedAmount,
    percent: rewardSettings.percent,
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await saveRewardSettings(form);
      setError("");
      setSaved(true);
    } catch (err) {
      setError(err.message);
      setSaved(false);
    }
  };

  return (
    <form className="form-card reward-rule" onSubmit={submit}>
      <h2>Regra da recompensa</h2>
      <p>Para cada pedido retirado, a loja recebe o valor fixo + a porcentagem do valor do pedido.</p>
      <div className="two-cols">
        <Field
          label="Valor fixo por pedido (R$)"
          type="number"
          min="0"
          step="0.01"
          value={form.fixedAmount}
          onChange={(event) => setForm({ ...form, fixedAmount: event.target.value })}
        />
        <Field
          label="Porcentagem do pedido (%)"
          type="number"
          min="0"
          step="0.1"
          value={form.percent}
          onChange={(event) => setForm({ ...form, percent: event.target.value })}
        />
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      {saved && <SuccessMessage>Regra atualizada. Meses já fechados não mudam.</SuccessMessage>}
      <Button type="submit" icon={Save}>
        Salvar regra
      </Button>
    </form>
  );
}

/** US16: extrato por loja e fechamento do mês. */
export function AdminRewards() {
  const app = useApp();
  const [month, setMonth] = useState(mesAtual());
  const [storeId, setStoreId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const linhas = app.stores.map((store) => ({ store, extrato: extratoDaLoja(app, store.id, month) }));
  const totalDoMes = linhas.reduce((soma, { extrato }) => soma + extrato.amount, 0);

  const fechar = async (store) => {
    try {
      await app.closeRewardMonth(store.id, month);
      setError("");
      setMessage(`Mês ${month} fechado para ${store.name}`);
    } catch (err) {
      setError(err.message);
      setMessage("");
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRAÇÃO"
        title="Recompensa das lojas"
        description="Defina a regra, acompanhe o extrato de cada ponto e feche o mês."
      />
      <SimulatedRewardNotice />
      <RegraDeRecompensa />
      <div className="section-heading">
        <h2>Extrato de {month}</h2>
        <Field
          label="Mês"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value || mesAtual())}
        />
      </div>
      {message && <SuccessMessage>{message}</SuccessMessage>}
      <ErrorMessage>{error}</ErrorMessage>
      <div className="table-card">
        <table className="data-table">
          <caption className="sr-only">Recompensa por ponto de coleta</caption>
          <thead>
            <tr>
              <th scope="col">Ponto de coleta</th>
              <th scope="col">Retirados</th>
              <th scope="col">Vendas</th>
              <th scope="col">Recompensa</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ store, extrato }) => (
              <tr key={store.id}>
                <th scope="row">
                  {store.name}
                  <small>
                    {store.city} · {store.status}
                  </small>
                </th>
                <td>{extrato.ordersCount}</td>
                <td>{brl(extrato.salesTotal)}</td>
                <td>{brl(extrato.amount)}</td>
                <td className="row-actions">
                  <button type="button" onClick={() => setStoreId(store.id)}>
                    Ver extrato
                  </button>
                  {extrato.fechamento ? (
                    <span className="reward-closed-tag">Fechado</span>
                  ) : (
                    <Button
                      variant="secondary"
                      icon={CalendarCheck}
                      locks
                      disabled={!extrato.ordersCount}
                      onClick={() => fechar(store)}
                    >
                      Fechar mês
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total do mês</th>
              <td colSpan={2} />
              <td>{brl(totalDoMes)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {storeId && (
        <section className="reward-detail">
          <h2>{app.stores.find((store) => store.id === storeId)?.name}</h2>
          <RewardStatement state={app} storeId={storeId} month={month} />
        </section>
      )}
    </>
  );
}
