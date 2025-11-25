import { Search, ShoppingCart, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="sticky top-0 z-50 bg-background border-b">
      <div className="bg-primary text-primary-foreground py-2 px-4 text-center text-sm font-medium">
        Frete Grátis em compras acima de R$ 299 | Parceiro Oficial Mercado Livre
      </div>
      
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              data-testid="button-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-primary" data-testid="text-logo">
              SportsFoot
            </h1>
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
          </div>
        </div>

        <div className="mt-4 md:hidden">
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

      <nav className="border-t hidden lg:block">
        <div className="container mx-auto px-4">
          <ul className="flex items-center gap-8 py-3 text-sm font-medium">
            <li>
              <a href="#tenis" className="hover-elevate px-3 py-2 rounded-md" data-testid="link-tenis">
                Tênis
              </a>
            </li>
            <li>
              <a href="#meias" className="hover-elevate px-3 py-2 rounded-md" data-testid="link-meias">
                Meias
              </a>
            </li>
            <li>
              <a href="#acessorios" className="hover-elevate px-3 py-2 rounded-md" data-testid="link-acessorios">
                Acessórios
              </a>
            </li>
            <li>
              <a href="#marcas" className="hover-elevate px-3 py-2 rounded-md" data-testid="link-marcas">
                Marcas
              </a>
            </li>
            <li>
              <a href="#ofertas" className="text-destructive hover-elevate px-3 py-2 rounded-md" data-testid="link-ofertas">
                Ofertas
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
