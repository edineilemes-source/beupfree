import React, { type ReactNode, type Ref } from "react";
import { Loader2, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CatalogEmptyState } from "@/lib/catalogState";

interface Props {
  sidebar: ReactNode;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  emptyState: CatalogEmptyState;
  demonstrative: boolean;
  resultsRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

export default function CatalogResults({ sidebar, isLoading, isError, errorMessage, emptyState, demonstrative, resultsRef, children }: Props) {
  return (
    <div className="flex w-full flex-col gap-5 px-4 pb-8 md:flex-row">
      {sidebar}
      <div ref={resultsRef} className="min-w-0 flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <Card className="p-8 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-lg font-medium">Não foi possível carregar o catálogo</h2>
            <p className="text-muted-foreground">{errorMessage ?? "Tente novamente em instantes."}</p>
          </Card>
        ) : emptyState ? (
          <Card className="p-8 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-lg font-medium" data-testid={emptyState === "filtered" ? "text-no-results" : "text-empty-catalog"}>
              {emptyState === "filtered" ? "Nenhum produto encontrado com os filtros selecionados." : "Nenhum produto disponível ainda"}
            </h2>
            <p className="text-muted-foreground">
              {emptyState === "filtered" ? "Tente remover alguns filtros ou limpar a busca para ver mais resultados."
                : demonstrative ? "O snapshot demonstrativo ainda não possui produtos publicados."
                  : "Nosso catálogo está sendo atualizado. Volte em breve para conferir as melhores ofertas!"}
            </p>
          </Card>
        ) : children}
      </div>
    </div>
  );
}
