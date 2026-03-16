import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, RefreshCw, Check, X, Loader2, Package, TrendingDown, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProcessedItem {
  id: string;
  normalizedTitle: string;
  detectedBrand: string | null;
  detectedCategory: string | null;
  price: string | null;
  originalPrice: string | null;
  discountPercent: number | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  affiliateUrl: string | null;
  freeShipping: boolean;
}

interface TriageItem {
  id: string;
  processedItemId: string;
  status: string;
  priority: number;
  suggestedBrandId: string | null;
  suggestedCategoryId: string | null;
  createdAt: string;
  processedItem: ProcessedItem | null;
}

interface TriageResponse {
  total: number;
  items: TriageItem[];
}

function formatBRL(value: string | number | null | undefined): string {
  if (!value) return "\u2014";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return "\u2014";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function TriageCard({ item, onApprove, onReject, isApproving, isRejecting }: {
  item: TriageItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const p = item.processedItem;
  if (!p) return null;

  return (
    <Card className="overflow-visible p-4" data-testid={`card-triage-${item.id}`}>
      <div className="flex gap-4">
        {p.imageUrl && (
          <div className="flex-shrink-0 w-24 h-24 rounded-md overflow-hidden bg-muted">
            <img src={p.imageUrl} alt={p.normalizedTitle} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-tight line-clamp-2" data-testid={`text-title-${item.id}`}>
            {p.normalizedTitle}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {p.detectedBrand && (
              <Badge variant="secondary" data-testid={`badge-brand-${item.id}`}>
                {p.detectedBrand}
              </Badge>
            )}
            {p.detectedCategory && (
              <Badge variant="outline" data-testid={`badge-category-${item.id}`}>
                {p.detectedCategory}
              </Badge>
            )}
            {p.freeShipping && (
              <Badge variant="default" className="bg-green-600" data-testid={`badge-shipping-${item.id}`}>
                <Truck className="w-3 h-3 mr-1" />
                Frete Grátis
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-bold text-base" data-testid={`text-price-${item.id}`}>
              {formatBRL(p.price)}
            </span>
            {p.originalPrice && parseFloat(p.originalPrice) > (p.price ? parseFloat(p.price) : 0) && (
              <span className="text-muted-foreground line-through text-sm">
                {formatBRL(p.originalPrice)}
              </span>
            )}
            {p.discountPercent && p.discountPercent > 0 && (
              <Badge variant="destructive" data-testid={`badge-discount-${item.id}`}>
                <TrendingDown className="w-3 h-3 mr-1" />
                {p.discountPercent}% OFF
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Button
            size="sm"
            onClick={() => onApprove(item.id)}
            disabled={isApproving || isRejecting}
            data-testid={`button-approve-${item.id}`}
          >
            {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onReject(item.id)}
            disabled={isApproving || isRejecting}
            data-testid={`button-reject-${item.id}`}
          >
            {isRejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function AdminTriagem() {
  const { toast } = useToast();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  const { data, isLoading, refetch } = useQuery<TriageResponse>({
    queryKey: ["/api/admin/triage"],
  });

  const collectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/collect"),
    onSuccess: async (res) => {
      const result = await res.json();
      toast({ title: "Coleta concluída", description: `${result.collected} itens coletados, ${result.queued} na fila` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/triage"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro na coleta", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/triage/${id}/approve`),
    onSuccess: () => {
      toast({ title: "Item aprovado e publicado" });
      setActioningId(null);
      setActionType(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/triage"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao aprovar", description: err.message, variant: "destructive" });
      setActioningId(null);
      setActionType(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/triage/${id}/reject`, { reason: "Rejeitado pelo curador" }),
    onSuccess: () => {
      toast({ title: "Item rejeitado" });
      setActioningId(null);
      setActionType(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/triage"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao rejeitar", description: err.message, variant: "destructive" });
      setActioningId(null);
      setActionType(null);
    },
  });

  const handleApprove = (id: string) => {
    setActioningId(id);
    setActionType("approve");
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    setActioningId(id);
    setActionType("reject");
    rejectMutation.mutate(id);
  };

  const items = data?.items || [];
  const total = data?.total || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-page-title">Triagem de Produtos</h1>
                <p className="text-sm text-muted-foreground">Curadoria do catálogo - aprovar ou rejeitar itens</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" data-testid="badge-pending-count">
                <Package className="w-3 h-3 mr-1" />
                {total} pendentes
              </Badge>
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
                data-testid="button-refresh"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button
                onClick={() => collectMutation.mutate()}
                disabled={collectMutation.isPending}
                data-testid="button-collect"
              >
                {collectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Coletar do ML
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card className="overflow-visible p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2" data-testid="text-empty-title">Nenhum item na fila</h2>
            <p className="text-muted-foreground mb-4">
              Clique em "Coletar do ML" para buscar novas ofertas e popular a fila de triagem.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <TriageCard
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
                isApproving={actioningId === item.id && actionType === "approve"}
                isRejecting={actioningId === item.id && actionType === "reject"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
