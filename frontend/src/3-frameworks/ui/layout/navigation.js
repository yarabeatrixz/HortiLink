import {
  BadgePercent,
  Building2,
  HandCoins,
  Settings,
  BarChart3,
  Boxes,
  CheckCircle2,
  Clock3,
  MapPin,
  PackageCheck,
  Sprout,
  Store,
  Wallet,
  Warehouse,
} from "lucide-react";

/** Abas do menu por perfil: a primeira é a inicial. */
export const NAV = {
  produtor: [
    { id: "catalogo", label: "Catálogo", icon: Boxes },
    { id: "estoque", label: "Estoque", icon: Warehouse },
    { id: "ofertas", label: "Ofertas", icon: BadgePercent },
    { id: "pontos-retirada", label: "Pontos de retirada", icon: MapPin },
    { id: "vendas", label: "Minhas vendas", icon: PackageCheck },
    { id: "status-pedidos", label: "Atualizar status", icon: CheckCircle2 },
    { id: "custos", label: "Custos", icon: Wallet },
    { id: "relatorios", label: "Relatórios", icon: BarChart3 },
  ],
  comprador: [
    { id: "ofertas", label: "Ofertas", icon: BadgePercent },
    { id: "produtores", label: "Produtores", icon: Sprout },
    { id: "compras", label: "Minhas compras", icon: PackageCheck },
    { id: "acompanhar", label: "Acompanhar", icon: Clock3 },
  ],
  loja: [
    { id: "ponto", label: "Meu ponto", icon: Store },
    { id: "pedidos", label: "Pedidos", icon: PackageCheck },
    { id: "recompensas", label: "Recompensas", icon: HandCoins },
  ],
  admin: [
    { id: "lojas", label: "Pontos de coleta", icon: Building2 },
    { id: "recompensas", label: "Recompensas", icon: HandCoins },
  ],
};

/** Aba de configurações do perfil, presente em todos os perfis (GER-01). */
export const ABA_PERFIL = { id: "perfil", label: "Meu perfil", icon: Settings };
