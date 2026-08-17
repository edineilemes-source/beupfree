import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink, ListPlus, Loader2, Pencil, Play, Power, SquareCheckBig } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Status = "active" | "inactive" | "ended";
type SourceType = "promotion" | "brand" | "category" | "outlet" | "campaign" | "other";
type Marketplace = { id: string; name: string; isActive: boolean | null };
type Source = {
  id: string; name: string; marketplaceId: string; marketplaceName: string; url: string;
  sourceType: SourceType; status: Status; priority: number; startsAt: string | null;
  endsAt: string | null; notes: string | null; collectorSupported: boolean;
  lastRun: null | { status: "running" | "completed" | "failed"; startedAt: string; itemsFound: number | null; itemsCreated: number | null; itemsIgnored: number | null; errorMessage: string | null };
};
type FormState = Omit<Source, "id" | "marketplaceName" | "startsAt" | "endsAt" | "collectorSupported" | "lastRun"> & { startsAt: string; endsAt: string };

const TYPES: Array<{ value: SourceType; label: string }> = [
  { value: "promotion", label: "Promoção" }, { value: "brand", label: "Marca" },
  { value: "category", label: "Categoria" }, { value: "outlet", label: "Outlet" },
  { value: "campaign", label: "Campanha" }, { value: "other", label: "Outro" },
];
const STATUS_LABEL: Record<Status, string> = { active: "Ativa", inactive: "Inativa", ended: "Encerrada" };
const emptyForm = (marketplaceId = ""): FormState => ({
  name: "", marketplaceId, url: "", sourceType: "promotion", status: "active", priority: 0,
  startsAt: "", endsAt: "", notes: "",
});
const dateInput = (value: string | null) => value ? value.slice(0, 10) : "";
const displayDate = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "—";

