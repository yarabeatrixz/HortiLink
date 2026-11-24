// "Tem uma gravação em andamento?" — lido pelos botões de envio para travar e
// mostrar "Salvando…" (PROD-01 e PROD-03). Fica separado do AppProvider para os
// componentes base funcionarem também fora dele (padrão: false).

import { createContext, useContext } from "react";

export const SalvandoContext = createContext(false);

export const useSalvando = () => useContext(SalvandoContext);
