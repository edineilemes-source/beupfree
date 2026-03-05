import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, RefreshCw, TrendingDown, Star, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface Produto {
  nome?: string;
  marca?: string;
  preco_atual?: number;
  preco_original?: number | null;
  desconto_percent?: number | null;
  link_afiliado?: string;
  url?: string;
  imagens?: string[];
  avaliacao_media?: number | null;
  qtd_avaliacoes?: number | null;
  frete_gratis?: boolean;
  parcelas?: string;
  fonte?: string;
}

interface TriagemResponse {
  fonte: string;
  coletados: number;
  entregues: number;
  produtos: Produto[];
  erros?: string[];
}

function formatBRL(n: number | null | undefined): string {
  if (n === null || n === undefined || n === 0) return "\u2014";
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function ProductCard({ p }: { p: Produto }) {
  const nome = p.nome || "Produto";
  const marca = p.marca || "";
  const preco = formatBRL(p.preco_atual);
  const original = p.preco_original ? formatBRL(p.preco_original) : "";
  const desconto = p.desconto_percent ? `${p.desconto_percent}%` : "";
  const link = p.link_afiliado || p.url || "#";
  const img = p.imagens && p.imagens[0] ? p.imagens[0] : "";
  const rating = p.avaliacao_media;
  const qtd = p.qtd_avaliacoes;

  return (
    <Card
      className="overflow-visible p-0 flex flex-col"
      data-testid={`card-product-${nome}`}
    >
      <div className="relative">
        {img ? (
          <img
            className="w-full h-48 object-contain rounded-t-md bg-muted p-2"
            src={img}
            alt={nome}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-48 rounded-t-md bg-muted flex items-center justify-center text-muted-foreground text-sm">
            Sem imagem
          </div>
        )}
        {desconto && (
          <Badge
            variant="destructive"
            className="absolute top-2 left-2"
            data-testid={`badge-discount-${nome}`}
          >
            <TrendingDown className="w-3 h-3 mr-1" />
            {desconto} OFF
          </Badge>
        )}
        {p.frete_gratis && (
          <Badge
            variant="secondary"
            className="absolute top-2 right-2"
            data-testid={`badge-frete-${nome}`}
          >
            <Truck className="w-3 h-3 mr-1" />
            Frete gratis
          </Badge>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        {marca && marca !== "N/A" && (
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide" data-testid={`text-brand-${nome}`}>
            {marca}
          </span>
        )}
        <h3 className="font-semibold text-sm leading-tight mt-1 text-foreground line-clamp-2" data-testid={`text-title-${nome}`}>
          {nome}
        </h3>

        <div className="mt-auto pt-2">
          {original && (
            <div className="text-xs text-muted-foreground line-through" data-testid={`text-original-price-${nome}`}>
              {original}
            </div>
          )}
          <div className="font-extrabold text-lg text-foreground" data-testid={`text-price-${nome}`}>
            {preco}
          </div>
          {p.parcelas && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {p.parcelas}
            </div>
          )}
        </div>

        {(rating || qtd) && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            {rating && (
              <>
                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                <span>{rating}</span>
              </>
            )}
            {qtd && <span>({qtd.toLocaleString("pt-BR")})</span>}
          </div>
        )}

        <div className="mt-3">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`link-conferir-${nome}`}
          >
            <Button className="w-full" size="sm">
              Ver no Mercado Livre
            </Button>
          </a>
        </div>
      </div>
    </Card>
  );
}

export default function Triagem() {
  const [sortBy, setSortBy] = useState<"desconto" | "avaliacao" | "preco">("desconto");

  const { data, isLoading, isFetching, error, refetch } =
    useQuery<TriagemResponse>({
      queryKey: ["/api/ml/scrape-ofertas"],
      queryFn: async () => {
        const res = await fetch("/api/ml/scrape-ofertas");
        if (!res.ok) throw new Error("Falha HTTP " + res.status);
        return res.json();
      },
      staleTime: 1000 * 60 * 10,
      retry: 1,
    });

  const allProdutos = data?.produtos || [];

  const sorted = [...allProdutos].sort((a, b) => {
    if (sortBy === "desconto") {
      return (b.desconto_percent || 0) - (a.desconto_percent || 0);
    }
    if (sortBy === "avaliacao") {
      return (b.qtd_avaliacoes || 0) - (a.qtd_avaliacoes || 0);
    }
    return (a.preco_atual || 0) - (b.preco_atual || 0);
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1200px] mx-auto p-6">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1
                className="text-2xl font-bold text-foreground m-0"
                data-testid="text-title"
              >
                Ofertas Esportivas
              </h1>
              <div className="text-sm text-muted-foreground">
                Monitoramento de lojas estrategicas do Mercado Livre
              </div>
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="select-sort"
            >
              <option value="desconto">Maior desconto</option>
              <option value="avaliacao">Mais avaliados</option>
              <option value="preco">Menor preco</option>
            </select>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-atualizar"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="flex gap-3 items-center mt-3 flex-wrap">
          <Badge
            variant={error ? "destructive" : data ? "default" : "secondary"}
            data-testid="text-status"
          >
            {isFetching
              ? "Buscando ofertas..."
              : error
                ? "Erro"
                : data
                  ? `${sorted.length} produtos`
                  : "Aguardando"}
          </Badge>
          {data && (
            <span
              className="text-sm text-muted-foreground"
              data-testid="text-meta"
            >
              Fonte: {data.fonte}
            </span>
          )}
          {data?.erros && data.erros.length > 0 && (
            <span className="text-sm text-destructive">
              Avisos: {data.erros.join("; ")}
            </span>
          )}
        </div>

        {isLoading && (
          <div
            className="mt-8 flex flex-col items-center gap-3 text-muted-foreground"
            data-testid="text-loading"
          >
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span>Buscando ofertas nas lojas estrategicas...</span>
            <span className="text-xs">Isso pode levar alguns segundos</span>
          </div>
        )}

        {error && (
          <div className="mt-4 text-destructive" data-testid="text-error">
            Erro ao carregar ofertas: {(error as Error).message}
          </div>
        )}

        <section
          className="grid gap-4 mt-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          }}
          data-testid="grid-products"
        >
          {sorted.length === 0 && !isLoading && !error && (
            <div className="text-sm text-muted-foreground col-span-full text-center py-8">
              Nenhum produto encontrado. Clique em Atualizar para buscar.
            </div>
          )}
          {sorted.map((p, i) => (
            <ProductCard key={`${p.url || p.nome}-${i}`} p={p} />
          ))}
        </section>
      </main>
    </div>
  );
}
