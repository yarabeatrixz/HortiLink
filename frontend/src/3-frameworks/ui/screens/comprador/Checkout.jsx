// Checkout SIMULADO (ambiente de teste): nenhum valor é cobrado e nenhum dado
// de cartão sai do navegador. Integração real de pagamento = tarefa do back-end.

import { Check, CircleAlert, Clock3, Copy, CreditCard, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { METODO_PAGAMENTO, PRAZO_PAGAMENTO_MINUTOS, STATUS_PEDIDO, brl } from "@hortilink/dominio";
import { BackButton } from "../../components/base/BackButton";
import { Button } from "../../components/base/Button";
import { ErrorMessage } from "../../components/base/ErrorMessage";
import { Field } from "../../components/base/Field";
import { ProductImage } from "../../components/ProductImage";
import { useApp } from "../../state/AppProvider";
import { totalPedido } from "../orderFilters";

const PIX_EXPIRA_EM_SEGUNDOS = 600;
const PIX_COPIA_E_COLA = "00020126580014BR.GOV.BCB.PIX.HORTILINK";
const CARTAO_TESTE_RECUSADO = "4000000000000002";
const METODOS = [
  { id: METODO_PAGAMENTO.PIX, label: "Pix", hint: "Aprovação imediata", icon: QrCode },
  { id: METODO_PAGAMENTO.CARTAO, label: "Cartão", hint: "Crédito em até 3x", icon: CreditCard },
];

const mmss = (segundos) =>
  `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;

export function Checkout({ id, back, success, declined, initialMethod = METODO_PAGAMENTO.PIX }) {
  const { orders, products, users, stores, payOrder, cancelOrder } = useApp();
  const [method, setMethod] = useState(initialMethod);
  const [seconds, setSeconds] = useState(PIX_EXPIRA_EM_SEGUNDOS);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [card, setCard] = useState({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
    installments: "1x sem juros",
  });

  useEffect(() => {
    if (method !== METODO_PAGAMENTO.PIX || seconds <= 0) return undefined;
    const timer = setInterval(() => setSeconds((current) => current - 1), 1000);
    return () => clearInterval(timer);
  }, [method, seconds]);

  const order = orders.find((item) => item.id === id);
  if (!order || order.status !== STATUS_PEDIDO.AGUARDANDO_PAGAMENTO) {
    // Pedido sumiu, foi cancelado ou expirou: explica em vez de deixar a tela em branco.
    return (
      <div className="checkout-page">
        <BackButton onClick={back} />
        <ErrorMessage>
          {order?.status === STATUS_PEDIDO.CANCELADO
            ? "Este pedido foi cancelado (ou o prazo para pagar acabou) e o estoque voltou para a vitrine. Faça a compra de novo."
            : order
              ? "Este pedido já foi pago. Acompanhe em Minhas compras."
              : "Pedido não encontrado. Confira em Minhas compras."}
        </ErrorMessage>
      </div>
    );
  }
  const product = products.find((item) => item.id === order.productId);
  const producer = users.find((item) => item.id === order.producerId);
  const store = stores.find((item) => item.id === order.storeId);
  const total = totalPedido(order);
  const setCardField = (key) => (event) => setCard({ ...card, [key]: event.target.value });

  const cancel = async () => {
    try {
      await cancelOrder(order.id);
      back();
    } catch (err) {
      setError(err.message);
    }
  };

  const approve = async (paymentMethod) => {
    try {
      await payOrder(order.id, paymentMethod);
      success(paymentMethod);
    } catch (err) {
      setError(err.message);
    }
  };

  const submitCard = (event) => {
    event.preventDefault();
    if (card.number.replace(/\D/g, "") === CARTAO_TESTE_RECUSADO) declined();
    else approve(METODO_PAGAMENTO.CARTAO);
  };

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_COPIA_E_COLA);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

  return (
    <div className="checkout-page">
      <BackButton onClick={back} />
      <div className="test-banner" role="note">
        <CircleAlert size={18} aria-hidden="true" />
        <b>Ambiente de teste</b> — nenhum valor é cobrado
      </div>
      <div className="checkout-grid">
        <section>
          <span className="eyebrow">PAGAMENTO SEGURO</span>
          <h1>Checkout</h1>
          <div className="payment-methods" role="radiogroup" aria-label="Forma de pagamento">
            {METODOS.map(({ id: methodId, label, hint, icon: Icon }) => (
              <button
                type="button"
                role="radio"
                aria-checked={method === methodId}
                className={method === methodId ? "active" : ""}
                onClick={() => setMethod(methodId)}
                key={methodId}
              >
                <span>
                  <Icon size={21} aria-hidden="true" />
                </span>
                <span>
                  <b>{label}</b>
                  <small>{hint}</small>
                </span>
                <i>{method === methodId && <Check size={13} aria-hidden="true" />}</i>
              </button>
            ))}
          </div>
          <ErrorMessage>{error}</ErrorMessage>
          {method === METODO_PAGAMENTO.PIX ? (
            <div className="payment-panel pix-panel">
              <div className="qr-code" role="img" aria-label="QR Code de exemplo">
                {Array.from({ length: 81 }, (_, index) => (
                  <i className={(index * 7 + (index % 4)) % 3 ? "" : "dark"} key={index} />
                ))}
              </div>
              <h3>Escaneie o QR Code</h3>
              <p>Abra o app do seu banco e pague usando Pix.</p>
              <div className="pix-code">
                <code>{PIX_COPIA_E_COLA}</code>
                <button type="button" onClick={copyPix}>
                  <Copy size={15} aria-hidden="true" />
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <div className="pix-wait">
                <Clock3 size={17} aria-hidden="true" />
                <span>
                  <b>{seconds > 0 ? `Expira em ${mmss(seconds)}` : "Código expirado"}</b>
                  <small>Aguardando pagamento...</small>
                </span>
              </div>
              <Button
                className="full"
                disabled={seconds <= 0}
                onClick={() => approve(METODO_PAGAMENTO.PIX)}
              >
                Simular pagamento recebido
              </Button>
            </div>
          ) : (
            <form className="payment-panel card-form" onSubmit={submitCard}>
              <Field
                label="Número do cartão"
                required
                inputMode="numeric"
                autoComplete="off"
                value={card.number}
                onChange={setCardField("number")}
                placeholder="0000 0000 0000 0000"
              />
              <Field
                label="Nome impresso no cartão"
                required
                autoComplete="off"
                value={card.name}
                onChange={setCardField("name")}
                placeholder="NOME COMO NO CARTÃO"
              />
              <div className="two-cols">
                <Field
                  label="Validade (MM/AA)"
                  required
                  autoComplete="off"
                  value={card.expiry}
                  onChange={setCardField("expiry")}
                  placeholder="MM/AA"
                />
                <Field
                  label="CVV"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  value={card.cvv}
                  onChange={setCardField("cvv")}
                  placeholder="123"
                />
              </div>
              <Field label="Parcelas">
                <select value={card.installments} onChange={setCardField("installments")}>
                  <option>1x sem juros</option>
                  <option>2x sem juros</option>
                  <option>3x sem juros</option>
                </select>
              </Field>
              <p className="test-cards">
                <b>Cartões de teste:</b> 4111 1111 1111 1111 (aprovado) • 4000 0000 0000 0002
                (recusado)
              </p>
              <Button className="full" type="submit">
                Pagar {brl(total)}
              </Button>
            </form>
          )}
        </section>
        <aside className="order-summary">
          <span className="eyebrow">RESUMO DO PEDIDO</span>
          <strong className="order-number">{order.orderNumber}</strong>
          <div className="summary-product">
            <ProductImage product={product} alt="" />
            <span>
              <b>{product?.name}</b>
              <small>
                {order.quantity} {product?.unit} × {brl(order.unitPrice)}
              </small>
            </span>
          </div>
          <dl>
            <div>
              <dt>Produtor</dt>
              <dd>{producer?.name}</dd>
            </div>
            <div>
              <dt>Retirada</dt>
              <dd>
                {store?.name}
                <small>{store?.address}</small>
              </dd>
            </div>
          </dl>
          <div className="checkout-total">
            <span>Total</span>
            <strong>{brl(total)}</strong>
          </div>
          <p className="checkout-deadline">
            Pague em até {PRAZO_PAGAMENTO_MINUTOS} minutos. Depois disso o pedido é cancelado e o
            estoque volta para a vitrine.
          </p>
          <Button variant="secondary" className="full" locks onClick={cancel}>
            Cancelar pedido
          </Button>
        </aside>
      </div>
    </div>
  );
}
