import { Search, User, ShoppingCart, ChevronDown } from "lucide-react";
import { FilterSidebar } from "./FilterSidebar";

const GREEN = "hsl(145 70% 35%)";
const GREEN_DARK = "hsl(145 70% 28%)";
const YELLOW = "hsl(48 90% 55%)";

const NAV = ["Tênis", "Meias", "Acessórios", "Marcas", "Ofertas"];

interface Product {
  id: number;
  name: string;
  cat: string;
  img: string;
  was: string;
  now: string;
  off: number;
  freight: boolean;
}

const PRODUCTS: Product[] = [
  { id: 1, name: "Tênis Asics Caminhada Corrida Gel Revelation Treino Preto/Azul 42 Br", cat: "Calçados", img: "/__mockup/images/shoe1.png", was: "289,00", now: "94,04", off: 67, freight: true },
  { id: 2, name: "Tênis Feminino Esportivo Wellness Olympikus Arento Liso 41", cat: "Calçados", img: "/__mockup/images/shoe2.png", was: "199,90", now: "69,74", off: 65, freight: true },
  { id: 3, name: "Tênis Feminino Easy 2 Olympikus Dusty Liso 38 Roxo Combinado 34 Br", cat: "Calçados", img: "/__mockup/images/shoe3.png", was: "229,90", now: "89,24", off: 61, freight: true },
  { id: 4, name: "Tênis Nike Revolution 6 Masculino Corrida Branco/Cinza 41 Br", cat: "Calçados", img: "/__mockup/images/shoe4.png", was: "349,90", now: "104,97", off: 70, freight: true },
  { id: 5, name: "Chuteira Adidas Society Predator Verde/Branco Campo 40 Br", cat: "Calçados", img: "/__mockup/images/shoe5.png", was: "279,90", now: "103,56", off: 63, freight: true },
  { id: 6, name: "Tênis Puma Basquete Court Rider Preto/Laranja Cano Médio 42 Br", cat: "Calçados", img: "/__mockup/images/shoe6.png", was: "459,90", now: "193,15", off: 58, freight: true },
  { id: 7, name: "Tênis Mizuno Wave Prophecy Masculino Corrida Azul Marinho 43 Br", cat: "Calçados", img: "/__mockup/images/shoe1.png", was: "599,90", now: "239,96", off: 60, freight: false },
  { id: 8, name: "Tênis Fila Casual Disruptor Feminino Off-White 37 Br", cat: "Calçados", img: "/__mockup/images/shoe2.png", was: "259,90", now: "98,76", off: 62, freight: true },
  { id: 9, name: "Tênis New Balance Fresh Foam Treino Cinza/Rosa 38 Br", cat: "Calçados", img: "/__mockup/images/shoe3.png", was: "389,90", now: "151,06", off: 61, freight: true },
];

function ProductCard({ p }: { p: Product }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md">
      {/* Image area */}
      <div className="relative bg-gray-50 p-4">
        <span
          className="absolute left-3 top-3 z-10 rounded px-2 py-0.5 text-[10px] font-bold text-gray-900"
          style={{ backgroundColor: YELLOW }}
        >
          Tênis
        </span>
        <span
          className="absolute right-3 top-3 z-10 rounded px-2 py-0.5 text-[11px] font-bold text-white"
          style={{ backgroundColor: "#e02424" }}
        >
          -{p.off}%
        </span>
        {p.freight && (
          <span
            className="absolute left-3 top-9 z-10 rounded px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: GREEN }}
          >
            Frete Grátis
          </span>
        )}
        <img
          src={p.img}
          alt={p.name}
          className="mx-auto h-44 w-full object-contain"
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <span className="text-[11px] text-gray-400">{p.cat}</span>
        <h3 className="mt-1 line-clamp-2 min-h-[36px] text-[13px] font-medium leading-snug text-gray-800">
          {p.name}
        </h3>
        <div className="mt-2">
          <p className="text-[12px] text-gray-400 line-through">R$ {p.was}</p>
          <p className="text-[20px] font-extrabold text-gray-900">
            R$ {p.now}
          </p>
        </div>

        <button
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md py-2.5 text-[13px] font-bold text-white transition-colors"
          style={{ backgroundColor: GREEN }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = GREEN_DARK)
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GREEN)}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Ver no Mercado Livre
        </button>
        <p className="mt-2 text-center text-[10px] text-gray-400">
          Atualizado 18:30
        </p>
        <p className="text-center text-[10px] text-gray-400">
          Parceiro Oficial Mercado Livre
        </p>
      </div>
    </div>
  );
}

export function CatalogoPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1280px] items-center gap-6 px-6 py-3">
          {/* Logo */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md text-white"
              style={{ backgroundColor: GREEN }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M3 17l6-10 4 6 2-3 6 7z" />
              </svg>
            </span>
            <div className="leading-none">
              <p className="text-[17px] font-extrabold" style={{ color: GREEN }}>
                BeUpFree
              </p>
              <p className="text-[10px] text-gray-400">Liberte sua performance</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mx-2 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Buscar tênis, meias, acessórios..."
              className="w-full rounded-full border border-gray-300 py-2 pl-10 pr-4 text-[13px] outline-none focus:border-gray-400"
            />
          </div>

          {/* Icons */}
          <div className="flex flex-shrink-0 items-center gap-4 text-gray-600">
            <User className="h-5 w-5" />
            <span className="relative">
              <ShoppingCart className="h-5 w-5" />
              <span
                className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: GREEN }}
              >
                3
              </span>
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="border-t border-gray-100">
          <div className="mx-auto flex max-w-[1280px] items-center gap-1 px-6 py-2">
            {NAV.map((item) => {
              const active = item === "Ofertas";
              return (
                <button
                  key={item}
                  className="rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors"
                  style={
                    active
                      ? { backgroundColor: YELLOW, color: "hsl(145 40% 15%)" }
                      : { color: "#4b5563" }
                  }
                >
                  {item}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* ===== Body ===== */}
      <div className="mx-auto flex max-w-[1280px] gap-6 px-6 py-6">
        <FilterSidebar />

        {/* Product area */}
        <main className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-gray-600">
              <span className="font-bold text-gray-900">3.247</span> produtos
              encontrados
            </p>
            <div className="flex items-center gap-2 text-[13px] text-gray-600">
              <span>Ordenar por:</span>
              <button className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700">
                Mais relevantes
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
