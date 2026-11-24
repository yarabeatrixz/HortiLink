import { BadgePercent, Edit3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { brl } from "@hortilink/dominio";
import { Button } from "../../components/base/Button";
import { ConfirmModal } from "../../components/base/ConfirmModal";
import { EmptyState } from "../../components/base/EmptyState";
import { ErrorMessage } from "../../components/base/ErrorMessage";
import { PageTitle } from "../../components/base/PageTitle";
import { LowStockAlert } from "../../components/LowStockAlert";
import { ProductImage } from "../../components/ProductImage";
import { useApp } from "../../state/AppProvider";

export function ProducerCatalog({ create, edit, offer, openStock }) {
  const { currentUser, products, deleteProducts } = useApp();
  /** Produtos a excluir: um (lixeira do card) ou vários (seleção, PROD-02). */
  const [toDelete, setToDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const list = products.filter((product) => product.producerId === currentUser.id);
  const selecionados = list.filter((product) => selected.includes(product.id));
  const todosMarcados = list.length > 0 && selecionados.length === list.length;

  const toggle = (id) =>
    setSelected((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]));

  const confirmDelete = async () => {
    try {
      await deleteProducts(toDelete.map((product) => product.id));
      setSelected((atual) => atual.filter((id) => !toDelete.some((product) => product.id === id)));
      setError("");
    } catch (err) {
      setError(err.message);
    }
    setToDelete(null);
  };

  return (
    <>
      <PageTitle
        eyebrow="MEUS PRODUTOS"
        title="Catálogo da produção"
        description="Organize seus produtos e transforme o estoque em ofertas promocionais."
        action={
          <Button icon={Plus} onClick={create}>
            Cadastrar produto
          </Button>
        }
      />
      <LowStockAlert
        products={list}
        action={
          <Button variant="secondary" onClick={openStock}>
            Ver estoque
          </Button>
        }
      />
      <ErrorMessage>{error}</ErrorMessage>
      {list.length > 0 && (
        <div className="bulk-bar">
          <label>
            <input
              type="checkbox"
              checked={todosMarcados}
              onChange={() => setSelected(todosMarcados ? [] : list.map((product) => product.id))}
            />
            Selecionar todos
          </label>
          <Button
            variant="danger"
            icon={Trash2}
            disabled={!selecionados.length}
            onClick={() => setToDelete(selecionados)}
          >
            Excluir selecionados ({selecionados.length})
          </Button>
        </div>
      )}
      {list.length ? (
        <div className="product-grid">
          {list.map((product) => {
            const marcado = selected.includes(product.id);
            return (
              <article className={marcado ? "product-card selected" : "product-card"} key={product.id}>
                <div className="product-image">
                  <ProductImage product={product} />
                  <span>{product.category}</span>
                  <label className="product-select">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => toggle(product.id)}
                      aria-label={`Selecionar ${product.name}`}
                    />
                  </label>
                </div>
                <div className="product-body">
                  <h3>{product.name}</h3>
                  <p className="stock">
                    {product.quantity} {product.unit} disponíveis
                  </p>
                  <div className="product-price">
                    <strong>{brl(product.price)}</strong>
                    <small>/ {product.unit}</small>
                  </div>
                  <div className="card-actions">
                    <Button variant="secondary" icon={Edit3} onClick={() => edit(product.id)}>
                      Editar
                    </Button>
                    <Button icon={BadgePercent} onClick={() => offer(product.id)}>
                      Criar oferta
                    </Button>
                    <button
                      className="icon-danger"
                      aria-label={`Excluir ${product.name}`}
                      title="Excluir"
                      onClick={() => setToDelete([product])}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Seu catálogo está vazio"
          text="Cadastre o primeiro produto da sua produção."
        />
      )}
      {toDelete && (
        <ConfirmModal
          icon={Trash2}
          danger
          title={toDelete.length === 1 ? "Excluir produto" : `Excluir ${toDelete.length} produtos`}
          confirmLabel="Excluir"
          onConfirm={confirmDelete}
          onClose={() => setToDelete(null)}
        >
          {toDelete.length === 1 ? (
            <>
              Excluir <b>{toDelete[0].name}</b>?
            </>
          ) : (
            <>
              Excluir <b>{toDelete.map((product) => product.name).join(", ")}</b>?
            </>
          )}{" "}
          As ofertas desses produtos também serão removidas.
        </ConfirmModal>
      )}
    </>
  );
}
