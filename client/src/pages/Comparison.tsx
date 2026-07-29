import { ArrowLeft, PackageX, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useComparison } from "@/context/ComparisonContext";
import type { ComparableProduct } from "@/types/comparison";

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPrice(value: number | undefined, currency: string | undefined): string {
  if (value == null) return "Não informado";
  if (!currency) return formatNumber(value);

  try {
    return value.toLocaleString("pt-BR", { style: "currency", currency });
  } catch {
    return `${formatNumber(value)} ${currency}`;
  }
}

function ComparisonProductCard({
  item,
  onRemove,
}: {
  item: ComparableProduct;
  onRemove: (productId: string) => void;
}) {
  const { product, selectedOffer } = item;

  return (
    <Card
      className="flex flex-col overflow-hidden bg-background"
      data-testid={`comparison-page-card-${product.id}`}
    >
      <div className="flex h-56 items-center justify-center bg-white p-6">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full object-contain"
          />
        ) : (
          <PackageX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {product.brand?.name ?? "Marca não informada"}
        </p>
        <h2 className="mt-1 text-lg font-semibold leading-snug">{product.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {product.category?.name ?? "Categoria não informada"}
        </p>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Preço</dt>
            <dd className="text-right font-semibold">
              {formatPrice(selectedOffer?.currentPrice, selectedOffer?.currency)}
            </dd>
          </div>
          {selectedOffer?.originalPrice != null && (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted-foreground">Preço anterior</dt>
              <dd className="text-right line-through">
                {formatPrice(selectedOffer.originalPrice, selectedOffer.currency)}
              </dd>
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Desconto</dt>
            <dd className="text-right">
              {selectedOffer?.discountPercent != null
                ? `${selectedOffer.discountPercent}%`
                : "Não informado"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Frete grátis</dt>
            <dd className="text-right">
              {selectedOffer?.freeShipping === true
                ? "Sim"
                : selectedOffer?.freeShipping === false
                  ? "Não"
                  : "Não informado"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Avaliação</dt>
            <dd className="text-right">
              {product.rating != null
                ? product.rating.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
                : "Não informada"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Avaliações</dt>
            <dd className="text-right">
              {product.reviewCount != null
                ? product.reviewCount.toLocaleString("pt-BR")
                : "Não informado"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Marketplace</dt>
            <dd className="text-right">
              {selectedOffer?.marketplaceName ?? "Não informado"}
            </dd>
          </div>
          {selectedOffer?.sellerName && (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted-foreground">Vendedor</dt>
              <dd className="text-right">{selectedOffer.sellerName}</dd>
            </div>
          )}
        </dl>

        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full gap-2"
          onClick={() => onRemove(product.id)}
          aria-label={`Remover ${product.title} da comparação`}
          title={`Remover ${product.title} da comparação`}
          data-testid={`button-remove-comparison-page-${product.id}`}
        >
          <Trash2 className="h-4 w-4" />
          Remover
        </Button>
      </div>
    </Card>
  );
}

export default function Comparison() {
  const {
    items,
    comparisonCount,
    clearComparison,
    removeFromComparison,
  } = useComparison();
  const [, setLocation] = useLocation();
  const returnToCatalog = () => setLocation("/catalogo");

  return (
    <div className="flex min-h-screen flex-col bg-muted/35">
      <Header />
      <main className="flex-1 px-4 py-8 md:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl" data-testid="comparison-page-title">
                Comparar produtos
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Revise lado a lado as informações disponíveis dos produtos selecionados.
              </p>
            </div>
            {comparisonCount > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={clearComparison}
                aria-label="Limpar comparação"
                title="Limpar comparação"
                data-testid="button-clear-comparison-page"
              >
                Limpar comparação
              </Button>
            )}
          </div>

          {comparisonCount === 0 ? (
            <Card className="p-8 text-center" data-testid="comparison-empty-state">
              <PackageX className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-lg font-semibold">
                Nenhum produto selecionado para comparação.
              </p>
              <Button
                type="button"
                className="mt-5 gap-2"
                onClick={returnToCatalog}
                aria-label="Voltar ao catálogo"
                title="Voltar ao catálogo"
                data-testid="button-back-to-catalog"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao catálogo
              </Button>
            </Card>
          ) : comparisonCount === 1 ? (
            <Card className="p-8 text-center" data-testid="comparison-one-state">
              <p className="text-lg font-semibold">
                Selecione mais um produto para comparar.
              </p>
              <Button
                type="button"
                className="mt-5"
                onClick={returnToCatalog}
                aria-label="Continuar comprando"
                title="Continuar comprando"
                data-testid="button-continue-shopping"
              >
                Continuar comprando
              </Button>
            </Card>
          ) : (
            <div
              className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
              data-testid="comparison-products-grid"
            >
              {items.map((item) => (
                <ComparisonProductCard
                  key={item.product.id}
                  item={item}
                  onRemove={removeFromComparison}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
