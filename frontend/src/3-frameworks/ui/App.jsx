import { casosDeUso, modoDemo } from "../../composition";
import { Shell } from "./layout/Shell";
import { Auth } from "./screens/Auth";
import { AppProvider, useApp } from "./state/AppProvider";

function Root() {
  const { currentUser } = useApp();
  return currentUser ? <Shell /> : <Auth mostrarContasDemo={modoDemo} />;
}

export default function App() {
  return (
    <AppProvider casosDeUso={casosDeUso}>
      <Root />
    </AppProvider>
  );
}
