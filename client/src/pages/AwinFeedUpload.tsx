import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, UploadCloud, FileArchive, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type UploadReport = {
 status:string; merchant:string;feedId:string;storedName:string;sha256:string;
 stats:{rows:number;normalized:number;invalid:number;priceStates:Record<string,number>;
 taxonomy:Record<string,number>;eligibility:Record<string,number>;reasons:Record<string,number>};
 imported:number;published:number;
};
export default function AwinFeedUpload(){
 const [merchant,setMerchant]=useState("17698");
 const [feedId,setFeedId]=useState("51837");
 const [file,setFile]=useState<File|null>(null);
 const [adminToken,setAdminToken]=useState("");
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 const [report,setReport]=useState<UploadReport|null>(null);
 const {data:status}=useQuery<{enabled:boolean;maxFileBytes:number;mode:string}>({
  queryKey:["/api/admin/awin-feeds/status"],
  queryFn:async()=>{const response=await fetch("/api/admin/awin-feeds/status",{credentials:"same-origin"});if(!response.ok)throw Error("Status indisponível");return response.json()}
 });
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setPending(true);setError("");setReport(null);
  try{
   if(!file||!file.name.toLowerCase().endsWith(".csv.gz"))throw Error("Selecione um arquivo AWIN .csv.gz");
   if(!/^\d{2,12}$/.test(merchant)||!/^\d{2,12}$/.test(feedId))throw Error("Informe IDs numéricos do anunciante e do feed.");
   if(!status?.enabled)throw Error("Recebimento desabilitado. Falta habilitar a área administrativa no Codespaces.");
   if(file.size>status.maxFileBytes)throw Error("O arquivo supera o tamanho máximo permitido.");
   const response=await fetch("/api/admin/awin-feeds/upload",{
    method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/gzip","X-UpPulse-Admin-Token":adminToken,
     "X-Awin-Merchant-Id":merchant,"X-Awin-Feed-Id":feedId},
    body:file
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.message||data.code||"Não foi possível analisar o feed.");
   setReport(data as UploadReport);
  }catch(e){setError(e instanceof Error?e.message:"Erro no envio")}
  finally{setPending(false)}
 }
 return <div className="min-h-screen bg-background pb-20">
  <header className="border-b bg-muted/30">
   <div className="container mx-auto px-4 py-5 flex items-center gap-3">
    <Link href="/admin/curadoria/listas"><Button variant="ghost" size="icon" aria-label="Voltar à curadoria"><ArrowLeft/></Button></Link>
    <div><h1 className="text-xl font-bold">Curadoria / Feeds de parceiros</h1>
     <p className="text-sm text-muted-foreground">Recebimento e análise de arquivos AWIN no ambiente de testes</p></div>
   </div>
  </header>
  <main className="container mx-auto px-4 py-7 max-w-4xl space-y-5">
   <Card className="p-5 space-y-2">
    <h2 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Receber novo feed</h2>
    <p className="text-sm text-muted-foreground">Escolha o arquivo no seu computador. Não é necessário localizar pastas do Codespaces, descompactar o GZIP ou enviar dados para o GitHub.</p>
    <p className="text-sm">Este processo <strong>recebe, verifica e armazena</strong> o feed para homologação. Não importa produtos para o catálogo e não publica ofertas automaticamente.</p>
   </Card>
   <Card className="p-5">
    <form onSubmit={submit} className="space-y-4">
     <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-1.5"><Label htmlFor="awin-merchant">ID do anunciante AWIN</Label>
       <Input id="awin-merchant" value={merchant} onChange={e=>setMerchant(e.target.value)} required inputMode="numeric"/></div>
      <div className="space-y-1.5"><Label htmlFor="awin-feed">ID do feed AWIN</Label>
       <Input id="awin-feed" value={feedId} onChange={e=>setFeedId(e.target.value)} required inputMode="numeric"/></div>
     </div>
     <div className="space-y-1.5"><Label htmlFor="awin-file">Arquivo do parceiro (.csv.gz)</Label>
      <Input id="awin-file" type="file" accept=".gz,.csv.gz,application/gzip" onChange={e=>setFile(e.target.files?.[0]??null)} required/>
      {file&&<p className="text-sm text-muted-foreground flex items-center gap-2"><FileArchive className="h-4 w-4"/>{file.name} — {(file.size/1024).toFixed(0)} KB</p>}
     </div>
     <div className="space-y-1.5"><Label htmlFor="awin-token">Chave administrativa do ambiente de testes</Label>
      <Input id="awin-token" type="password" autoComplete="off" value={adminToken} onChange={e=>setAdminToken(e.target.value)} placeholder="Chave configurada no Codespaces" required/>
      <p className="text-xs text-muted-foreground">A chave fica somente nesta tela durante a sessão. Não é enviada ao GitHub nem gravada no catálogo.</p></div>
     {status&&!status.enabled&&<p className="text-sm rounded-md border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2"><AlertTriangle className="h-5 w-5 shrink-0"/>O módulo está instalado, mas o recebimento ainda não foi habilitado com uma chave administrativa neste ambiente.</p>}
     {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
     <Button type="submit" disabled={pending||!file||!status?.enabled} className="gap-2">
      <UploadCloud className="h-4 w-4"/>{pending?"Analisando arquivo…":"Enviar e analisar feed"}
     </Button>
    </form>
   </Card>
   {report&&<Card className="p-5 space-y-4" data-testid="awin-upload-result">
    <div className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 className="h-5 w-5"/>Arquivo recebido e auditado</div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
     {[["Registros",report.stats.rows],["Válidos no parser",report.stats.normalized],["Preço regular",report.stats.priceStates.REGULAR_PRICE??0],["Promoção comprovada",report.stats.priceStates.PROMOTION_CONFIRMED??0]].map(([label,value])=>
      <div key={label} className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{Number(value).toLocaleString("pt-BR")}</p></div>)}
    </div>
    <div className="text-sm space-y-1">
     <p><strong>Registros para revisão:</strong> {report.stats.eligibility.REVIEW_REQUIRED??0}</p>
     <p><strong>Fora do escopo:</strong> {report.stats.eligibility.OUT_OF_SCOPE_CONFIRMED??0}</p>
     <p><strong>Candidatos confirmados a tênis:</strong> {report.stats.eligibility.IN_SCOPE_CONFIRMED??0}</p>
     <p><strong>Produtos importados:</strong> 0 — <strong>publicados:</strong> 0</p>
     <p className="text-muted-foreground">Próxima etapa: homologar a importação e a comparação pelo Produto Mestre.</p>
    </div>
   </Card>}
  </main>
 </div>
}
