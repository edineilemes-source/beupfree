import { Search, User, Heart, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Link } from "wouter";
import { NEON, DARK, DARK_NAV, alpha } from "@/lib/brand";
import logoUrl from "@assets/logo_UpPulse_transparent.png";

const SEARCH_BORDER = "hsl(160 55% 38%)";

const NAV: { label: string; href: string }[] = [
  { label: "Masculino", href: "/catalogo?genero=Masculino" },
  { label: "Feminino", href: "/catalogo?genero=Feminino" },
  { label: "Infantil", href: "/catalogo?idade=Infantil" },
  { label: "Acessórios", href: "/catalogo?tipo=Acessórios" },
  { label: "Marcas", href: "/catalogo" },
];

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");

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
        <div className="container relative mx-auto flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
          {/* Logo */}
          <Link href="/">
            <div
              className="flex flex-shrink-0 cursor-pointer items-center"
              data-testid="link-logo"
            >
              <img
                src={logoUrl}
                alt="UpPulse - Tênis esportivos em promoção"
                className="h-14 w-auto sm:h-16"
                data-testid="img-logo"
              />
            </div>
          </Link>

          {/* Search */}
          <div className="relative order-last w-full min-w-0 flex-1 md:order-none md:w-auto md:max-w-[440px]">
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
            <Search
              className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/80"
              style={{ color: NEON }}
            />
          </div>

          {/* Account / Favorites / Cart */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-3 text-white sm:gap-5">
            <div
              className="flex flex-col items-center gap-1 px-2 py-1"
              data-testid="item-entrar"
            >
              <User className="h-6 w-6" />
              <span className="text-[11px] font-medium">Entrar</span>
            </div>
            <div
              className="flex flex-col items-center gap-1 px-2 py-1"
              data-testid="item-favoritos"
            >
              <Heart className="h-6 w-6" />
              <span className="text-[11px] font-medium">Favoritos</span>
            </div>
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
          </div>
        </div>
      </div>

      {/* Dark green nav */}
      <nav style={{ backgroundColor: DARK_NAV }}>
        <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-3 text-[13px] font-semibold uppercase tracking-wide sm:justify-between sm:gap-x-4 md:px-8">
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
    </header>
  );
}
