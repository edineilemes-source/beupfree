import { Search, User, Heart, ShoppingCart, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { NEON, DARK, DARK_NAV, alpha } from "@/lib/brand";
import logoUrl from "@assets/logo_uppulse_hd_transparent.png";
import FavoritesDrawer from "@/components/FavoritesDrawer";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import AuthDialog from "@/components/AuthDialog";

const SEARCH_BORDER = "hsl(160 55% 38%)";

const NAV: { label: string; href: string }[] = [
  { label: "Masculino", href: "/catalogo?genero=Masculino" },
  { label: "Feminino", href: "/catalogo?genero=Feminino" },
  { label: "Infantil", href: "/catalogo?idade=Infantil" },
  { label: "Acessórios", href: "/catalogo?tipo=Acessórios" },
  { label: "Marcas", href: "/catalogo" },
];

export default function Header() {
  const { favorites } = useFavorites();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(search);
  const officialQuery = searchParams.get("busca");
  const urlQuery = officialQuery?.trim()
    ? officialQuery
    : searchParams.get("q") ?? "";
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "register">("login");

  // Mantém o campo em sincronia quando a busca é limpa/alterada pela URL
  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const openRegister = () => { setAuthInitialMode("register"); setAuthOpen(true); };
    window.addEventListener("beupfree:open-auth-register", openRegister);
    return () => window.removeEventListener("beupfree:open-auth-register", openRegister);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    // Preserva filtros já ativos na URL (marca, gênero etc.) ao buscar.
    const params = new URLSearchParams(search);
    if (q) {
      params.set("busca", q);
    } else {
      params.delete("busca");
    }
    params.delete("q");
    const qs = params.toString();
    setLocation(qs ? `/catalogo?${qs}` : "/catalogo");
  };

  return (
    <header className="sticky top-0 z-50">
      {/* Main header */}
      <div className="relative overflow-hidden" style={{ backgroundColor: DARK }}>
        {/* diagonal green streaks */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: `linear-gradient(115deg, transparent 50%, ${alpha(NEON, 0.08)} 54%, transparent 58%), linear-gradient(115deg, transparent 66%, ${alpha(NEON, 0.06)} 70%, transparent 74%), linear-gradient(115deg, transparent 82%, ${alpha(NEON, 0.05)} 86%, transparent 90%)`,
          }}
        />
        <div className="relative flex w-full flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
          {/* Logo */}
          <Link href="/">
            <div
              className="flex flex-shrink-0 cursor-pointer items-center"
              data-testid="link-logo"
            >
              <img
                src={logoUrl}
                alt="UpPulse - Tênis esportivos em promoção"
                className="h-24 w-auto sm:h-32 md:h-40"
                data-testid="img-logo"
              />
            </div>
          </Link>

          {/* Search */}
          <form
            onSubmit={submitSearch}
            className="relative order-last w-full min-w-0 flex-1 md:order-none md:w-auto md:max-w-[440px]"
          >
            <Input
              type="search"
              aria-label="Buscar tênis"
              placeholder="Buscar tênis..."
              className="h-11 w-full rounded-full border bg-white/5 pl-5 pr-12 text-white placeholder:text-white/50"
              style={{ borderColor: SEARCH_BORDER }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-4 top-1/2 -translate-y-1/2"
              data-testid="button-search"
            >
              <Search className="h-5 w-5" style={{ color: NEON }} />
            </button>
          </form>

          {/* Account / Favorites / Cart */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-3 text-white sm:gap-5">
            {isLoading ? (
              <div className="flex min-w-[54px] flex-col items-center gap-1 px-2 py-1" aria-live="polite">
                <User className="h-6 w-6 opacity-50" />
                <span className="sr-only">Verificando sessão</span>
                <span aria-hidden="true" className="h-3 w-10 animate-pulse rounded bg-white/20" />
              </div>
            ) : isAuthenticated ? (
              <div className="flex items-center gap-1">
                <div className="flex max-w-28 flex-col items-center gap-1 px-1 py-1" data-testid="item-usuario">
                  <User className="h-6 w-6" />
                  <span className="max-w-full truncate text-[11px] font-medium" title={user?.name}>
                    Olá, {user?.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-md px-2 py-1 text-xs font-medium hover-elevate active-elevate-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  data-testid="button-sair"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setAuthInitialMode("login"); setAuthOpen(true); }}
                className="flex flex-col items-center gap-1 rounded-md px-2 py-1 hover-elevate active-elevate-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                data-testid="item-entrar"
              >
                <User className="h-6 w-6" />
                <span className="text-[11px] font-medium">Entrar</span>
              </button>
            )}
            <button
              type="button"
              aria-label={`Abrir Favoritos, ${favorites.length} ${favorites.length === 1 ? "produto salvo" : "produtos salvos"}`}
              onClick={() => setFavoritesOpen(true)}
              className="flex flex-col items-center gap-1 rounded-md px-2 py-1 hover-elevate active-elevate-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              data-testid="item-favoritos"
            >
              <span className="relative">
                <Heart className="h-6 w-6" />
                <span
                  className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-black"
                  style={{ backgroundColor: NEON }}
                  data-testid="text-favorites-count"
                >
                  {favorites.length}
                </span>
              </span>
              <span className="text-[11px] font-medium">Favoritos</span>
            </button>
            <div
              className="flex flex-col items-center gap-1 px-2 py-1"
              data-testid="item-carrinho"
            >
              <span className="relative">
                <ShoppingCart className="h-6 w-6" />
                <span
                  className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-black"
                  style={{ backgroundColor: NEON }}
                  data-testid="text-cart-count"
                >
                  0
                </span>
              </span>
              <span className="text-[11px] font-medium">Carrinho</span>
            </div>
            <Link href="/admin/triagem">
              <div
                className="flex cursor-pointer flex-col items-center gap-1 rounded-md px-2 py-1 hover-elevate active-elevate-2"
                data-testid="link-curadoria"
              >
                <Settings className="h-6 w-6" />
                <span className="text-[11px] font-medium">Curadoria</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Dark green nav */}
      <nav style={{ backgroundColor: DARK_NAV }}>
        <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-3 text-[13px] font-semibold uppercase tracking-wide sm:justify-between sm:gap-x-4 md:px-8">
          {NAV.map((item) => (
            <Link key={item.label} href={item.href}>
              <span
                className="cursor-pointer text-white/85"
                data-testid={`link-${item.label.toLowerCase()}`}
              >
                {item.label}
              </span>
            </Link>
          ))}
          <Link href="/catalogo">
            <span
              className="cursor-pointer"
              style={{ color: NEON }}
              data-testid="link-ofertas"
            >
              % Desconto
            </span>
          </Link>
        </div>
      </nav>
      <FavoritesDrawer open={favoritesOpen} onOpenChange={setFavoritesOpen} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authInitialMode} />
    </header>
  );
}
