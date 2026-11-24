import { ChevronRight, MapPin } from "lucide-react";
import { useState } from "react";
import { CATEGORIAS, brl, inicial } from "@hortilink/dominio";
import { Button } from "../../components/base/Button";
import { EmptyState } from "../../components/base/EmptyState";
import { PageTitle } from "../../components/base/PageTitle";
import { SearchBox } from "../../components/base/SearchBox";
import { ProductImage } from "../../components/ProductImage";
import { useApp } from "../../state/AppProvider";

export function ProducersCatalog({ open }) {
  const { products, users } = useApp();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const termo = search.trim().toLowerCase();
  const filtered = products.filter(
    (product) =>
      product.name.toLowerCase().includes(termo) &&
      (category === "Todas" || product.category === category),
  );
  // COMP-01: o produtor aparece pelo catálogo dele, mesmo que o perfil não tenha
  // vindo do banco (aí mostra "Produtor parceiro" em vez de sumir com os produtos).
  const producers = [...new Set(filtered.map((product) => product.producerId))].map(
    (producerId) =>
      users.find((user) => user.id === producerId) ?? {
        id: producerId,
        name: "Produtor parceiro",
        city: "Alto Tietê",
      },
  );

  return (
    <>
      <PageTitle
        eyebrow="CATÁLOGOS"
        title="Conheça os produtores"
        description="Consulte todos os produtos disponíveis na produção regional."
      />
      <div className="catalog-tools">
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar produto..." />
        <select
          aria-label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option>Todas</option>
          {CATEGORIAS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      {producers.map((producer) => (
        <section className="producer-section" key={producer.id}>
          <div className="producer-head">
            <span>{inicial(producer.name)}</span>
            <div>
              <h3>{producer.name}</h3>
              <p>
                <MapPin size={13} aria-hidden="true" />
                {producer.city}
              </p>
            </div>
            <Button variant="secondary" onClick={() => open(producer.id)}>
              Ver perfil <ChevronRight size={15} aria-hidden="true" />
            </Button>
          </div>
          <div className="producer-products">
            {filtered
              .filter((product) => product.producerId === producer.id)
              .map((product) => (
                <article key={product.id}>
                  <ProductImage product={product} />
                  <div>
                    <small>{product.category}</small>
                    <h4>{product.name}</h4>
                    <b>
                      {brl(product.price)} / {product.unit}
                    </b>
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
      {!producers.length && <EmptyState title="Nenhum produto encontrado" />}
    </>
  );
}
