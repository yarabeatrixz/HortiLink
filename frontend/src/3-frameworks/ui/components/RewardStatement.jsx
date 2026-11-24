import { CalendarCheck, HandCoins, PackageCheck } from "lucide-react";
import { brl, dataCurta, extratoDaLoja } from "@hortilink/dominio";
import { SummaryCard } from "./base/SummaryCard";

/** Extrato de recompensa de uma loja num mês (US16): resumo + pedidos retirados. */
export function RewardStatement({ state, storeId, month }) {
  const extrato = extratoDaLoja(state, storeId, month);
  const nomeDo = (productId) => state.products.find((p) => p.id === productId)?.name ?? "Produto";

  return (
    <>
      <div className="summary-grid">
        <SummaryCard label="Pedidos retirados" value={extrato.ordersCount} icon={PackageCheck} />
        <SummaryCard label="Vendas retiradas" value={brl(extrato.salesTotal)} icon={HandCoins} />
        <SummaryCard
          label={extrato.fechamento ? "Recompensa (mês fechado)" : "Recompensa (prévia)"}
          value={brl(extrato.amount)}
          icon={CalendarCheck}
        />
      </div>
      {extrato.fechamento && (
        <p className="reward-closed">
          Mês fechado em {dataCurta(extrato.fechamento.createdAt)}: {brl(extrato.fechamento.amount)}{" "}
          a receber.
        </p>
      )}
      {extrato.pedidos.length ? (
        <div className="table-card">
          <table className="data-table">
            <caption className="sr-only">Pedidos retirados no mês</caption>
            <thead>
              <tr>
                <th scope="col">Pedido</th>
                <th scope="col">Produto</th>
                <th scope="col">Retirado em</th>
                <th scope="col">Valor do pedido</th>
                <th scope="col">Recompensa</th>
              </tr>
            </thead>
            <tbody>
              {extrato.pedidos.map((pedido) => (
                <tr key={pedido.id}>
                  <th scope="row">{pedido.orderNumber}</th>
                  <td>{nomeDo(pedido.productId)}</td>
                  <td>{dataCurta(pedido.pickedUpAt)}</td>
                  <td>{brl(pedido.quantity * pedido.unitPrice)}</td>
                  <td>{brl(pedido.recompensa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="no-stores">Nenhum pedido retirado neste mês.</p>
      )}
    </>
  );
}
