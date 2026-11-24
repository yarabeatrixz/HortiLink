import { KeyRound, PackageCheck, PackageOpen } from "lucide-react";
import { useState } from "react";
import { STATUS_PEDIDO, brl, dataHora } from "@hortilink/dominio";
import { Button } from "../../components/base/Button";
import { EmptyState } from "../../components/base/EmptyState";
import { ErrorMessage } from "../../components/base/ErrorMessage";
import { PageTitle } from "../../components/base/PageTitle";
import { SearchBox } from "../../components/base/SearchBox";
import { SuccessMessage } from "../../components/base/SuccessMessage";
import { StatusBadge } from "../../components/StatusBadge";
import { useApp } from "../../state/AppProvider";
import { buscaPorNumero, totalPedido } from "../orderFilters";

const ABAS = {
  ativos: {
    label: "Para retirada",
    status: [STATUS_PEDIDO.PAGO, STATUS_PEDIDO.ENTREGUE_NA_LOJA, STATUS_PEDIDO.PRONTO_PARA_RETIRADA],
  },
  retirados: { label: "Retirados", status: [STATUS_PEDIDO.RETIRADO] },
};

const SITUACAO = {
  [STATUS_PEDIDO.PAGO]: "A chegar (produtor ainda vai entregar)",
  [STATUS_PEDIDO.ENTREGUE_NA_LOJA]: "Chegou: confira e libere para retirada",
  [STATUS_PEDIDO.PRONTO_PARA_RETIRADA]: "Aguardando o comprador",
};

/** Ações da loja num pedido: liberar para retirada e conferir o código (US10). */
function AcoesDoPedido({ order, onDone }) {
  const { confirmOrderReceived, confirmPickup } = useApp();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const rodar = async (acao, mensagem) => {
    try {
      await acao();
      setError("");
      onDone(mensagem);
    } catch (err) {
      setError(err.message);
    }
  };

  const podeRetirar =
    order.status === STATUS_PEDIDO.ENTREGUE_NA_LOJA ||
    order.status === STATUS_PEDIDO.PRONTO_PARA_RETIRADA;

  return (
    <div className="store-order-actions">
      {order.status === STATUS_PEDIDO.ENTREGUE_NA_LOJA && (
        <Button
          variant="secondary"
          icon={PackageOpen}
          locks
          onClick={() =>
            rodar(
              () => confirmOrderReceived(order.id),
              `${order.orderNumber} liberado para retirada`,
            )
          }
        >
          Liberar para retirada
        </Button>
      )}
      {podeRetirar && (
        <form
          className="pickup-code-form"
          onSubmit={(event) => {
            event.preventDefault();
            rodar(() => confirmPickup(order.id, code), `${order.orderNumber} retirado pelo comprador`);
          }}
        >
          <label>
            <span>Código do comprador</span>
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              aria-label={`Código de retirada do pedido ${order.orderNumber}`}
            />
          </label>
          <Button type="submit" icon={KeyRound} disabled={code.length !== 6}>
            Confirmar retirada
          </Button>
        </form>
      )}
      <ErrorMessage>{error}</ErrorMessage>
    </div>
  );
}

/** Pedidos que serão (ou já foram) retirados na loja. */
export function StoreOrders() {
  const { currentUser, stores, orders, products, users } = useApp();
  const store = stores.find((item) => item.userId === currentUser.id);
  const [search, setSearch] = useState("");
  const [aba, setAba] = useState("ativos");
  const [message, setMessage] = useState("");
  const list = orders.filter(
    (order) =>
      order.storeId === store?.id &&
      ABAS[aba].status.includes(order.status) &&
      buscaPorNumero(order, search),
  );

  return (
    <>
      <PageTitle
        eyebrow="RETIRADAS"
        title="Pedidos para retirada"
        description="Libere o pedido quando ele chegar e confirme a retirada com o código do comprador."
      />
      <div className="filter-row" role="group" aria-label="Filtrar pedidos">
        {Object.entries(ABAS).map(([id, { label }]) => (
          <button
            type="button"
            key={id}
            className={aba === id ? "active" : ""}
            aria-pressed={aba === id}
            onClick={() => setAba(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <SearchBox
        className="order-search"
        value={search}
        onChange={setSearch}
        placeholder="Buscar pelo número do pedido"
      />
      {message && <SuccessMessage>{message}</SuccessMessage>}
      {list.length ? (
        <div className="list-cards">
          {list.map((order) => {
            const product = products.find((item) => item.id === order.productId);
            const producer = users.find((item) => item.id === order.producerId);
            const buyer = users.find((item) => item.id === order.buyerId);
            return (
              <article className="order-card store-order-card" key={order.id}>
                <span className="order-icon">
                  <PackageCheck size={24} aria-hidden="true" />
                </span>
                <div>
                  <strong className="order-number">{order.orderNumber}</strong>
                  <h3>{product?.name ?? "Produto"}</h3>
                  <p>
                    {order.quantity} {product?.unit}
                  </p>
                </div>
                <div className="store-order-status">
                  <StatusBadge status={order.status} />
                  <small>
                    {order.pickedUpAt
                      ? `Retirado em ${dataHora(order.pickedUpAt)}`
                      : SITUACAO[order.status]}
                  </small>
                </div>
                <div>
                  <small>PRODUTOR</small>
                  <b>{producer?.name ?? "—"}</b>
                </div>
                <div>
                  <small>COMPRADOR</small>
                  <b>{buyer?.name ?? "—"}</b>
                </div>
                <strong>{brl(totalPedido(order))}</strong>
                {aba === "ativos" && <AcoesDoPedido order={order} onDone={setMessage} />}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={PackageCheck}
          title={
            store
              ? aba === "ativos"
                ? "Nenhum pedido para retirada"
                : "Nenhum pedido retirado ainda"
              : "Cadastre seu ponto de coleta"
          }
        />
      )}
    </>
  );
}
