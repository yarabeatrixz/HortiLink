import { Check } from "lucide-react";
import { useState } from "react";
import { ORIGEM, brl, lojaRecebePedido } from "@hortilink/dominio";
import { Button } from "../../components/base/Button";
import { ErrorMessage } from "../../components/base/ErrorMessage";
import { FormPage } from "../../components/FormPage";
import { ProductImage } from "../../components/ProductImage";
import { StoreDetails } from "../../components/pickup/StoreDetails";
import { useApp } from "../../state/AppProvider";

const ACIMA_DO_DISPONIVEL = "Quantidade acima da disponível";

/** Compra direta de uma oferta (`type="offer"`) ou de um produto do catálogo. */
export function PurchaseForm({ id, type, back, checkout }) {
  const { currentUser, offers, orders, products, stores, users, addOrder } = useApp();
  const offer = type === ORIGEM.OFERTA ? offers.find((item) => item.id === id) : null;
  const product = products.find((item) => item.id === (offer?.productId ?? id));
  const producer = users.find((item) => item.id === product?.producerId);
  const storeIds = offer?.storeIds ?? producer?.pickupStoreIds ?? [];
  // Loja suspensa ou lotada some da escolha (US14 e US15).
  const availableStores = stores.filter(
    (store) => storeIds.includes(store.id) && lojaRecebePedido({ orders }, store),
  );
  const price = offer?.promotionalPrice ?? product?.price ?? 0;
  const available = offer?.quantity ?? product?.quantity ?? 0;
  const [quantity, setQuantity] = useState(1);
  const [storeId, setStoreId] = useState(availableStores[0]?.id ?? "");
  const [error, setError] = useState("");

  if (!product) return null;

  const changeQuantity = (delta) => {
    const next = quantity + delta;
    if (next > available) return setError(ACIMA_DO_DISPONIVEL);
    setQuantity(Math.max(1, next));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      const order = await addOrder({
        type,
        sourceId: id,
        productId: product.id,
        buyerId: currentUser.id,
        quantity,
        storeId,
      });
      checkout(order.id);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <FormPage title="Comprar" back={back}>
      <form onSubmit={submit}>
        <div className="selected-product">
          <ProductImage product={product} />
          <div>
            <small>{offer ? "PRODUTO EM OFERTA" : "PRODUTO DO CATÁLOGO"}</small>
            <h3>{product.name}</h3>
            <p>
              {producer?.name} · {available} {product.unit} disponíveis
            </p>
            <b>
              {brl(price)} / {product.unit}
            </b>
          </div>
        </div>
        <div className="purchase-quantity">
          <div>
            <b>Quantidade</b>
            <small>
              Em {product.unit} · máximo de {available}
            </small>
          </div>
          <div className="stepper">
            <button
              type="button"
              aria-label="Diminuir quantidade"
              onClick={() => changeQuantity(-1)}
            >
              −
            </button>
            <strong aria-live="polite">{quantity}</strong>
            <button
              type="button"
              aria-label="Aumentar quantidade"
              onClick={() => changeQuantity(1)}
            >
              +
            </button>
          </div>
        </div>
        <fieldset className="purchase-stores">
          <legend>
            <b>Ponto de retirada</b>
          </legend>
          <div>
            {!availableStores.length && (
              <p className="no-stores">
                Nenhum ponto de retirada disponível agora para este produto. Tente mais tarde.
              </p>
            )}
            {availableStores.map((store) => (
              <label className={storeId === store.id ? "selected" : ""} key={store.id}>
                <input
                  type="radio"
                  name="pickup-store"
                  value={store.id}
                  checked={storeId === store.id}
                  onChange={() => setStoreId(store.id)}
                />
                <StoreDetails store={store} />
                <i>{storeId === store.id && <Check size={13} aria-hidden="true" />}</i>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="proposal-total">
          <span>Total</span>
          <strong>{brl(quantity * price)}</strong>
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="form-actions">
          <Button variant="ghost" type="button" onClick={back}>
            Cancelar
          </Button>
          <Button type="submit">Ir para pagamento</Button>
        </div>
      </form>
    </FormPage>
  );
}
