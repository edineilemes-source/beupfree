import {
  Search,
  User,
  Heart,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Tag,
} from "lucide-react";
import { FilterSidebar } from "./FilterSidebar";

const GREEN = "hsl(145 70% 35%)";
const GREEN_DARK = "hsl(145 70% 28%)";
const NEON = "hsl(96 85% 55%)";
const YELLOW = "hsl(48 90% 55%)";
const DARK = "hsl(150 30% 8%)";
const DARK_NAV = "hsl(150 32% 11%)";

const NAV = ["Masculino", "Feminino", "Infantil", "Acessórios"];

const RUNNER =
  "M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z";

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
  { id: 1, name: "Tênis On Running Cloud Monster Lumos Glacial Rock /Ivory Bege", cat: "Esportes", img: "/__mockup/images/shoe4.png", was: "358,00", now: "185,00", off: 48, freight: true },
  { id: 2, name: "Tênis Asics Gt-2000 13 Black/Red Advantage Feminino Preto 36 Br", cat: "Esportes", img: "/__mockup/images/shoe1.png", was: "564,90", now: "249,00", off: 56, freight: true },
  { id: 3, name: "Tênis Asics Academia Cumulus Caminhada Treino Esporte Masculino", cat: "Esportes", img: "/__mockup/images/shoe6.png", was: "139,90", now: "99,90", off: 30, freight: true },
  { id: 4, name: "Tênis Infantil Menina Jiddobi Escolar Casual Conforto Menina", cat: "Esportes", img: "/__mockup/images/shoe3.png", was: "63,90", now: "42,00", off: 34, freight: true },
  { id: 5, name: "Tênis Infantil Menina Casual Jiddobi Escolar Preto e Ciumen", cat: "Esportes", img: "/__mockup/images/shoe2.png", was: "85,90", now: "49,90", off: 42, freight: true },
  { id: 6, name: "Tênis Masculino Etnnis Gallery And1 Marinho Lisa 38 Br", cat: "Esportes", img: "/__mockup/images/shoe5.png", was: "323,99", now: "233,99", off: 26, freight: true },
  { id: 7, name: "Tênis Masculino Etnnis Gallery And1 Marinho Lisa 38 Br", cat: "Esportes", img: "/__mockup/images/shoe1.png", was: "323,99", now: "233,99", off: 67, freight: true },
  { id: 8, name: "Tênis Lynd Sunset 2 Masculino Caminhada Corrida Conforto Macio", cat: "Esportes", img: "/__mockup/images/shoe6.png", was: "149,00", now: "89,00", off: 61, freight: true },
  { id: 9, name: "Tênis Vulcano Feminino Casual Conforto Leve Caminhada Dia a Dia", cat: "Esportes", img: "/__mockup/images/shoe4.png", was: "139,90", now: "99,90", off: 28, freight: true },
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
        {p.freight && (
          <span
            className="absolute left-3 top-9 z-10 rounded px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: GREEN }}
          >
            Frete Grátis
          </span>
        )}
        <span
          className="absolute right-3 top-3 z-10 rounded px-2 py-0.5 text-[11px] font-bold text-white"
          style={{ backgroundColor: "#e02424" }}
        >
          -{p.off}%
        </span>
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
          <p className="text-[20px] font-extrabold text-gray-900">R$ {p.now}</p>
        </div>

        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md py-2.5 text-[13px] font-bold text-white transition-colors"
          style={{ backgroundColor: GREEN }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = GREEN_DARK)
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GREEN)}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15 3h6v6M10 14L21 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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

function HeroShoe({ src, className }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      className={`object-contain drop-shadow-2xl ${className ?? ""}`}
    />
  );
}

