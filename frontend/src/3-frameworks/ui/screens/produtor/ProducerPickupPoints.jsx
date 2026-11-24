import { useState } from "react";
import { km, lojasAprovadas } from "@hortilink/dominio";
import { Button } from "../../components/base/Button";
import { ErrorMessage } from "../../components/base/ErrorMessage";
import { PageTitle } from "../../components/base/PageTitle";
import { StoreDetails } from "../../components/pickup/StoreDetails";
import { SelectedStoreChips, StoreFinder } from "../../components/pickup/StoreFinder";
import { useNearbyStores } from "../../components/pickup/useNearbyStores";
import { useApp } from "../../state/AppProvider";

/** Pontos onde compradores retiram produtos do catálogo (ofertas têm seleção própria). */
export function ProducerPickupPoints() {
  const { currentUser, stores, saveProducerPickupStores } = useApp();
  const selected = currentUser.pickupStoreIds ?? [];
  // Só pontos aprovados pelo administrador podem ser escolhidos (US14).
  const finder = useNearbyStores(lojasAprovadas({ stores }));
  const [error, setError] = useState("");

  const toggleStore = async (storeId) => {
    const next = selected.includes(storeId)
      ? selected.filter((item) => item !== storeId)
      : [...selected, storeId];
    try {
      await saveProducerPickupStores(next);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="LOJAS PARCEIRAS"
        title="Pontos de retirada"
        description="Busque e escolha os pontos de retirada disponíveis para seus compradores."
      />
      <section className="pickup-picker pickup-points-page">
        <div className="pickup-picker-head">
          <div>
            <span className="eyebrow">PONTOS ESCOLHIDOS</span>
            <h3>Meus pontos selecionados</h3>
          </div>
          <span>{selected.length} selecionado(s)</span>
        </div>
        <SelectedStoreChips stores={stores} selectedIds={selected} onRemove={toggleStore} />
        <StoreFinder finder={finder} userCity={currentUser.city} />
        <ErrorMessage>{error}</ErrorMessage>
        <div className="nearby-list pickup-results">
          {finder.visibleStores.map((store) => {
            const isSelected = selected.includes(store.id);
            return (
              <article
                className={isSelected ? "nearby-store selected" : "nearby-store"}
                key={store.id}
              >
                <StoreDetails store={store} />
                <strong>{km(store.distance)}</strong>
                <Button
                  type="button"
                  locks
                  variant={isSelected ? "primary" : "secondary"}
                  aria-pressed={isSelected}
                  onClick={() => toggleStore(store.id)}
                >
                  {isSelected ? "✓ Selecionado" : "Selecionar"}
                </Button>
              </article>
            );
          })}
          {!finder.visibleStores.length && (
            <div className="no-stores">Nenhum ponto de retirada encontrado.</div>
          )}
        </div>
      </section>
    </>
  );
}
