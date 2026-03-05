import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Produto {
  nome?: string;
  marca?: string;
  preco_atual?: number;
  preco_original?: number;
  desconto_percent?: number;
  link_afiliado?: string;
  url?: string;
  imagens?: string[];
  avaliacao_media?: number;
  qtd_avaliacoes?: number;
}

interface TriagemResponse {
  fonte: string;
  coletados: number;
  entregues: number;
  produtos: Produto[];
}

function formatBRL(n: number | null | undefined): string {
  if (n === null || n === undefined) return "\u2014";
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
  const desconto =
    p.desconto_percent !== null && p.desconto_percent !== undefined
      ? `${p.desconto_percent}% OFF`
      : "";
  const link = p.link_afiliado || p.url || "#";
  const img = p.imagens && p.imagens[0] ? p.imagens[0] : "";
  const rating = p.avaliacao_media ? `${p.avaliacao_media}` : "";
  const qtd = p.qtd_avaliacoes ? `(${p.qtd_avaliacoes})` : "";

  return (
    <article
      className="border border-border rounded-md p-4 bg-card"
      data-testid={`card-product-${nome}`}
    >
      {img ? (
        <img
          className="w-full h-44 object-cover rounded-md bg-muted"
          src={img}
          alt={nome}
        />
      ) : (
        <div className="w-full h-44 rounded-md bg-muted" />
      )}
      <div className="font-bold text-[15px] leading-tight mt-2 text-foreground">
        {nome}
      </div>
      <div className="text-sm text-muted-foreground">{marca}</div>

      <div className="font-extrabold text-lg mt-2 text-foreground">{preco}</div>
      {original && (
        <div className="text-sm text-muted-foreground">
          <s>{original}</s>
          {desconto ? ` \u2022 ${desconto}` : ""}
        </div>
      )}
      {!original && desconto && (
        <div className="text-sm text-muted-foreground">{desconto}</div>
      )}

      {(rating || qtd) && (
        <div className="text-sm mt-1 text-muted-foreground">
          {rating} {qtd}
        </div>
      )}

      <div className="mt-3">
        <a
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium no-underline"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`link-conferir-${nome}`}
        >
          Conferir no Mercado Livre
        </a>
      </div>
    </article>
  );
}

export default function Triagem() {
  const [query, setQuery] = useState("tenis");
  const [enrich, setEnrich] = useState("0");
  const [activeEnrich, setActiveEnrich] = useState("0");

  const { data, isLoading, isFetching, error, refetch } =
    useQuery<TriagemResponse>({
      queryKey: ["/api/triagem-external", activeEnrich],
      queryFn: async () => {
        const url = `/api/ml/triagem-proxy?enrich=${activeEnrich}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error("Falha HTTP " + res.status);
        return res.json();
      },
      staleTime: 1000 * 60 * 5,
    });

  const allProdutos = data
    ? Array.isArray(data.produtos)
      ? data.produtos
      : []
    : [];

  const produtos = allProdutos;

  const handleBuscar = () => {
    setActiveEnrich(enrich);
    refetch();
  };

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
                Ofertas - Triagem
              </h1>
              <div className="text-sm text-muted-foreground">
                Busca automatica no Mercado Livre (via sua API)
              </div>
            </div>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar (ex: tenis nike)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                className="pl-10"
                data-testid="input-search-triagem"
              />
            </div>
            <select
              value={enrich}
              onChange={(e) => setEnrich(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="select-enrich"
            >
              <option value="0">Rapido</option>
              <option value="1">Completo (imagens)</option>
            </select>
            <Button
              onClick={handleBuscar}
              disabled={isFetching}
              data-testid="button-buscar"
            >
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-atualizar"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        <div className="flex gap-3 items-center mt-3 flex-wrap">
          <Badge
            variant={error ? "destructive" : data ? "default" : "secondary"}
            data-testid="text-status"
          >
            {isFetching
              ? "Carregando\u2026"
              : error
                ? "Erro"
                : data
                  ? "Ok"
                  : "Pronto"}
          </Badge>
          {data && (
            <span
              className="text-sm text-muted-foreground"
              data-testid="text-meta"
            >
              Fonte: {data.fonte} &bull; Coletados: {data.coletados} &bull;
              Entregues: {data.entregues}
            </span>
          )}
        </div>

        {isLoading && (
          <div
            className="mt-4 flex items-center gap-2 text-muted-foreground"
            data-testid="text-loading"
          >
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando ofertas...
          </div>
        )}

        {error && (
          <div className="mt-4 text-destructive" data-testid="text-error">
            Erro ao carregar triagem: {(error as Error).message}
          </div>
        )}

        <section
          className="grid gap-4 mt-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
          data-testid="grid-products"
        >
          {produtos.length === 0 && !isLoading && !error && (
            <div className="text-sm text-muted-foreground">
              Nenhum produto retornou.
            </div>
          )}
          {produtos.map((p, i) => (
            <ProductCard key={i} p={p} />
          ))}
        </section>
      </main>
    </div>
  );
}
