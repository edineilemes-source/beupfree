import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, UploadCloud, FileArchive, AlertTriangle, CheckCircle2, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
type Issue={row:number;name:string;reason:string};
type Audit={status:string;merchant:string;feedId:string;storedName:string;sha256:string;
 stats:{rows:number;normalized:number;invalid:number;priceStates:Record<string,number>;
 taxonomy:Record<string,number>;eligibility:Record<string,number>;reasons:Record<string,number>};
 issues:Issue[];issuesTruncated:boolean;accepted:number;discarded:number;review:number;imported:number;published:number;canProcess:boolean};
type ProcessReport={status:string;imported:number;unchanged:number;accepted:number;review:number;discarded:number;invalid:number;published:number;message:string};
const format=(n:number)=>n.toLocaleString("pt-BR");
export default function AwinFeedUpload(){
 const [file,setFile]=useState<File|null>(null);
 const [pending,setPending]=useState(false);
 const [processing,setProcessing]=useState(false);
 const [error,setError]=useState("");
 const [report,setReport]=useState<Audit|null>(null);
 const [processed,setProcessed]=useState<ProcessReport|null>(null);
 const {data:status,error:accessError}=useQuery<{enabled:boolean;maxFileBytes:number;staging:boolean}>({
  queryKey:["/api/admin/awin-feeds/status"],retry:false,
  queryFn:async()=>{const r=await fetch("/api/admin/awin-feeds/status",{credentials:"same-origin"});const j=await r.json();if(!r.ok)throw Error(j.message||j.code||"Acesso indisponível");return j}
 });
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setPending(true);setError("");setReport(null);setProcessed(null);
  try{
   if(!file||!file.name.toLowerCase().endsWith(".csv.gz"))throw Error("Selecione um arquivo AWIN .csv.gz");
   if(!status?.enabled)throw Error("Acesso administrativo não habilitado. Entre na conta autorizada.");
   if(file.size>status.maxFileBytes)throw Error("O arquivo supera o tamanho máximo permitido.");
   const response=await fetch("/api/admin/awin-feeds/upload",{
    method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/gzip","X-Awin-File-Name":file.name},body:file
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.message||data.code||"Falha na análise");
   setReport(data as Audit);
  }catch(e){setError(e instanceof Error?e.message:"Erro no envio")}
  finally{setPending(false)}
 }
 async function process(){
  if(!report)return;setProcessing(true);setError("");
  try{
   const response=await fetch("/api/admin/awin-feeds/process",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({merchant:report.merchant,feedId:report.feedId,sha256:report.sha256})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.message||data.code||"Processamento não concluído");
   setProcessed(data as ProcessReport);
  }catch(e){setError(e instanceof Error?e.message:"Falha no processamento")}
  finally{setProcessing(false)}
 }
 return <div className="min-h-screen bg-background pb-20">
  <header className="border-b bg-muted/30">
   <div className="container mx-auto px-4 py-5 flex items-center gap-3">
    <Link href="/admin/curadoria/listas"><Button variant="ghost" size="icon" aria-label="Voltar à curadoria"><ArrowLeft/></Button></Link>
    <div><h1 className="text-xl font-bold">Curadoria / Feeds de parceiros</h1>
     <p className="text-sm text-muted-foreground">Recebimento, validação e processamento do catálogo AWIN</p></div>
   </div>
  </header>
  <main className="container mx-auto px-4 py-7 max-w-5xl space-y-5">
   <Card className="p-5 space-y-2">
    <h2 className="text-lg font-semibold">Importar feed AWIN</h2>
    <p className="text-sm text-muted-foreground">A identificação do anunciante e do feed é lida do arquivo AWIN. Nenhum código é preenchido antecipadamente.</p>
    <p className="text-sm">Acesso vinculado à sessão administrativa autorizada, sem digitação de chave técnica nesta tela.</p>
   </Card>
   <Card className="p-5"><form onSubmit={submit} className="space-y-4">
    <div className="space-y-1.5"><Label htmlFor="awin-file">Arquivo do parceiro (.csv.gz)</Label>
     <Input id="awin-file" type="file" accept=".gz,.csv.gz,application/gzip" onChange={e=>setFile(e.target.files?.[0]??null)} required/>
     {file&&<p className="text-sm text-muted-foreground flex items-center gap-2"><FileArchive className="h-4 w-4"/>{file.name} — {(file.size/1024).toFixed(0)} KB</p>}
    </div>
    {accessError&&<p role="alert" className="text-sm text-destructive">{accessError instanceof Error?accessError.message:"Acesso administrativo indisponível"}</p>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={pending||!file||!status?.enabled} className="gap-2"><UploadCloud className="h-4 w-4"/>{pending?"Validando arquivo…":"Enviar e validar produtos"}</Button>
   </form></Card>
   {report&&<Card className="p-5 space-y-5" data-testid="awin-upload-result">
    <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-green-600"/>Feed validado: anunciante {report.merchant} · feed {report.feedId}</div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
     {([["Registros recebidos",report.stats.rows],["Aceitos para staging",report.accepted],["Descartados (fora de escopo)",report.discarded],["Em revisão",report.review],
      ["Linhas inválidas",report.stats.invalid],["Preço regular",report.stats.priceStates.REGULAR_PRICE??0],
      ["Promoção comprovada",report.stats.priceStates.PROMOTION_CONFIRMED??0],["Publicados nesta etapa",report.published]] as Array<[string,number]>).map(([label,value])=>
      <div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{format(value)}</p></div>)}
    </div>
    <div><h3 className="font-semibold mb-2">Motivos de rejeição ou revisão</h3>
     {Object.keys(report.stats.reasons).length===0?<p className="text-sm text-muted-foreground">Nenhum problema encontrado.</p>:
     <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Motivo</th><th className="p-2 text-right">Ocorrências</th></tr></thead><tbody>
      {Object.entries(report.stats.reasons).sort((a,b)=>b[1]-a[1]).map(([reason,total])=><tr className="border-b" key={reason}><td className="p-2">{reason}</td><td className="p-2 text-right">{format(total)}</td></tr>)}
     </tbody></table></div>}
    </div>
    <div><h3 className="font-semibold mb-2">Produtos com problemas — amostra de até 300 ocorrências</h3>
     <div className="overflow-x-auto max-h-80"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Linha</th><th className="p-2">Produto</th><th className="p-2">Motivo</th></tr></thead><tbody>
      {report.issues.map((issue,index)=><tr key={index} className="border-b"><td className="p-2">{issue.row}</td><td className="p-2">{issue.name}</td><td className="p-2">{issue.reason}</td></tr>)}
     </tbody></table></div>
     {report.issuesTruncated&&<p className="text-sm text-muted-foreground">Amostra limitada a 300 ocorrências. Os totais acima abrangem todo o arquivo.</p>}
    </div>
    {!processed?<div className="border-t pt-4 space-y-2">
     <p className="text-sm">Os produtos aceitos podem ser incorporados ao banco agora, sem executar comandos no terminal. Eles permanecem em staging até a validação de publicação.</p>
     <Button onClick={process} disabled={processing||report.accepted===0||!report.canProcess} className="gap-2"><PlayCircle className="h-4 w-4"/>{processing?"Gravando produtos…":`Processar ${format(report.accepted)} produtos aceitos`}</Button>
     {!report.canProcess&&<p className="text-sm text-destructive"><AlertTriangle className="inline h-4 w-4"/> Banco de catálogo indisponível para processamento.</p>}
    </div>:<div className="border-t pt-4 space-y-2" data-testid="awin-process-result">
     <p className="font-semibold text-green-700"><CheckCircle2 className="inline h-5 w-5 mr-2"/>Processamento concluído no banco</p>
     <p className="text-sm">Inseridos ou atualizados: {format(processed.imported)} · Já existentes sem alteração: {format(processed.unchanged)} · Publicados: {format(processed.published)}</p>
     <p className="text-sm text-muted-foreground">{processed.message}</p>
    </div>}
   </Card>}
  </main>
 </div>;
}
