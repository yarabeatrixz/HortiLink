import { Box, Building2, Clock3, Edit3, MapPin, Snowflake } from "lucide-react";
import { useState } from "react";
import { STATUS_LOJA, capacidadeLoja, ocupacaoLoja } from "@hortilink/dominio";
import { Button } from "../../components/base/Button";
import { ErrorMessage } from "../../components/base/ErrorMessage";
import { Field } from "../../components/base/Field";
import { PageTitle } from "../../components/base/PageTitle";
import { SuccessMessage } from "../../components/base/SuccessMessage";
import { PhotoPicker } from "../../components/PhotoPicker";
import { StatusBadge } from "../../components/StatusBadge";
import { useApp } from "../../state/AppProvider";

const TOM_STATUS = {
  [STATUS_LOJA.APROVADA]: "accepted",
  [STATUS_LOJA.PENDENTE]: "waiting",
  [STATUS_LOJA.REPROVADA]: "rejected",
  [STATUS_LOJA.SUSPENSA]: "rejected",
};

const AVISO_STATUS = {
  [STATUS_LOJA.PENDENTE]:
    "Seu ponto está em análise pela equipe HortiLink. Ele aparece para produtores e compradores depois da aprovação.",
  [STATUS_LOJA.APROVADA]: "Seu ponto está ativo e aparece para produtores e compradores.",
  [STATUS_LOJA.REPROVADA]: "Seu ponto não foi aprovado. Ajuste os dados e salve para uma nova análise.",
  [STATUS_LOJA.SUSPENSA]: "Seu ponto está suspenso e não recebe novos pedidos.",
};

const formularioDe = (loja, cidadePadrao) => ({
  name: loja?.name ?? "",
  address: loja?.address ?? "",
  city: loja?.city ?? cidadePadrao,
  hours: loja?.hours ?? "",
  photo: loja?.photo ?? "",
  dryBoxes: loja?.dryBoxes ?? "",
  coldBoxes: loja?.coldBoxes ?? "",
});

/**
 * Ponto de coleta da loja parceira. Já cadastrado → mostra o ponto, a situação e
 * o botão Editar (LOJA-02: o formulário não reaparece vazio). Foto: LOJA-01.
 */
export function StoreProfile() {
  const { currentUser, stores, orders, saveStore } = useApp();
  const current = stores.find((store) => store.userId === currentUser.id);
  const [editing, setEditing] = useState(!current);
  const [form, setForm] = useState(() => formularioDe(current, currentUser.city));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    try {
      await saveStore(form);
      setError("");
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const view = editing ? form : formularioDe(current, currentUser.city);
  const status = current?.status ?? "Cadastro pendente";
  const capacidade = current ? capacidadeLoja(current) : 0;

  return (
    <>
      <PageTitle
        eyebrow="LOJA PARCEIRA"
        title="Meu ponto de coleta"
        description="Mantenha os dados que serão exibidos aos produtores e compradores."
        action={
          current &&
          !editing && (
            <Button
              variant="secondary"
              icon={Edit3}
              onClick={() => {
                setForm(formularioDe(current, currentUser.city));
                setSaved(false);
                setEditing(true);
              }}
            >
              Editar dados
            </Button>
          )
        }
      />
      {saved && <SuccessMessage>Ponto de coleta salvo com sucesso</SuccessMessage>}
      <div className="store-layout">
        <div className="store-preview">
          <div className="store-cover">
            {view.photo ? (
              <img src={view.photo} alt={`Foto de ${view.name || "sua loja"}`} />
            ) : (
              <Building2 size={42} aria-hidden="true" />
            )}
          </div>
          <div>
            <StatusBadge status={status} tone={TOM_STATUS[status] ?? "waiting"} />
            <h2>{view.name || "Nome da sua loja"}</h2>
            <p>
              <MapPin size={15} aria-hidden="true" />
              {view.address || "Endereço da loja"} · {view.city}
            </p>
            <p>
              <Clock3 size={15} aria-hidden="true" />
              {view.hours || "Horário de funcionamento"}
            </p>
            <p>
              <Box size={15} aria-hidden="true" />
              {Number(view.dryBoxes) || 0} caixas secas ·{" "}
              <Snowflake size={15} aria-hidden="true" /> {Number(view.coldBoxes) || 0} refrigeradas
            </p>
            {current && capacidade > 0 && (
              <p>
                Ocupação agora: {ocupacaoLoja({ orders }, current.id)} de {capacidade} caixas
              </p>
            )}
          </div>
        </div>

        {editing ? (
          <form className="form-card" onSubmit={submit}>
            <PhotoPicker
              alt="Foto do ponto de coleta"
              preview={
                form.photo ? (
                  <img src={form.photo} alt="Prévia da foto do ponto" />
                ) : (
                  <span className="photo-placeholder">
                    <Building2 size={28} aria-hidden="true" />
                  </span>
                )
              }
              onChange={(photo) => setForm((atual) => ({ ...atual, photo }))}
              onError={setError}
            />
            <Field label="Nome da loja" value={form.name} onChange={set("name")} />
            <Field label="Endereço" value={form.address} onChange={set("address")} />
            <div className="two-cols">
              <Field label="Cidade" value={form.city} onChange={set("city")} />
              <Field label="Horário de funcionamento" value={form.hours} onChange={set("hours")} />
            </div>
            <div className="two-cols">
              <Field
                label="Caixas secas (capacidade)"
                type="number"
                min="0"
                step="1"
                value={form.dryBoxes}
                onChange={set("dryBoxes")}
                placeholder="0"
              />
              <Field
                label="Caixas refrigeradas (capacidade)"
                type="number"
                min="0"
                step="1"
                value={form.coldBoxes}
                onChange={set("coldBoxes")}
                placeholder="0"
              />
            </div>
            <ErrorMessage>{error}</ErrorMessage>
            <div className="form-actions">
              {current && (
                <Button variant="ghost" type="button" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              )}
              <Button type="submit">Salvar ponto de coleta</Button>
            </div>
          </form>
        ) : (
          <div className="form-card store-status-card">
            <h3>Situação: {status}</h3>
            <p>{AVISO_STATUS[status]}</p>
            {current?.reviewNote && (
              <p className="review-note">
                <b>Motivo informado pela HortiLink:</b> {current.reviewNote}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
