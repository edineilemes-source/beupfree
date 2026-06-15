import { Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Link } from "wouter";
import { NEON, DARK_NAV, RUNNER_PATH } from "@/lib/brand";

const NAV = ["Masculino", "Feminino", "Infantil", "Acessórios"];

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="sticky top-0 z-50 bg-background">
      {/* Top promo bar */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-4 py-1.5 text-center text-xs">
          <span>Peça o tênis que mais combina com você.</span>
          <span className="opacity-40">|</span>
          <span className="font-semibold">Parceiro Oficial Mercado Livre</span>
        </div>
      </div>

      {/* Main header */}
      <div className="border-b bg-background">
        <div className="container mx-auto flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          {/* Logo */}
          <Link href="/">
            <div
              className="flex flex-shrink-0 items-center gap-2.5 cursor-pointer"
              data-testid="link-logo"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                  <path d={RUNNER_PATH} />
                </svg>
              </span>
              <div className="leading-none">
                <p className="text-[22px] font-extrabold tracking-tight" data-testid="text-logo">
                  <span className="text-foreground">Up</span>
                  <span className="text-primary">Pulse</span>
                </p>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Tênis esportivos em promoção
                </p>
                <p
                  className="text-[8px] font-bold uppercase tracking-[0.14em] text-primary"
                  data-testid="text-by-beupfree"
                >
                  by BeUpFree
                </p>
              </div>
            </div>
          </Link>

          {/* Search */}
          <div className="relative order-last w-full min-w-0 flex-1 md:order-none md:w-auto md:max-w-[560px]">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Buscar tênis"
              placeholder="Buscar tênis, meias, acessórios..."
              className="w-full rounded-full pl-11 pr-4"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>

          {/* Admin */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <Link href="/admin/triagem">
              <Button
                variant="outline"
                size="icon"
                title="Painel Admin"
                data-testid="button-admin"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Dark neon nav */}
      <nav style={{ backgroundColor: DARK_NAV }}>
        <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-1 px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wide">
          {NAV.map((item) => (
            <span
              key={item}
              className="cursor-default select-none text-white/85"
              data-testid={`link-${item.toLowerCase()}`}
            >
              {item}
            </span>
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
