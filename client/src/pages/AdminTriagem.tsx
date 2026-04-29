import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, RefreshCw, Check, X, Loader2, Package,
  TrendingDown, Truck, ExternalLink, Filter, CheckSquare, Square,
  ChevronDown, ChevronRight, Zap, Sun
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// =============================== Types ================================

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
  collectionSourceId: string | null;
  sourceName: string | null;
  brandDetected: string | null;
  createdAt: string;
  processedItem: ProcessedItem | null;
}

interface TriageResponse {
  total: number;
  items: TriageItem[];
}

// =============================== Constants ============================

const BRAND_FILTERS = [
  { label: "Todas", value: "all" },
  { label: "Nike", value: "nike" },
  { label: "Adidas", value: "adidas" },
  { label: "Asics", value: "asics" },
  { label: "Olympikus", value: "olympikus" },
  { label: "New Balance", value: "new-balance" },
  { label: "Kappa", value: "kappa" },
  { label: "Mizuno", value: "mizuno" },
  { label: "Fila", value: "fila" },
  { label: "Under Armour", value: "under-armour" },
  { label: "Puma", value: "puma" },
  { label: "Everlast", value: "everlast" },
  { label: "Reebok", value: "reebok" },
  { label: "Wilson", value: "wilson" },
  { label: "Saucony", value: "saucony" },
  { label: "Hoka", value: "hoka" },
  { label: "On Running", value: "on-running" },
  { label: "Skechers", value: "skechers" },
  { label: "Brooks", value: "brooks" },
];

const SECTION_CONFIG = [
  { key: "relampago", label: "Oferta Relâmpago", match: "Relâmpago", Icon: Zap, iconColor: "text-red-500" },
  { key: "dia", label: "Oferta do Dia", match: "Dia", Icon: Sun, iconColor: "text-yellow-500" },
  { key: "outros", label: "Outros", match: null, Icon: Package, iconColor: "text-muted-foreground" },
];

// =============================== Helpers ==============================

