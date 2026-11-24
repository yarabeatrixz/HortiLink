import { Ban, Building2, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { STATUS_LOJA, capacidadeLoja, dataCurta, ocupacaoLoja } from "@hortilink/dominio";
import { Button } from "../../components/base/Button";
import { EmptyState } from "../../components/base/EmptyState";
import { ErrorMessage } from "../../components/base/ErrorMessage";
import { PageTitle } from "../../components/base/PageTitle";
import { SearchBox } from "../../components/base/SearchBox";
import { SuccessMessage } from "../../components/base/SuccessMessage";
import { StatusBadge } from "../../components/StatusBadge";
import { useApp } from "../../state/AppProvider";

const FILTROS = ["Todas", ...Object.values(STATUS_LOJA)];
const TOM = {
  [STATUS_LOJA.APROVADA]: "accepted",
  [STATUS_LOJA.PENDENTE]: "waiting",
  [STATUS_LOJA.REPROVADA]: "rejected",
  [STATUS_LOJA.SUSPENSA]: "rejected",
};

/** Um ponto de coleta com as decisões do administrador. */
function LojaParaAvaliar({ store, owner, orders, onDone }) {
  const { reviewStore } = useApp();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const capacidade = capacidadeLoja(store);
  const ocupacao = ocupacaoLoja({ orders }, store.id);

  const decidir = async (status) => {
    try {
      await reviewStore(store.id, { status, note });
      setError("");
      setNote("");
      onDone(`${store.name}: ${status.toLowerCase()}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <article className="admin-store-card">
      <div className="admin-store-photo">
        {store.photo ? (
          <img src={store.photo} alt={`Foto de ${store.name}`} />
        ) : (
          <Building2 size={30} aria-hidden="true" />
        )}
      </div>
      <div className="admin-store-info">
        <StatusBadge status={store.status} tone={TOM[store.status]} />
        <h3>{store.name}</h3>
        <p>
          {store.address} · {store.city}
        </p>
        <p>{store.hours}</p>
        <p>
          Responsável: <b>{owner?.name ?? "—"}</b>
        </p>
        <p>
          Capacidade: <b>{store.dryBoxes}</b> caixas secas · <b>{store.coldBoxes}</b> refrigeradas
          {capacidade > 0 ? ` · ocupação ${ocupacao}/${capacidade}` : " · não informada"}
        </p>
        {store.reviewNote && (
          <p className="review-note">
            Motivo registrado{store.reviewedAt ? ` em ${dataCurta(store.reviewedAt)}` : ""}:{" "}
            {store.reviewNote}
          </p>
        )}
      </div>
      <div className="admin-store-actions">
        <label className="field">
          <span>Motivo (obrigatório para reprovar ou suspender)</span>
          <input
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: endereço não confere"
          />
        </label>
        <div>
          {store.status !== STATUS_LOJA.APROVADA && (
            <Button icon={CheckCircle2} locks onClick={() => decidir(STATUS_LOJA.APROVADA)}>
              Aprovar
            </Button>
          )}
          {store.status === STATUS_LOJA.PENDENTE && (
            <Button variant="secondary" icon={XCircle} locks onClick={() => decidir(STATUS_LOJA.REPROVADA)}>
              Reprovar
            </Button>
          )}
          {store.status === STATUS_LOJA.APROVADA && (
            <Button variant="danger" icon={Ban} locks onClick={() => decidir(STATUS_LOJA.SUSPENSA)}>
              Suspender
            </Button>
          )}
        </div>
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    </article>
  );
}

/** US14: o administrador julga se a loja é apta a ser ponto de coleta. */
export function AdminStores() {
  const { stores, users, orders } = useApp();
  const [filter, setFilter] = useState(STATUS_LOJA.PENDENTE);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const termo = search.trim().toLowerCase();
  const list = stores.filter(
    (store) =>
      (filter === "Todas" || store.status === filter) &&
      (!termo || `${store.name} ${store.city}`.toLowerCase().includes(termo)),
  );
  const pendentes = stores.filter((store) => store.status === STATUS_LOJA.PENDENTE).length;

  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRAÇÃO"
        title="Pontos de coleta"
        description={
          pendentes
            ? `${pendentes} ponto(s) aguardando avaliação.`
            : "Nenhum ponto aguardando avaliação."
        }
      />
      <div className="filter-row" role="group" aria-label="Filtrar pontos de coleta">
        {FILTROS.map((item) => (
          <button
            type="button"
            key={item}
            className={filter === item ? "active" : ""}
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <SearchBox value={search} onChange={setSearch} placeholder="Buscar por nome ou cidade" />
      {message && <SuccessMessage>{message}</SuccessMessage>}
      {list.length ? (
        <div className="admin-store-list">
          {list.map((store) => (
            <LojaParaAvaliar
              key={store.id}
              store={store}
              owner={users.find((user) => user.id === store.userId)}
              orders={orders}
              onDone={setMessage}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={Building2} title="Nenhum ponto de coleta neste filtro" />
      )}
    </>
  );
}
