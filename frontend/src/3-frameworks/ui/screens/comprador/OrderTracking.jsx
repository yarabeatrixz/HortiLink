import { KeyRound, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { EVENTO_PEDIDO, pedidoNaLoja } from "@hortilink/dominio";
import { BackButton } from "../../components/base/BackButton";
import { OrderTimeline } from "../../components/OrderTimeline";
import { StatusBadge } from "../../components/StatusBadge";
import { useApp } from "../../state/AppProvider";

const ETAPAS_ENTREGA = [
  { label: "Pedido confirmado", event: EVENTO_PEDIDO.PAGAMENTO_APROVADO },
  { label: "Produto entregue na loja", event: EVENTO_PEDIDO.ENTREGUE_NA_LOJA },
  { label: "Pronto para retirada", event: EVENTO_PEDIDO.PRONTO_PARA_RETIRADA },
  { label: "Retirado", event: EVENTO_PEDIDO.RETIRADO },
];

/** Código de 6 dígitos que o comprador mostra na loja (US10). */
function CodigoDeRetirada({ order }) {
  const { getPickupCode } = useApp();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const naLoja = pedidoNaLoja(order);

  useEffect(() => {
    if (!naLoja) return;
    let ativo = true;
    getPickupCode(order.id)
      .then((valor) => ativo && setCode(valor))
      .catch((err) => ativo && setError(err.message));
    return () => {
      ativo = false;
    };
  }, [order.id, naLoja, getPickupCode]);

  if (!naLoja) return null;
  return (
    <div className="pickup-code">
      <span>
        <KeyRound size={20} aria-hidden="true" />
      </span>
      <div>
        <small>CÓDIGO DE RETIRADA</small>
        <strong aria-live="polite">{code || (error ? "—" : "carregando…")}</strong>
        <p>{error || "Mostre este código na loja para retirar seu pedido."}</p>
      </div>
    </div>
  );
}

export function OrderTracking({ id, back }) {
  const { orders, products, stores } = useApp();
  const order = orders.find((item) => item.id === id);
  if (!order) return null;
  const product = products.find((item) => item.id === order.productId);
  const store = stores.find((item) => item.id === order.storeId);

  return (
    <div className="tracking-page">
      <BackButton onClick={back}>Voltar aos pedidos</BackButton>
      <div className="detail-heading">
        <div>
          <span className="eyebrow">ACOMPANHAMENTO DO PEDIDO</span>
          <h1>{order.orderNumber}</h1>
          <p>{product?.name}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <section className="tracking-card">
        <h2>Linha do tempo</h2>
        <OrderTimeline order={order} steps={ETAPAS_ENTREGA} />
        <CodigoDeRetirada order={order} />
        <div className="where-pickup">
          <span>
            <MapPin size={20} aria-hidden="true" />
          </span>
          <div>
            <small>ONDE RETIRAR</small>
            <b>{store?.name}</b>
            <p>
              {store?.address} · {store?.city}
              <br />
              {store?.hours}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
