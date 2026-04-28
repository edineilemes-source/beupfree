import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiNike, SiAdidas, SiFila } from "react-icons/si";
import type { ComponentType } from "react";

interface BrandInfo {
  slug: string;
  name: string;
  total: number;
}

interface BrandsResponse {
  brands: BrandInfo[];
}

interface BrandConfig {
  slug: string;
  label: string;
  Icon?: ComponentType<{ className?: string }>;
  wordmark?: { text: string; className?: string };
}

const BRAND_CONFIG: BrandConfig[] = [
  { slug: "nike", label: "Nike", Icon: SiNike },
  { slug: "adidas", label: "Adidas", Icon: SiAdidas },
  { slug: "olympikus", label: "Olympikus", wordmark: { text: "OLYMPIKUS", className: "tracking-tight" } },
  { slug: "asics", label: "Asics", wordmark: { text: "asics", className: "italic" } },
  { slug: "fila", label: "Fila", Icon: SiFila },
];

export default function BrandsCarousel() {
  const { data } = useQuery<BrandsResponse>({
    queryKey: ["/api/sections/marcas"],
    staleTime: 5 * 60 * 1000,
  });

  const totals = new Map((data?.brands ?? []).map((b) => [b.slug, b.total]));

  return (
    <section className="py-8 md:py-12 px-4 md:px-6" data-testid="section-brands">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-sm font-bold tracking-wider text-foreground mb-4 uppercase">
          Navegue por Marcas
        </h2>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4"
          data-testid="grid-brands"
        >
          {BRAND_CONFIG.map((brand) => {
            const count = totals.get(brand.slug) ?? 0;
            return (
              <Link
                key={brand.slug}
                href={`/marca/${brand.slug}`}
                aria-label={`Ver ofertas ${brand.label}`}
                className="group relative flex flex-col items-center justify-center rounded-md bg-muted h-24 md:h-28 px-4 hover-elevate active-elevate-2 cursor-pointer"
                data-testid={`link-brand-${brand.slug}`}
              >
                {brand.Icon ? (
                  <brand.Icon className="h-10 md:h-12 w-auto text-foreground" />
                ) : (
                  <span
                    className={`text-2xl md:text-3xl font-black text-foreground ${brand.wordmark?.className ?? ""}`}
                  >
                    {brand.wordmark?.text ?? brand.label}
                  </span>
                )}
                {count > 0 && (
                  <span
                    className="absolute bottom-2 right-2 text-[10px] text-muted-foreground"
                    data-testid={`text-brand-count-${brand.slug}`}
                  >
                    {count} ofertas
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
