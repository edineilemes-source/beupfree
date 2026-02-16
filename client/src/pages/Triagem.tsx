import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = "https://howard-positioning-indirect-consortium.trycloudflare.com";

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
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ProductCard({ p }: { p: Produto }) {
  const nome = p.nome || "Produto";
  const marca = p.marca || "";
  const preco = formatBRL(p.preco_atual);
  const original = p.preco_original ? formatBRL(p.preco_original) : "";
  const desconto = (p.desconto_percent !== null && p.desconto_percent !== undefined)
    ? `${p.desconto_percent}% OFF`
    : "";
  const link = p.link_afiliado || p.url || "#";
  const img = (p.imagens && p.imagens[0]) ? p.imagens[0] : "";
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
      <div className="font-bold text-[15px] leading-tight mt-2 text-foreground">{nome}</div>
      <div className="opacity-70 text-sm text-muted-foreground">{marca}</div>

      <div className="font-extrabold text-lg mt-2 text-foreground">{preco}</div>
      {original && (
        <div className="opacity-70 text-sm text-muted-foreground">
          <s>{original}</s>{desconto ? ` \u2022 ${desconto}` : ""}
        </div>
      )}
      {!original && desconto && (
        <div className="opacity-70 text-sm text-muted-foreground">{desconto}</div>
      )}

      {(rating || qtd) && (
        <div className="opacity-70 text-sm mt-1 text-muted-foreground">
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Pronto");
  const [meta, setMeta] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const carregar = useCallback(async () => {
    setError("");
    setLoading(true);
    setStatus("Carregando\u2026");
    setProdutos([]);

    const url = `${API_BASE}/triagem?enrich=${enrich}`;

    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error("Falha HTTP " + res.status);

      const data: TriagemResponse = await res.json();

      setMeta(`Fonte: ${data.fonte} \u2022 Coletados: ${data.coletados} \u2022 Entregues: ${data.entregues}`);
      setStatus("Ok");

      const lista = Array.isArray(data.produtos) ? data.produtos : [];
      setProdutos(lista);
    } catch (e: any) {
      setStatus("Erro");
      setError("Erro ao carregar triagem: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }, [enrich]);

  useEffect(() => {
    carregar();
  }, []);

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
              <h1 className="text-2xl font-bold text-foreground m-0" data-testid="text-title">
                Ofertas - Triagem
              </h1>
              <div className="text-sm text-muted-foreground">
                Busca automatica no Mercado Livre (via sua API)
              </div>
            </div>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <input
              id="q"
              type="text"
              placeholder="Buscar (ex: tenis nike)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background text-foreground"
              data-testid="input-search-triagem"
            />
            <select
              id="enrich"
              value={enrich}
              onChange={(e) => setEnrich(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background text-foreground"
              data-testid="select-enrich"
            >
              <option value="0">Rapido</option>
              <option value="1">Completo (imagens/avaliacao)</option>
            </select>
            <Button onClick={carregar} data-testid="button-buscar">
              Buscar
            </Button>
            <Button variant="outline" onClick={carregar} data-testid="button-atualizar">
              Atualizar
            </Button>
          </div>
        </div>

        <div className="flex gap-3 items-center mt-3 flex-wrap">
          <span
            className="inline-block px-3 py-1 rounded-full text-xs border border-border text-foreground"
            data-testid="text-status"
          >
            {status}
          </span>
          <span className="text-sm text-muted-foreground" data-testid="text-meta">{meta}</span>
        </div>

        {loading && (
          <div className="mt-4 text-muted-foreground" data-testid="text-loading">
            Carregando ofertas...
          </div>
        )}

        {error && (
          <div className="mt-4 text-destructive" data-testid="text-error">
            {error}
          </div>
        )}

        <section
          className="grid gap-4 mt-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
          data-testid="grid-products"
        >
          {produtos.length === 0 && !loading && !error && (
            <div className="text-sm text-muted-foreground">Nenhum produto retornou.</div>
          )}
          {produtos.map((p, i) => (
            <ProductCard key={i} p={p} />
          ))}
        </section>
      </main>
    </div>
  );
}
