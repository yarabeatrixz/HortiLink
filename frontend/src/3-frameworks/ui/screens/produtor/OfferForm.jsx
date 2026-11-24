import { useState } from "react";
import { brl, km, lojasAprovadas } from "@hortilink/dominio";
import { Button } from "../../components/base/Button";
import { ErrorMessage } from "../../components/base/ErrorMessage";
import { Field } from "../../components/base/Field";
import { FormPage } from "../../components/FormPage";
import { StoreDetails } from "../../components/pickup/StoreDetails";
import { SelectedStoreChips, StoreFinder } from "../../components/pickup/StoreFinder";
import { useNearbyStores } from "../../components/pickup/useNearbyStores";
import { useApp } from "../../state/AppProvider";

export function OfferForm({ id, back }) {
  const { currentUser, products, stores, addOffer } = useApp();
  const catalog = products.filter((product) => product.producerId === currentUser.id);
  const [form, setForm] = useState({
    productId: id ?? catalog[0]?.id ?? "",
    quantity: "",
    promotionalPrice: "",
    city: currentUser.city,
    validityDays: 2,
    storeIds: [],
  });
  const [error, setError] = useState("");
  const finder = useNearbyStores(lojasAprovadas({ stores }));
  const product = catalog.find((item) => item.id === form.productId);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const toggleStore = (storeId) =>
    setForm((current) => ({
      ...current,
      storeIds: current.storeIds.includes(storeId)
        ? current.storeIds.filter((item) => item !== storeId)
        : [...current.storeIds, storeId],
    }));

  const submit = async (event) => {
    event.preventDefault();
    try {
      await addOffer(form);
      back();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <FormPage title="Criar oferta promocional" back={back}>
      <form onSubmit={submit}>
        <Field label="Produto do catálogo">
          <select value={form.productId} onChange={set("productId")}>
            {catalog.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        {product && (
          <div className="normal-price">
            <span>Preço normal</span>
            <s>{brl(product.price)}</s>
            <small>
              Estoque disponível: {product.quantity} {product.unit}
            </small>
          </div>
        )}
        <div className="two-cols">
          <Field
            label="Quantidade da oferta"
            type="number"
            min="0"
            value={form.quantity}
            onChange={set("quantity")}
          />
          <Field
            label="Preço promocional"
            type="number"
            min="0"
            step="0.01"
            value={form.promotionalPrice}
            onChange={set("promotionalPrice")}
          />
        </div>
        <div className="two-cols">
          <Field label="Cidade" value={form.city} onChange={set("city")} />
          <Field
            label="Validade em dias"
            type="number"
            min="1"
            value={form.validityDays}
            onChange={set("validityDays")}
          />
        </div>
        <fieldset className="pickup-picker">
          <div className="pickup-picker-head">
            <div>
              <span className="eyebrow">PONTOS DE RETIRADA</span>
              <legend>
                <h3>Onde os pedidos poderão ser retirados?</h3>
              </legend>
            </div>
            <span>{form.storeIds.length} selecionado(s)</span>
          </div>
          <SelectedStoreChips stores={stores} selectedIds={form.storeIds} onRemove={toggleStore} />
          <StoreFinder finder={finder} userCity={currentUser.city} />
          <div className="nearby-list">
            {finder.visibleStores.map((store) => {
              const selected = form.storeIds.includes(store.id);
              return (
                <label
                  className={selected ? "nearby-store selected" : "nearby-store"}
                  key={store.id}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleStore(store.id)}
                  />
                  <StoreDetails store={store} />
                  <strong>{km(store.distance)}</strong>
                </label>
              );
            })}
            {!finder.visibleStores.length && (
              <div className="no-stores">Nenhum ponto de retirada encontrado.</div>
            )}
          </div>
        </fieldset>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="form-actions">
          <Button variant="ghost" type="button" onClick={back}>
            Cancelar
          </Button>
          <Button type="submit">Publicar oferta</Button>
        </div>
      </form>
    </FormPage>
  );
}