function formatBRL(value: string | number | null | undefined): string {
  if (!value) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return "—";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getSectionKey(sourceName: string | null): string {
  if (!sourceName) return "outros";
  if (sourceName.includes("Relâmpago")) return "relampago";
  if (sourceName.includes("Dia")) return "dia";
  return "outros";
}

// =============================== TriageCard ===========================

function TriageCard({
  item, selected, onToggle, onApprove, onReject, isApproving, isRejecting,
}: {
  item: TriageItem;
  selected: boolean;
  onToggle: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const p = item.processedItem;
  if (!p) return null;

  return (
    <Card
      className={`overflow-visible p-3 transition-colors ${selected ? "ring-2 ring-primary" : ""}`}
      data-testid={`card-triage-${item.id}`}
    >
      <div className="flex gap-3">
        <div className="flex items-start pt-1 flex-shrink-0">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle(item.id)}
            data-testid={`checkbox-triage-${item.id}`}
          />
        </div>

        {p.imageUrl && (
          <div className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-muted">
            <img src={p.imageUrl} alt={p.normalizedTitle} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-tight line-clamp-2" data-testid={`text-title-${item.id}`}>
            {p.normalizedTitle}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {(item.brandDetected || p.detectedBrand) && (
              <Badge variant="secondary" className="text-xs" data-testid={`badge-brand-${item.id}`}>
                {item.brandDetected || p.detectedBrand}
              </Badge>
            )}
            {p.detectedCategory && (
              <Badge variant="outline" className="text-xs" data-testid={`badge-category-${item.id}`}>
                {p.detectedCategory}
              </Badge>
            )}
            {p.freeShipping && (
              <Badge variant="default" className="bg-green-600 text-xs" data-testid={`badge-shipping-${item.id}`}>
                <Truck className="w-2.5 h-2.5 mr-1" />
                Frete Grátis
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="font-bold" data-testid={`text-price-${item.id}`}>
              {formatBRL(p.price)}
            </span>
            {p.originalPrice && parseFloat(p.originalPrice) > (p.price ? parseFloat(p.price) : 0) && (
              <span className="text-muted-foreground line-through text-sm">
                {formatBRL(p.originalPrice)}
              </span>
            )}
            {p.discountPercent && p.discountPercent > 0 ? (
              <Badge variant="destructive" className="text-xs" data-testid={`badge-discount-${item.id}`}>
                <TrendingDown className="w-2.5 h-2.5 mr-1" />
                {p.discountPercent}% OFF
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-discount-${item.id}`}>
                Sem desconto
              </Badge>
            )}
          </div>
          {(p.affiliateUrl || p.sourceUrl) && (
            <div className="mt-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(p.affiliateUrl || p.sourceUrl || "", "_blank")}
                data-testid={`button-ml-link-${item.id}`}
                className="h-7 text-xs"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Ver no ML
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <Button
            size="sm"
            onClick={() => onApprove(item.id)}
            disabled={isApproving || isRejecting}
            data-testid={`button-approve-${item.id}`}
            className="h-8"
          >
            {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onReject(item.id)}
            disabled={isApproving || isRejecting}
            data-testid={`button-reject-${item.id}`}
            className="h-8"
          >
            {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// =============================== Section ==============================

function TriageSection({
  label, Icon, iconColor, items, selectedIds, onToggleOne, onToggleSection,
  onApprove, onReject, actioningId, actionType, defaultOpen = true,
}: {
  label: string;
  Icon: any;
  iconColor: string;
  items: TriageItem[];
  selectedIds: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleSection: (ids: string[], select: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  actioningId: string | null;
  actionType: "approve" | "reject" | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;

  const sectionIds = items.map(i => i.id);
  const allSelected = sectionIds.every(id => selectedIds.has(id));
  const someSelected = sectionIds.some(id => selectedIds.has(id));

  return (
    <div className="mb-6">
      <div
        className="flex items-center gap-2 mb-3 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <h2 className="font-semibold text-base">{label}</h2>
        <Badge variant="outline" className="text-xs">{items.length}</Badge>
        <div className="flex-1" />
        {open && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSection(sectionIds, !allSelected);
            }}
            data-testid={`button-select-section-${label}`}
          >
            {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            {allSelected ? "Desmarcar seção" : "Selecionar seção"}
          </Button>
        )}
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </div>

      {open && (
        <div className="grid gap-2">
          {items.map(item => (
            <TriageCard
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onToggle={onToggleOne}
              onApprove={onApprove}
              onReject={onReject}
              isApproving={actioningId === item.id && actionType === "approve"}
              isRejecting={actioningId === item.id && actionType === "reject"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================== Main Page ============================

export default function AdminTriagem() {
  const { toast } = useToast();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const triageQueryKey = brandFilter === "all"
    ? ["/api/admin/triage"]
    : ["/api/admin/triage", { brand: brandFilter }];

  const triageUrl = brandFilter === "all"
    ? "/api/admin/triage"
    : `/api/admin/triage?brand=${encodeURIComponent(brandFilter)}`;

  const { data, isLoading, refetch } = useQuery<TriageResponse>({
    queryKey: triageQueryKey,
    queryFn: () => fetch(triageUrl).then(r => r.json()),
  });

  const collectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/collections/run", {}),
    onSuccess: async (res) => {
      const result = await res.json();
      const totalNew = result.totalNew ?? result.collected ?? 0;
      toast({ title: "Coleta concluída", description: `${totalNew} novos itens na fila` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/triage"] });
      // Como AUTO_PUBLISH_ALL=true, novos itens vão direto pra home — invalida o cache pra refletir
      invalidateHomeCache();
    },
    onError: (err: any) => {
      toast({ title: "Erro na coleta", description: err.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/reset-catalog", {}),
    onSuccess: () => {
      toast({ title: "Catálogo limpo", description: "Banco zerado. Pronto para nova coleta." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/triage"] });
      invalidateHomeCache();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao limpar", description: err.message, variant: "destructive" });
    },
  });

  const invalidateHomeCache = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sections/oferta-relampago"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sections/oferta-do-dia"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sections/grandes-marcas-hoje"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sections/ofertas-anteriores"] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/triage/${id}/approve`),
    onSuccess: () => {
      toast({ title: "Item aprovado e publicado" });
      setActioningId(null);
      setActionType(null);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(actioningId!); return n; });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/triage"] });
      invalidateHomeCache();
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
      setSelectedIds(prev => { const n = new Set(prev); n.delete(actioningId!); return n; });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/triage"] });
      invalidateHomeCache();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao rejeitar", description: err.message, variant: "destructive" });
      setActioningId(null);
      setActionType(null);
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => apiRequest("POST", "/api/admin/triage/bulk-approve", { ids }),
    onSuccess: async (res) => {
      const result = await res.json();
      toast({ title: `${result.succeeded} aprovados`, description: result.failed > 0 ? `${result.failed} falharam` : undefined });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/triage"] });
      invalidateHomeCache();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao aprovar em lote", description: err.message, variant: "destructive" });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: (ids: string[]) => apiRequest("POST", "/api/admin/triage/bulk-reject", { ids, reason: "Rejeitado em lote" }),
    onSuccess: async (res) => {
      const result = await res.json();
      toast({ title: `${result.succeeded} rejeitados`, description: result.failed > 0 ? `${result.failed} falharam` : undefined });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/triage"] });
      invalidateHomeCache();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao rejeitar em lote", description: err.message, variant: "destructive" });
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

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSection = (ids: string[], select: boolean) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      ids.forEach(id => select ? n.add(id) : n.delete(id));
      return n;
    });
  };

  const items = data?.items || [];
  const total = data?.total || 0;

  // Group items by section
  const grouped = useMemo(() => {
    const groups: Record<string, TriageItem[]> = { relampago: [], dia: [], outros: [] };
    for (const item of items) {
      const key = getSectionKey(item.sourceName);
      groups[key].push(item);
    }
    return groups;
  }, [items]);

  const selectedCount = selectedIds.size;
  const isBulkBusy = bulkApproveMutation.isPending || bulkRejectMutation.isPending;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="border-b bg-muted/30 sticky top-0 z-40">
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
                <p className="text-sm text-muted-foreground">Curadoria do catálogo — aprovar ou rejeitar itens</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" data-testid="badge-pending-count">
                <Package className="w-3 h-3 mr-1" />
                {total} pendentes
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                data-testid="button-refresh"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button
                size="sm"
                onClick={() => collectMutation.mutate()}
                disabled={collectMutation.isPending}
                data-testid="button-collect"
              >
                {collectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                Coletar do ML
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm("Limpar TODO o catálogo (produtos, ofertas, coletas, triagem)? Esta ação é irreversível.")) {
                    resetMutation.mutate();
                  }
                }}
                disabled={resetMutation.isPending}
                data-testid="button-reset-catalog"
              >
                {resetMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                Limpar Catálogo
              </Button>
            </div>
          </div>

          {/* Brand filter bar */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none" data-testid="filter-brand-bar">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {BRAND_FILTERS.map(f => (
              <Button
                key={f.value}
                variant={brandFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => { setBrandFilter(f.value); setSelectedIds(new Set()); }}
                className="flex-shrink-0 h-7 text-xs"
                data-testid={`button-filter-brand-${f.value}`}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card className="overflow-visible p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2" data-testid="text-empty-title">
              Nenhum item na fila
            </h2>
            <p className="text-muted-foreground mb-4">
              Clique em "Coletar do ML" para buscar novas ofertas.
            </p>
            {brandFilter !== "all" && (
              <Button variant="outline" onClick={() => setBrandFilter("all")} data-testid="button-clear-filter">
                Ver todas as marcas
              </Button>
            )}
          </Card>
        ) : (
          <>
            {SECTION_CONFIG.map(({ key, label, Icon, iconColor }) => (
              <TriageSection
                key={key}
                label={label}
                Icon={Icon}
                iconColor={iconColor}
                items={grouped[key] || []}
                selectedIds={selectedIds}
                onToggleOne={toggleOne}
                onToggleSection={toggleSection}
                onApprove={handleApprove}
                onReject={handleReject}
                actioningId={actioningId}
                actionType={actionType}
                defaultOpen={key !== "outros"}
              />
            ))}
          </>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selectedCount > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm shadow-lg"
          data-testid="bulk-action-bar"
        >
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {selectedCount} {selectedCount === 1 ? "selecionado" : "selecionados"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                data-testid="button-clear-selection"
              >
                Desmarcar todos
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => bulkRejectMutation.mutate(Array.from(selectedIds))}
                disabled={isBulkBusy}
                data-testid="button-bulk-reject"
              >
                {bulkRejectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <X className="w-4 h-4 mr-1.5" />}
                Rejeitar {selectedCount}
              </Button>
              <Button
                size="sm"
                onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
                disabled={isBulkBusy}
                data-testid="button-bulk-approve"
              >
                {bulkApproveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                Aprovar {selectedCount}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
