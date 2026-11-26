import { CheckCircle2, Store, XCircle } from "lucide-react";
import { STATUS_PEDIDO, brl, dataHora } from "@hortilink/dominio";
import { Button } from "../../components/base/Button";
import { useApp } from "../../state/AppProvider";
import { totalPedido } from "../orderFilters";

export function PaymentApproved({ id, method, goOrders, goOffers }) {
  const { orders, stores } = useApp();
  const order = orders.find((item) => item.id === id);
  if (!order) return null;
  const store = stores.find((item) => item.id === order.storeId);
  // Só confirma o que o servidor confirmou (Sprint 3, segunda banca).
  if (order.status === STATUS_PEDIDO.AGUARDANDO_PAGAMENTO || order.status === STATUS_PEDIDO.CANCELADO) {
    return (
      <div className="payment-result" role="alert">
        <span className="result-icon error">
          <XCircle size={40} aria-hidden="true" />
        </span>
        <h1>Pagamento não confirmado</h1>
        <strong className="order-number">{order.orderNumber}</strong>
        <p>
          {order.status === STATUS_PEDIDO.CANCELADO
            ? "Este pedido foi cancelado e não foi pago."
            : "Este pedido ainda está aguardando pagamento."}
        </p>
        <div className="result-actions">
          <Button onClick={goOrders}>Ver meus pedidos</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result" role="status">
      <span className="result-icon success">
        <CheckCircle2 size={40} aria-hidden="true" />
      </span>
      <span className="eyebrow">PAGAMENTO CONFIRMADO</span>
      <h1>Pagamento aprovado</h1>
      <strong className="order-number">{order.orderNumber}</strong>
      <p>Seu pedido está confirmado e será preparado para retirada.</p>
      <div className="receipt">
        <div>
          <span>Valor pago</span>
          <b>{brl(totalPedido(order))}</b>
        </div>
        <div>
          <span>Forma de pagamento</span>
          <b>{method}</b>
        </div>
        <div>
          <span>Data e hora</span>
          <b>{dataHora(order.paidAt ?? Date.now())}</b>
        </div>
      </div>
      <div className="pickup-result">
        <Store size={22} aria-hidden="true" />
        <div>
          <small>RETIRADA EM</small>
          <b>{store?.name}</b>
          <p>
            {store?.address} · {store?.city}
            <br />
            {store?.hours}
          </p>
        </div>
      </div>
      <div className="result-actions">
        <Button onClick={goOrders}>Ver meus pedidos</Button>
        <Button variant="secondary" onClick={goOffers}>
          Voltar às ofertas
        </Button>
      </div>
    </div>
  );
}

export function PaymentDeclined({ id, retry, pix }) {
  const { orders } = useApp();
  const order = orders.find((item) => item.id === id);

  return (
    <div className="payment-result" role="alert">
      <span className="result-icon error">
        <XCircle size={40} aria-hidden="true" />
      </span>
      <span className="eyebrow">PAGAMENTO NÃO CONCLUÍDO</span>
      <h1>Pagamento recusado</h1>
      <strong className="order-number">{order?.orderNumber}</strong>
      <p>Seu cartão foi recusado. Verifique os dados ou tente outra forma de pagamento.</p>
      <div className="result-actions">
        <Button onClick={retry}>Tentar novamente</Button>
        <Button variant="secondary" onClick={pix}>
          Pagar com Pix
        </Button>
      </div>
    </div>
  );
}