export function UpPulsePage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* ===== Top promo bar ===== */}
      <div style={{ backgroundColor: GREEN_DARK }} className="text-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-6 py-1.5 text-center text-[12px]">
          <span>Peça o tênis que mais combina com você.</span>
          <span className="opacity-40">|</span>
          <span className="font-semibold">Parceiro Oficial Mercado Livre</span>
        </div>
      </div>

      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          {/* Logo */}
          <div className="flex flex-shrink-0 items-center gap-2.5">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: GREEN }}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="white">
                <path d={RUNNER} />
              </svg>
            </span>
            <div className="leading-none">
              <p className="text-[22px] font-extrabold tracking-tight">
                <span className="text-gray-900">Up</span>
                <span style={{ color: GREEN }}>Pulse</span>
              </p>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-gray-500">
                Tênis esportivos em promoção
              </p>
              <p
                className="text-[8px] font-bold uppercase tracking-[0.14em]"
                style={{ color: GREEN }}
              >
                by BeUpFree
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative order-last w-full min-w-0 flex-1 md:order-none md:w-auto md:max-w-[560px]">
            <Search
              className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Buscar tênis"
              placeholder="Buscar tênis..."
              className="w-full rounded-full border border-gray-300 py-2.5 pl-11 pr-12 text-[14px] outline-none focus:border-gray-400"
            />
            <button
              type="button"
              aria-label="Buscar"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: GREEN }}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Icons */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-5 text-gray-700">
            <button
              type="button"
              className="flex flex-col items-center gap-1 text-[10px] font-medium"
            >
              <User className="h-5 w-5" aria-hidden="true" />
              Entrar
            </button>
            <button
              type="button"
              className="flex flex-col items-center gap-1 text-[10px] font-medium"
            >
              <Heart className="h-5 w-5" aria-hidden="true" />
              Favoritos
            </button>
            <button
              type="button"
              className="flex flex-col items-center gap-1 text-[10px] font-medium"
            >
              <span className="relative">
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                <span
                  className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ backgroundColor: GREEN }}
                >
                  0
                </span>
              </span>
              Carrinho
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ backgroundColor: DARK_NAV }}>
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-center gap-x-8 gap-y-1 px-6 py-2.5 text-[13px] font-semibold uppercase tracking-wide">
            {NAV.map((item) => (
              <button
                key={item}
                type="button"
                className="text-white/85 transition-colors hover:text-white"
              >
                {item}
              </button>
            ))}
            <button type="button" style={{ color: NEON }}>
              % Desconto
            </button>
          </div>
        </nav>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden" style={{ backgroundColor: DARK }}>
        {/* neon ambient streaks */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background: `radial-gradient(120% 80% at 80% 30%, ${NEON}22, transparent 60%), radial-gradient(60% 50% at 95% 90%, ${GREEN}33, transparent 70%)`,
          }}
        />
        <div
          className="pointer-events-none absolute -right-10 top-0 h-full w-[55%] opacity-30"
          style={{
            background: `linear-gradient(115deg, transparent 40%, ${NEON}55 50%, transparent 60%)`,
          }}
        />

        <div className="relative mx-auto flex min-h-[320px] max-w-[1280px] items-center gap-4 px-6 py-10">
          {/* Left arrow */}
          <button
            type="button"
            aria-label="Oferta anterior"
            className="z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-sm transition-colors hover:bg-black/40"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Headline */}
          <div className="z-10 flex-shrink-0">
            <h1 className="text-[40px] font-extrabold italic leading-[0.95] tracking-tight text-white sm:text-[48px]">
              TÊNIS
              <br />
              <span style={{ color: NEON }}>ESPORTIVOS</span>
              <br />
              EM PROMOÇÃO
            </h1>
          </div>

          {/* Shoes on neon podium */}
          <div className="relative flex flex-1 items-end justify-center">
            <div
              className="absolute bottom-6 left-1/2 h-8 w-[90%] -translate-x-1/2 rounded-[50%]"
              style={{
                background: `radial-gradient(ellipse at center, ${NEON} 0%, ${NEON}00 70%)`,
                filter: "blur(10px)",
                opacity: 0.7,
              }}
            />
            <div className="relative flex items-end justify-center gap-1">
              <HeroShoe
                src="/__mockup/images/shoe4.png"
                className="h-24 w-32 -rotate-6 sm:h-28 sm:w-40"
              />
              <HeroShoe
                src="/__mockup/images/shoe1.png"
                className="h-32 w-40 sm:h-40 sm:w-52"
              />
              <HeroShoe
                src="/__mockup/images/shoe6.png"
                className="h-24 w-32 rotate-6 sm:h-28 sm:w-40"
              />
            </div>
          </div>

          {/* Right arrow */}
          <button
            type="button"
            aria-label="Próxima oferta"
            className="z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-sm transition-colors hover:bg-black/40"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Dots */}
        <div className="relative flex justify-center gap-2 pb-5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-white/40" />
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: NEON }}
          />
          <span className="h-2 w-2 rounded-full bg-white/40" />
        </div>
      </section>

      {/* ===== Catalog heading ===== */}
      <div className="mx-auto max-w-[1280px] px-6 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
          <h2 className="flex items-center gap-2 text-[20px] font-extrabold text-gray-900">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md text-white"
              style={{ backgroundColor: GREEN }}
            >
              <Tag className="h-3.5 w-3.5" />
            </span>
            Produtos com desconto
          </h2>
          <p className="text-[13px] text-gray-500">
            Mais de <span className="font-bold text-gray-800">3.247</span>{" "}
            ofertas
            <span className="mx-2 text-gray-300">|</span>
            Atualizado em 18:30
          </p>
        </div>
      </div>

      {/* ===== Body ===== */}
      <div className="mx-auto flex max-w-[1280px] gap-6 px-6 py-6">
        <FilterSidebar />

        {/* Product grid */}
        <main className="min-w-0 flex-1">
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