export default function CurationSources() {
  const { toast } = useToast();
  const [status, setStatus] = useState<"all" | Status>("all");
  const [marketplace, setMarketplace] = useState("all");
  const [sourceType, setSourceType] = useState<"all" | SourceType>("all");
  const [editing, setEditing] = useState<Source | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState("");

  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (marketplace !== "all") params.set("marketplace", marketplace);
  if (sourceType !== "all") params.set("source_type", sourceType);
  const listUrl = `/api/admin/curation-sources${params.size ? `?${params}` : ""}`;
  const { data, isLoading } = useQuery<{ sources: Source[] }>({ queryKey: [listUrl] });
  const { data: activeData } = useQuery<{ sources: Source[] }>({ queryKey: ["/api/admin/curation-sources?status=active"] });
  const { data: marketplaceData } = useQuery<{ marketplaces: Marketplace[] }>({ queryKey: ["/api/admin/curation-sources/marketplaces"] });
  const sources = data?.sources ?? [];
  const activeCount = useMemo(() => activeData?.sources.length ?? 0, [activeData]);

  const invalidate = () => queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/admin/curation-sources") });
  const saveMutation = useMutation({
    mutationFn: async () => {
      setFormError("");
      if (form.startsAt && form.endsAt && form.endsAt < form.startsAt) throw new Error("A data final não pode ser anterior à inicial.");
      const payload = { ...form, startsAt: form.startsAt || null, endsAt: form.endsAt || null, notes: form.notes || null };
      return apiRequest(editing ? "PATCH" : "POST", editing ? `/api/admin/curation-sources/${editing.id}` : "/api/admin/curation-sources", payload);
    },
    onSuccess: () => { invalidate(); setOpen(false); toast({ title: editing ? "Lista atualizada" : "Lista cadastrada" }); },
    onError: (error: Error) => setFormError(error.message),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: Status }) => apiRequest("PATCH", `/api/admin/curation-sources/${id}`, { status: next }),
    onSuccess: () => { invalidate(); toast({ title: "Status atualizado" }); },
    onError: (error: Error) => toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }),
  });
  const collectMutation = useMutation({
    mutationFn: async (source: Source) => {
      const response = await apiRequest("POST", `/api/admin/curation-sources/${source.id}/collect`);
      return { source, result: await response.json() as { itemsFound: number; itemsCreated: number; itemsIgnored: number } };
    },
    onSuccess: ({ result }) => {
      invalidate();
      toast({ title: "Coleta concluída", description: `Encontrados: ${result.itemsFound} · Criados: ${result.itemsCreated} · Ignorados: ${result.itemsIgnored}` });
    },
    onError: (error: Error) => toast({ title: "Falha na coleta", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });

  const startNew = () => { setEditing(null); setForm(emptyForm(marketplaceData?.marketplaces[0]?.id)); setFormError(""); setOpen(true); };
  const startEdit = (item: Source) => {
    const { collectorSupported: _collectorSupported, lastRun: _lastRun, marketplaceName: _marketplaceName, id: _id, ...editable } = item;
    setEditing(item); setForm({ ...editable, startsAt: dateInput(item.startsAt), endsAt: dateInput(item.endsAt), notes: item.notes ?? "" });
    setFormError(""); setOpen(true);
  };
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  return <div className="min-h-screen bg-background pb-16">
    <header className="border-b bg-muted/30 sticky top-0 z-30">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/triagem"><Button variant="ghost" size="icon" aria-label="Voltar à triagem"><ArrowLeft /></Button></Link>
          <div><h1 className="text-xl font-bold" data-testid="text-page-title">Fontes de Curadoria</h1><p className="text-sm text-muted-foreground">Fontes configuradas para alimentar o UpPulse</p></div>
        </div>
        <Button onClick={startNew} data-testid="button-new-source"><ListPlus className="w-4 h-4 mr-2" />Nova lista</Button>
      </div>
    </header>
    <main className="container mx-auto px-4 py-6 space-y-5">
      <Card className="p-5 border-green-500/30 bg-green-500/5"><div className="text-sm text-muted-foreground">Listas ativas nesta visão</div><div className="text-3xl font-bold text-green-700 dark:text-green-400" data-testid="active-count">{activeCount}</div></Card>
      <div className="flex gap-2 flex-wrap" data-testid="source-filters">
        {(["all", "active", "inactive", "ended"] as const).map((value) => <Button key={value} size="sm" variant={status === value ? "default" : "outline"} onClick={() => setStatus(value)} data-testid={`filter-status-${value}`}>{value === "all" ? "Todas" : STATUS_LABEL[value]}</Button>)}
        <Select value={marketplace} onValueChange={setMarketplace}><SelectTrigger className="w-48" aria-label="Filtrar marketplace"><SelectValue placeholder="Marketplace" /></SelectTrigger><SelectContent><SelectItem value="all">Todos marketplaces</SelectItem>{marketplaceData?.marketplaces.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
        <Select value={sourceType} onValueChange={(value) => setSourceType(value as typeof sourceType)}><SelectTrigger className="w-44" aria-label="Filtrar tipo"><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
      </div>
      <Card className="overflow-x-auto">
        {isLoading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div> : <Table>
          <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Nome</TableHead><TableHead>Provider</TableHead><TableHead>Tipo</TableHead><TableHead>Última coleta</TableHead><TableHead>Prioridade</TableHead><TableHead>URL</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
          <TableBody>{sources.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhuma fonte encontrada.</TableCell></TableRow> : sources.map((item) => {
            const expired = item.endsAt && new Date(item.endsAt) < new Date();
            return <TableRow key={item.id} className={item.status === "active" ? "bg-green-500/5" : ""} data-testid={`source-row-${item.id}`}>
              <TableCell><Badge variant={item.status === "active" ? "default" : "secondary"}>{STATUS_LABEL[item.status]}</Badge>{expired && item.status !== "ended" && <div className="text-xs text-amber-700 mt-1">Prazo vencido</div>}</TableCell>
              <TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.marketplaceName}</TableCell><TableCell>{TYPES.find((type) => type.value === item.sourceType)?.label}</TableCell>
              <TableCell>{item.lastRun ? <div className="text-xs"><div>{item.lastRun.status === "completed" ? "Concluída" : item.lastRun.status === "failed" ? "Falhou" : "Em andamento"}</div><div className="text-muted-foreground">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.lastRun.startedAt))}{item.lastRun.itemsFound != null ? ` · ${item.lastRun.itemsFound} encontrados` : ""}</div>{item.lastRun.errorMessage && <div className="text-destructive">{item.lastRun.errorMessage}</div>}</div> : "Nunca"}</TableCell><TableCell>{item.priority}</TableCell>
              <TableCell><a href={item.url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">Abrir <ExternalLink className="w-3 h-3" /></a></TableCell>
              <TableCell><div className="flex gap-1"><Button size="sm" variant="outline" aria-label={`Coletar agora ${item.name}`} title={item.status !== "active" ? `Fonte ${STATUS_LABEL[item.status].toLowerCase()}` : !item.collectorSupported ? "Coleta ainda não disponível para este provedor" : "Coletar agora"} disabled={item.status !== "active" || !item.collectorSupported || collectMutation.isPending} onClick={() => collectMutation.mutate(item)}>{collectMutation.isPending && collectMutation.variables?.id === item.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}{collectMutation.isPending && collectMutation.variables?.id === item.id ? "Coletando..." : "Coletar agora"}</Button><Button size="icon" variant="ghost" aria-label={`Editar ${item.name}`} onClick={() => startEdit(item)}><Pencil className="w-4 h-4" /></Button>{item.status === "active" ? <Button size="icon" variant="ghost" aria-label={`Desativar ${item.name}`} onClick={() => statusMutation.mutate({ id: item.id, next: "inactive" })}><Power className="w-4 h-4" /></Button> : <Button size="icon" variant="ghost" aria-label={`Ativar ${item.name}`} onClick={() => statusMutation.mutate({ id: item.id, next: "active" })}><Power className="w-4 h-4 text-green-600" /></Button>}<Button size="icon" variant="ghost" aria-label={`Encerrar ${item.name}`} onClick={() => statusMutation.mutate({ id: item.id, next: "ended" })}><SquareCheckBig className="w-4 h-4" /></Button></div></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>}
      </Card>
    </main>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Editar lista" : "Nova lista"}</DialogTitle></DialogHeader>
      <form className="grid sm:grid-cols-2 gap-4" onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }}>
        <div className="space-y-2"><Label htmlFor="source-name">Nome</Label><Input id="source-name" required value={form.name} onChange={(e) => update("name", e.target.value)} /></div>
        <div className="space-y-2"><Label>Marketplace</Label><Select required value={form.marketplaceId} onValueChange={(value) => update("marketplaceId", value)}><SelectTrigger aria-label="Marketplace"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{marketplaceData?.marketplaces.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="source-url">URL</Label><Input id="source-url" type="url" required placeholder="https://..." value={form.url} onChange={(e) => update("url", e.target.value)} /></div>
        <div className="space-y-2"><Label>Tipo</Label><Select value={form.sourceType} onValueChange={(value) => update("sourceType", value as SourceType)}><SelectTrigger aria-label="Tipo"><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="source-priority">Prioridade</Label><Input id="source-priority" type="number" min={0} required value={form.priority} onChange={(e) => update("priority", Number(e.target.value))} /></div>
        <div className="space-y-2"><Label htmlFor="source-start">Data de início</Label><Input id="source-start" type="date" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="source-end">Data de término</Label><Input id="source-end" type="date" min={form.startsAt || undefined} value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} /></div>
        <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => update("status", value as Status)}><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="source-notes">Observações</Label><Textarea id="source-notes" value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} /></div>
        {formError && <p className="sm:col-span-2 text-sm text-destructive" role="alert">{formError}</p>}
        <div className="sm:col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar</Button></div>
      </form>
    </DialogContent></Dialog></div>;
}
