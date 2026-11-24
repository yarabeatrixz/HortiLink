// Layout autenticado: menu lateral (desktop), barra inferior (celular) e
// roteamento simples por estado: `tab` = aba do menu; `route` = tela aberta
// por cima da aba (formulário, detalhe, checkout...). Sem lib de rotas por ora.

import { LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { inicial, nomePerfil } from "@hortilink/dominio";
import { Logo } from "../components/Logo";
import { useApp } from "../state/AppProvider";
import { ABA_PERFIL, NAV } from "./navigation";
import { RouteScreen, TabScreen } from "./routes";

export function Shell() {
  const { currentUser, logout, saving } = useApp();
  const abas = [...NAV[currentUser.role], ABA_PERFIL];
  const [tab, setTab] = useState(abas[0].id);
  const [route, setRoute] = useState(null);

  const abrirAba = (id) => {
    setTab(id);
    setRoute(null);
  };
  const perfil = nomePerfil(currentUser.role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav aria-label="Menu principal">
          <small>MENU PRINCIPAL</small>
          {abas.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={!route && tab === id ? "active" : ""}
              aria-current={!route && tab === id ? "page" : undefined}
              onClick={() => abrirAba(id)}
            >
              <Icon size={19} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <div className="side-profile">
          <span>{inicial(currentUser.name)}</span>
          <div>
            <b>{currentUser.name}</b>
            <small>{perfil}</small>
          </div>
          <button aria-label="Sair" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-mobile">
            <Logo compact />
          </div>
          <div className="topbar-title">
            <small>HORTILINK ALTO TIETÊ</small>
            <b>{perfil}</b>
          </div>
          <div className="top-user">
            <span>
              <UserRound size={17} aria-hidden="true" />
            </span>
            <div>
              <b>{currentUser.name}</b>
              <small>{currentUser.city}</small>
            </div>
            <button onClick={logout}>
              <LogOut size={17} aria-hidden="true" /> Sair
            </button>
          </div>
        </header>
        {saving && (
          <div className="saving-bar" role="status">
            Salvando…
          </div>
        )}
        <main className="content">
          {route ? (
            <RouteScreen route={route} setRoute={setRoute} abrirAba={abrirAba} />
          ) : (
            <TabScreen role={currentUser.role} tab={tab} setRoute={setRoute} abrirAba={abrirAba} />
          )}
        </main>
        {!route && (
          <nav className="bottom-nav" aria-label="Menu principal (celular)">
            {abas.map(({ id, label, icon: Icon }) => (
              <button key={id} className={tab === id ? "active" : ""} onClick={() => abrirAba(id)}>
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
