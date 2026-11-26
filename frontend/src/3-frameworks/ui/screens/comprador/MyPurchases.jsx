import { ChevronRight, CreditCard, PackageCheck, Store } from "lucide-react";
import { useState } from "react";
import { STATUS_PEDIDO, brl, dataCurta } from "@hortilink/dominio";
import { EmptyState } from "../../components/base/EmptyState";
import { PageTitle } from "../../components/base/PageTitle";
import { SearchBox } from "../../components/base/SearchBox";
import { ProductImage } from "../../components/ProductImage";
import { StatusBadge } from "../../components/StatusBadge";
import { useApp } from "../../state/AppProvider";
import { PERIODOS, buscaPorNumero, dentroDoPeriodo, totalPedido } from "../orderFilters";

function paymentText(order) {
  if (order.status === STATUS_PEDIDO.AGUARDANDO_PAGAMENTO)
    return "Pagamento pendente · toque para pagar";
  if (order.paymentMethod)
    return `Pago via ${order.paymentMethod}${order.paidAt ? ` em ${dataCurta(order.paidAt)}` : ""}`;
  if (order.status === STATUS_PEDIDO.CANCELADO) return "Cancelado · o estoque voltou para a vitrine";
  return "Pagamento aprovado";
}

export function MyPurchases({ open, pay }) {
  const { currentUser, orders, products, users, stores } = useApp();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const list = orders.filter(
    (order) =>
      order.buyerId === currentUser.id &&
      buscaPorNumero(order, search) &&
      (status === "Todos" || order.status === status) &&
      dentroDoPeriodo(order.createdAt, period),
  );

  return (
    <>
      <PageTitle
        eyebrow="HISTÓRICO"
        title="Minhas compras"
        description="Consulte seus pedidos, pagamentos e pontos de retirada."
      />
      <div className="purchase-filters">
        <SearchBox
          className="order-search"
          value={search}
          onChange={setSearch}
          placeholder="Buscar pelo número do pedido"
        />
        <select aria-label="Período" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODOS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>Todos</option>
          {Object.values(STATUS_PEDIDO).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      {list.length ? (
        <div className="purchase-history">
          {list.map((order) => {
            const product = products.find((item) => item.id === order.productId);
            const producer = users.find((item) => item.id === order.producerId);
            const store = stores.find((item) => item.id === order.storeId);
            const awaitingPayment = order.status === STATUS_PEDIDO.AGUARDANDO_PAGAMENTO;
            return (
              <button
                className="purchase-history-card"
                onClick={() => (awaitingPayment ? pay(order.id) : open(order.id))}
                key={order.id}
              >
                <ProductImage product={product} />
                <span className="purchase-history-main">
                  <span className="card-heading">
                    <span>
                      <strong className="order-number">{order.orderNumber}</strong>
                      <small>{dataCurta(order.createdAt)}</small>
                      <h3>{product?.name}</h3>
                    </span>
                    <StatusBadge status={order.status} />
                  </span>
                  <span className="proposal-inline">
                    <span>
                      {order.quantity} {product?.unit}
                    </span>
                    <span>{producer?.name}</span>
                    <strong>{brl(totalPedido(order))}</strong>
                  </span>
                  <span className="purchase-line">
                    <Store size={15} aria-hidden="true" /> {store?.name} · {store?.city}
                  </span>
                  <span
                    className={awaitingPayment ? "purchase-line payment-pending" : "purchase-line"}
                  >
                    <CreditCard size={15} aria-hidden="true" />
                    {paymentText(order)}
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={PackageCheck} title="Você ainda não fez compras." />
      )}
    </>
  );
}
