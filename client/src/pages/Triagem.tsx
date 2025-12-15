import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, ExternalLink, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface MLProduct {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  currency_id: string;
  available_quantity: number;
  sold_quantity: number;
  condition: string;
  permalink: string;
  thumbnail: string;
  accepts_mercadopago: boolean;
  shipping: {
    free_shipping: boolean;
    mode: string;
    logistic_type: string;
  };
  seller: {
    id: number;
    nickname: string;
  };
  attributes: Array<{
    name: string;
    value_name: string;
  }>;
  listing_type_id: string;
  catalog_product_id: string | null;
  domain_id: string;
  category_id: string;
  official_store_id: number | null;
  tags: string[];
}

interface MLSearchResponse {
  results: MLProduct[];
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
}

const ML_API_BASE = "https://api.mercadolibre.com";

export default function Triagem() {
  const [searchQuery, setSearchQuery] = useState("tenis esportivo masculino");
  const [activeSearch, setActiveSearch] = useState("tenis esportivo masculino");

  const { data, isLoading, refetch, isFetching, error } = useQuery<MLSearchResponse>({
    queryKey: ["ml-triagem", activeSearch],
    queryFn: async () => {
      const response = await fetch(
        `${ML_API_BASE}/sites/MLB/search?q=${encodeURIComponent(activeSearch)}&limit=10`
      );
      if (!response.ok) {
        throw new Error("Erro ao buscar dados do Mercado Livre");
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const handleSearch = () => {
    setActiveSearch(searchQuery);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculateDiscount = (original: number | null, current: number) => {
    if (!original || original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-title">
              Triagem de Produtos
            </h1>
            <p className="text-muted-foreground text-sm">
              Dados brutos da API do Mercado Livre para análise
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Buscar Produtos na API</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Digite sua busca..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  data-testid="input-search-triagem"
                />
              </div>
              <Button onClick={handleSearch} disabled={isFetching} data-testid="button-search">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh">
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-muted-foreground">Carregando dados do Mercado Livre...</p>
          </div>
        )}

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="py-6">
              <p className="text-destructive font-medium">Erro ao carregar produtos:</p>
              <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4" data-testid="button-retry">
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Exibindo {data.results.length} de {data.paging.total.toLocaleString("pt-BR")} resultados
              </p>
              <Badge variant="secondary">API: api.mercadolibre.com</Badge>
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Imagem</TableHead>
                      <TableHead>ID / Título</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Vendidos</TableHead>
                      <TableHead>Frete</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.results.map((product) => (
                      <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                        <TableCell>
                          <img
                            src={product.thumbnail.replace("http://", "https://")}
                            alt={product.title}
                            className="w-12 h-12 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://via.placeholder.com/48";
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="text-xs text-muted-foreground font-mono">{product.id}</p>
                            <p className="text-sm font-medium truncate" title={product.title}>
                              {product.title}
                            </p>
                            {product.catalog_product_id && (
                              <Badge variant="outline" className="text-xs mt-1">
                                Catálogo: {product.catalog_product_id}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-primary">{formatCurrency(product.price)}</p>
                            {product.original_price && product.original_price > product.price && (
                              <>
                                <p className="text-xs text-muted-foreground line-through">
                                  {formatCurrency(product.original_price)}
                                </p>
                                <Badge className="bg-red-500 text-white text-xs">
                                  -{calculateDiscount(product.original_price, product.price)}%
                                </Badge>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.available_quantity > 10 ? "default" : "destructive"}>
                            {product.available_quantity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{product.sold_quantity.toLocaleString("pt-BR")}</span>
                        </TableCell>
                        <TableCell>
                          {product.shipping?.free_shipping ? (
                            <Badge className="bg-green-500 text-white">Grátis</Badge>
                          ) : (
                            <Badge variant="secondary">Pago</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p className="font-medium">{product.seller?.nickname || "N/A"}</p>
                            <p className="text-muted-foreground">ID: {product.seller?.id}</p>
                            {product.official_store_id && (
                              <Badge variant="outline" className="mt-1">Loja Oficial</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {product.listing_type_id}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono">{product.category_id}</span>
                        </TableCell>
                        <TableCell>
                          <a
                            href={product.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            data-testid={`link-product-${product.id}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Dados Brutos (JSON)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-xs">
                  {JSON.stringify(data.results, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
