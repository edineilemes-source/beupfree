import { Search, ShoppingCart, Menu, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import logoImage from "@assets/Photoroom-20251213_085728_1765685713469.png";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 bg-background border-b">
      <div className="bg-primary text-primary-foreground py-2 px-4 text-center text-sm font-medium">
        Frete Grátis em compras acima de R$ 299 | Parceiro Oficial Mercado Livre
      </div>
      
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              data-testid="button-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer" data-testid="link-logo">
                <img 
                  src={logoImage} 
                  alt="BeUpFree Logo" 
                  className="h-10 w-auto"
                />
                <div className="flex flex-col">
                  <span className="text-xl font-bold tracking-tight text-primary" data-testid="text-logo">
                    BeUpFree
                  </span>
                  <span className="text-[10px] text-muted-foreground -mt-1 hidden sm:block">
                    Liberte sua performance
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <div className="flex-1 max-w-xl hidden md:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar tênis, meias, acessórios..."
                className="pl-10 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              data-testid="button-account"
            >
              <User className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              data-testid="button-cart"
            >
              <ShoppingCart className="h-5 w-5" />
            </Button>
            <Link href="/triagem">
              <Button 
                variant="outline" 
                size="icon"
                title="Triagem - Painel Gerencial"
                data-testid="button-triagem"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-3 md:hidden">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar tênis, meias, acessórios..."
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-mobile"
            />
          </div>
        </div>
      </div>

      <nav className="border-t hidden lg:block bg-muted/30">
        <div className="container mx-auto px-4">
          <ul className="flex items-center gap-8 py-3 text-sm font-medium">
            <li>
              <Link href="/catalogo?categoria=tenis">
                <span className={`hover-elevate px-3 py-2 rounded-md cursor-pointer ${location.includes('catalogo') ? 'bg-primary/10 text-primary' : ''}`} data-testid="link-tenis">
                  Tênis
                </span>
              </Link>
            </li>
            <li>
              <Link href="/catalogo?categoria=meias">
                <span className="hover-elevate px-3 py-2 rounded-md cursor-pointer" data-testid="link-meias">
                  Meias
                </span>
              </Link>
            </li>
            <li>
              <Link href="/catalogo?categoria=acessorios">
                <span className="hover-elevate px-3 py-2 rounded-md cursor-pointer" data-testid="link-acessorios">
                  Acessórios
                </span>
              </Link>
            </li>
            <li>
              <Link href="/catalogo?marcas=todas">
                <span className="hover-elevate px-3 py-2 rounded-md cursor-pointer" data-testid="link-marcas">
                  Marcas
                </span>
              </Link>
            </li>
            <li>
              <Link href="/catalogo?ofertas=true">
                <span className="text-accent-foreground bg-accent/80 hover-elevate px-3 py-2 rounded-md cursor-pointer font-semibold" data-testid="link-ofertas">
                  Ofertas
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
