import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, UploadCloud, FileArchive, AlertTriangle, CheckCircle2, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
type RegisteredStore={id:string;name:string;provider:string;externalMerchantId:string;active:boolean;feeds:Array<{id:string;externalFeedId:string;name:string|null;active:boolean;lastSeenAt:string|null;lastImportCompletedAt:string|null}>};
type Issue={row:number;name:string;reason:string};
type MasterReviewIssue={row:number;name:string;reason:string;productKey:string};
type Audit={status:string;merchant:string;feedId:string;storedName:string;sha256:string;
 masterSummary?:{inspected:number;unresolved:number;stageCandidates:number;byReason:Record<string,number>;parserVersion:string};masterReviews?:MasterReviewIssue[];masterReviewsTotal?:number;
 stats:{rows:number;normalized:number;invalid:number;priceStates:Record<string,number>;
 taxonomy:Record<string,number>;eligibility:Record<string,number>;reasons:Record<string,number>};
 issues:Issue[];issuesTotal:number;issuesPageSize:number;accepted:number;discarded:number;review:number;imported:number;published:number;canProcess:boolean};
type MasterPreview={merchantId:string;previewOnly:boolean;parserVersion:string;samples:Array<{externalIdentityId:string;productId:string;rawName:string;identity:{master:{brand:string|null;productType:string|null;modelTokens:string[];modelFamily:string|null;version:string|null;technicalQualifiers:string[]};variant:{colors:string[];size:{value:string;system:string}|null};ambiguities:string[]};normalization:{size:{raw:string|null;normalized:number|null;status:string};color:{raw:string|null;normalized:string[]|null;status:string}}}>};
type MasterShadowReport={merchantExternalId:string;scanned:number;crossMerchantCandidates:number;limit:number;truncated:boolean;mode:string;coverageLimited:boolean;conclusions:string;versions:{parser:string;matcher:string};stats:{merchantProducts:number;evaluatedPairs:number;master:Record<string,number>;variant:Record<string,number>;simulatedGroups:number;singletons:number;coverageLimited?:boolean}|null;groups:Array<{members:number}>;reviewPairs:Array<{left:string;right:string;reasons:string[];decision:string}>;warnings:string[];published:number;merged:number};
type PipelineStep={stage:string;status:"DONE"|"PARTIAL"|"PENDING"|"NOT_VERIFIED";done:number|null;expected:number|null;reason:string};
type CurationWorkflow={workflowVersion:string;nextAction:string;blockers:string[];readyToRequestPublication:boolean;publicationAuthorized:boolean;executeMode:string};
type MerchantAudit={workflow?:CurationWorkflow;pipeline:{stages:Record<string,PipelineStep>;versions:{identity:{parser:string;matcher:string}};publicationApproved:boolean};merchant:{name:string;id:string};counts:{offers:number;distinctProducts:number;activeOffers:number;identities:number|null;stagedIdentities:number|null;promotionEvidence:number|null;classifiedProducts:number|null;eligibleClassifications:number|null;normalizedVariants:number|null;masterMemberships:number|null;masterIdentities:number|null;searchProducts:number|null;availableSearchProducts:number|null};steps:{received:boolean;masterCovered:boolean;catalogClassified:boolean;priceAudited:boolean;projected:boolean;storeVisibleInFilter:boolean};note:string;storeFacetRule:string};
type PublicationJob={status:"QUEUED"|"RUNNING"|"COMPLETED"|"BLOCKED"|"NOT_ENABLED";phase:string;reason?:string;published?:number;result?:{status:string;availableSearchProducts?:number;catalogTotal?:number}};
type ProcessReport={status:string;imported:number;unchanged:number;accepted:number;review:number;discarded:number;invalid:number;published:number;publication?:PublicationJob;message:string};
const format=(n:number)=>n.toLocaleString("pt-BR");
export default function AwinFeedUpload(){
 const [file,setFile]=useState<File|null>(null);
 const [pending,setPending]=useState(false);
 const [processing,setProcessing]=useState(false);
 const [error,setError]=useState("");
 const [report,setReport]=useState<Audit|null>(null);
 const [issuesPage,setIssuesPage]=useState(1);
 const [visibleIssues,setVisibleIssues]=useState<Issue[]>([]);
 const [loadingIssues,setLoadingIssues]=useState(false);
 const [masterReviewPage,setMasterReviewPage]=useState(1);
 const [visibleMasterReviews,setVisibleMasterReviews]=useState<MasterReviewIssue[]>([]);
 const [masterReviewLoading,setMasterReviewLoading]=useState(false);
 const [processed,setProcessed]=useState<ProcessReport|null>(null);
 const [publication,setPublication]=useState<PublicationJob|null>(null);
 const [merchantAudit,setMerchantAudit]=useState<MerchantAudit|null>(null);
 const [masterPreview,setMasterPreview]=useState<MasterPreview|null>(null);
 const [masterShadow,setMasterShadow]=useState<MasterShadowReport|null>(null);
 const [shadowLoading,setShadowLoading]=useState(false);
 const [previewLoading,setPreviewLoading]=useState(false);
 const [auditLoading,setAuditLoading]=useState(false);
 const [auditMerchant,setAuditMerchant]=useState("17698");
 async function inspectMasterComparisons(id:string){
  if(!/^\d{2,12}$/.test(id))return;
  setShadowLoading(true);setMasterShadow(null);
  try{
   const response=await fetch(`/api/admin/awin-feeds/merchant/${id}/master-shadow?limit=100`,{credentials:"same-origin"});
   const data=await response.json();
   if(!response.ok)throw Error(data.message||data.code||"Simulação de comparação indisponível");
   setMasterShadow(data as MasterShadowReport);
  }catch(e){setError(e instanceof Error?e.message:"Falha na simulação do Produto Mestre")}
  finally{setShadowLoading(false)}
 }
 async function loadMasterPreview(id:string){
  if(!/^[0-9]{2,12}$/.test(id))return;
  setPreviewLoading(true);
  try{
   const response=await fetch(`/api/admin/awin-feeds/merchant/${id}/master-preview`,{credentials:"same-origin"});
   const data=await response.json();
   if(!response.ok)throw Error(data.message||data.code||"Prévia indisponível");
   setMasterPreview(data as MasterPreview);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível consultar o Produto Mestre")}
  finally{setPreviewLoading(false)}
 }
 async function refreshMerchantAudit(id:string){
  if(!/^[0-9]{2,12}$/.test(id))return;
  setAuditLoading(true);
  try{
   const r=await fetch(`/api/admin/awin-feeds/merchant/${id}/audit`,{credentials:"same-origin"});
   const data=await r.json();
   if(!r.ok)throw Error(data.message||data.code||"Auditoria indisponível");
   setMerchantAudit(data as MerchantAudit);
   setMasterPreview(null);setMasterShadow(null);
  }catch(e){setError(e instanceof Error?e.message:"Falha na auditoria")}
  finally{setAuditLoading(false)}
 }
 const {data:status,error:accessError}=useQuery<{enabled:boolean;maxFileBytes:number;staging:boolean;temporaryAccess:boolean;automaticPublication?:boolean}>({
  queryKey:["/api/admin/awin-feeds/status"],retry:false,
  queryFn:async()=>{const r=await fetch("/api/admin/awin-feeds/status",{credentials:"same-origin"});const j=await r.json();if(!r.ok)throw Error(j.message||j.code||"Acesso indisponível");return j}
 });
 const {data:storeRegistry,refetch:refreshStores}=useQuery<{stores:RegisteredStore[];total:number}>({
  queryKey:["/api/admin/awin-feeds/stores"],retry:false,
  queryFn:async()=>{
   const r=await fetch("/api/admin/awin-feeds/stores",{credentials:"same-origin"});
   const data=await r.json();
   if(!r.ok)throw Error(data.message||data.code||"Cadastro de lojas indisponível");
   return data;
  }
 });
 // The actual publish operation runs in a separate checked background worker.
 // Poll a durable server-side job; closing the tab must not cancel processing.
 useEffect(()=>{
  if(!report||!publication||!["QUEUED","RUNNING"].includes(publication.status))return;
  let active=true;
  const poll=async()=>{
   try{
    const path=`/api/admin/awin-feeds/publication/${report.merchant}/${report.feedId}/${report.sha256}`;
    const response=await fetch(path,{credentials:"same-origin",cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw Error(data.message||data.code||"Falha ao consultar a publicação");
    if(!active)return;
    setPublication(data as PublicationJob);
    if(data.status==="COMPLETED"){
     void refreshMerchantAudit(report.merchant);
     void refreshStores();
    }
   }catch(e){
    if(active)setError(e instanceof Error?e.message:"Falha ao consultar a publicação");
   }
  };
  void poll();
  const timer=setInterval(()=>void poll(),3500);
  return()=>{active=false;clearInterval(timer)};
 },[report?.merchant,report?.feedId,report?.sha256,publication?.status]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setPending(true);setError("");setReport(null);setProcessed(null);setPublication(null);
  try{
   if(!file||!file.name.toLowerCase().endsWith(".csv.gz"))throw Error("Selecione um arquivo AWIN .csv.gz");
   if(!status?.enabled)throw Error("Importação desabilitada neste ambiente.");
   if(file.size>status.maxFileBytes)throw Error("O arquivo supera o tamanho máximo permitido.");
   const response=await fetch("/api/admin/awin-feeds/upload",{
    method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/gzip","X-Awin-File-Name":file.name},body:file
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.message||data.code||"Falha na análise");
   const audited=data as Audit;
   setReport(audited);
   setAuditMerchant(audited.merchant);
   setIssuesPage(1);setVisibleIssues(audited.issues);
   setMasterReviewPage(1);setVisibleMasterReviews(audited.masterReviews??[]);
   if(audited.accepted>0&&audited.canProcess)await process(audited);
  }catch(e){setError(e instanceof Error?e.message:"Erro no envio")}
  finally{setPending(false)}
 }
 async function goToIssuesPage(page:number){
  if(!report||page<1||page>Math.ceil(report.issuesTotal/report.issuesPageSize))return;
  setLoadingIssues(true);
  try{
   const url=`/api/admin/awin-feeds/report/${report.merchant}/${report.feedId}/${report.sha256}/issues?page=${page}`;
   const response=await fetch(url,{credentials:"same-origin"});
   const data=await response.json();
   if(!response.ok)throw Error(data.code||"Não foi possível carregar os problemas.");
   setVisibleIssues(data.issues as Issue[]);
   setIssuesPage(page);
  }catch(e){setError(e instanceof Error?e.message:"Falha na consulta das ocorrências")}
  finally{setLoadingIssues(false)}
 }
 async function changeMasterReviewPage(page:number){
  if(!report||page<1||page>Math.ceil((report.masterReviewsTotal??0)/300))return;
  setMasterReviewLoading(true);
  try{
   const url=`/api/admin/awin-feeds/report/${report.merchant}/${report.feedId}/${report.sha256}/master-reviews?page=${page}`;
   const response=await fetch(url,{credentials:"same-origin"});
   const data=await response.json();
   if(!response.ok)throw Error(data.code||"Falha ao consultar divergências do Produto Mestre");
   setVisibleMasterReviews(data.items as MasterReviewIssue[]);
   setMasterReviewPage(page);
  }catch(e){setError(e instanceof Error?e.message:"Falha na consulta")}
  finally{setMasterReviewLoading(false)}
 }
 async function process(audit:Audit|null=report){
  if(!audit)return;setProcessing(true);setError("");
  try{
   const response=await fetch("/api/admin/awin-feeds/process",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({merchant:audit.merchant,feedId:audit.feedId,sha256:audit.sha256})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.message||data.code||"Processamento não concluído");
   setProcessed(data as ProcessReport);
   setPublication((data as ProcessReport).publication??null);
   await refreshMerchantAudit(audit.merchant);
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
   <Card className="p-5 space-y-3" data-testid="registered-stores">
    <div className="flex items-center justify-between gap-2 flex-wrap">
     <div><h2 className="text-lg font-semibold">Lojas cadastradas e feeds</h2><p className="text-xs text-muted-foreground">Lojas reais do catálogo. Escolha uma para auditar; nenhum produto é publicado nesta consulta.</p></div>
     <Button variant="outline" size="sm" onClick={()=>void refreshStores()}>Atualizar lista</Button>
    </div>
    {storeRegistry?.stores.length===0&&<p className="text-sm text-muted-foreground">Nenhuma loja cadastrada no banco conectado.</p>}
    {storeRegistry?.stores.map(store=><div key={store.id} className="rounded-md border p-3 flex justify-between items-center gap-3 flex-wrap">
     <div><p className="font-semibold">{store.name}</p>
      <p className="text-xs text-muted-foreground">{store.provider} · anunciante {store.externalMerchantId} · {store.feeds.length} feed(s)</p>
      {store.feeds.map(feed=><p key={feed.id} className="text-xs text-muted-foreground">Feed {feed.externalFeedId} · última importação: {feed.lastImportCompletedAt?new Date(feed.lastImportCompletedAt).toLocaleString("pt-BR"):"não registrada"}</p>)}
     </div>
     <Button variant="outline" size="sm" onClick={()=>{setAuditMerchant(store.externalMerchantId);void refreshMerchantAudit(store.externalMerchantId)}}>Auditar esta loja</Button>
    </div>)}
   </Card>
   <Card className="p-5 space-y-3" data-testid="merchant-audit">
    <h2 className="text-lg font-semibold">Auditoria da loja — Produto Mestre e publicação</h2>
    <div className="flex flex-wrap gap-2 items-end">
     <div className="space-y-1"><Label htmlFor="merchant-audit-id">ID AWIN da loja</Label>
      <Input id="merchant-audit-id" value={auditMerchant} onChange={e=>setAuditMerchant(e.target.value)} inputMode="numeric" className="w-40"/></div>
     <Button variant="outline" disabled={auditLoading||!/^[0-9]{2,12}$/.test(auditMerchant)} onClick={()=>void refreshMerchantAudit(auditMerchant)}>
      {auditLoading?"Conferindo…":"Verificar etapas no banco"}
     </Button>
    </div>
    {merchantAudit&&<div className="space-y-3" data-testid="merchant-audit-result">
     <p className="font-semibold">{merchantAudit.merchant.name} — AWIN {merchantAudit.merchant.id}</p>
     <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {([["Ofertas no banco",merchantAudit.counts.offers],["Produtos distintos",merchantAudit.counts.distinctProducts],
      ["Identidades do parceiro",merchantAudit.counts.identities],["Identidades com Master",merchantAudit.counts.masterMemberships],
      ["Produtos classificados",merchantAudit.counts.classifiedProducts],["Ofertas com preço auditado",merchantAudit.counts.promotionEvidence],
      ["Produtos projetados",merchantAudit.counts.searchProducts],["Disponíveis no filtro Loja",merchantAudit.counts.availableSearchProducts]] as Array<[string,number|null]>).map(([label,value])=>
       <div key={label} className="border rounded-md p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value===null?"Indisponível":format(value)}</p></div>)}
     </div>
     <div className="grid sm:grid-cols-2 gap-2">
      {([["Ofertas importadas",merchantAudit.steps.received],["Cobertura do Produto Mestre",merchantAudit.steps.masterCovered],
        ["Classificação do catálogo",merchantAudit.steps.catalogClassified],["Validação comercial",merchantAudit.steps.priceAudited],
        ["Projeção da vitrine",merchantAudit.steps.projected],["Loja disponível nos filtros",merchantAudit.steps.storeVisibleInFilter]] as Array<[string,boolean]>).map(([label,passed])=>
       <p key={label} className="border rounded-md p-2 text-sm">{passed?"✓":"Pendente"} — {label}</p>)}
     </div>
     {merchantAudit.workflow&&<div className="rounded-md border p-3 space-y-2" data-testid="curation-workflow-preflight">
      <p className="font-semibold">Plano automático da loja — pré-verificação</p>
      <p className="text-sm">Próxima etapa: <strong>{merchantAudit.workflow.nextAction.replaceAll("_"," ")}</strong></p>
      <p className="text-xs text-muted-foreground">Este é um diagnóstico somente leitura. Não dispara processamento de identidade, migração nem publicação.</p>
      {merchantAudit.workflow.blockers.length>0&&<div className="flex flex-wrap gap-1">{merchantAudit.workflow.blockers.map(code=><span key={code} className="rounded border px-2 py-1 text-xs">{code.replaceAll("_"," ")}</span>)}</div>}
      {merchantAudit.workflow.readyToRequestPublication&&<p className="text-sm">Cobertura registrada. A publicação exige validação de cada oferta, vínculo Master vigente e elegibilidade comercial.</p>}
     </div>}
     <div className="space-y-2 border-t pt-3">
      <h3 className="font-semibold">Esteira da Curadoria V3 — execução por etapa</h3>
      <p className="text-xs text-muted-foreground">Versões históricas preservadas: parser {merchantAudit.pipeline.versions.identity.parser}; matcher {merchantAudit.pipeline.versions.identity.matcher}. A cobertura não equivale a homologação de equivalência.</p>
      <div className="grid sm:grid-cols-2 gap-2">
       {Object.values(merchantAudit.pipeline.stages).map(step=><div key={step.stage} className="rounded-md border p-2 text-sm">
        <div className="font-medium">{step.stage.replaceAll("_"," ")} — {step.status==="DONE"?"Registrado":step.status==="PARTIAL"?"Parcial":step.status==="PENDING"?"Pendente":"Não verificado"}</div>
        <p className="text-xs text-muted-foreground">{step.done===null?"—":format(step.done)} / {step.expected===null?"—":format(step.expected)} · {step.reason}</p>
       </div>)}
      </div>
      <Button variant="outline" onClick={()=>void loadMasterPreview(merchantAudit.merchant.id)} disabled={previewLoading}>
       {previewLoading?"Lendo identidades…":"Inspecionar nome, modelo, cor e tamanho pelo Produto Mestre original"}
      </Button>
      <Button variant="outline" onClick={()=>void inspectMasterComparisons(merchantAudit.merchant.id)} disabled={shadowLoading}>
       {shadowLoading?"Executando comparações…":"Simular matcher original do Produto Mestre (100 identidades)"}
      </Button>
      {masterShadow&&<div className="rounded-md border p-3 space-y-2" data-testid="master-shadow-preview">
       <p className="font-semibold">Comparação pelo matcher histórico — somente leitura</p>
       <p className="text-sm">Identidades da loja: {format(masterShadow.scanned)}. Candidatos de outras lojas: {format(masterShadow.crossMerchantCandidates)}. Pares avaliados: {format(masterShadow.stats?.evaluatedPairs??0)}. Pares em revisão: {format(masterShadow.stats?.master.REVIEW??0)}.</p>
       <p className="text-xs text-muted-foreground">A amostra não cobre necessariamente outros anunciantes nem todo o catálogo. Nenhum produto foi fundido ou publicado. {masterShadow.warnings.join(" · ")}</p>
       {masterShadow.reviewPairs.length>0&&<div className="max-h-44 overflow-y-auto">
        {masterShadow.reviewPairs.map((pair,index)=><p key={index} className="text-xs border-b p-2">Revisão: {pair.reasons.join(", ")||"Evidência insuficiente"}</p>)}
       </div>}
      </div>}
      {masterPreview&&<div className="space-y-2" data-testid="master-preview">
       <p className="text-xs text-muted-foreground">Amostra de até 20 identidades · parser {masterPreview.parserVersion}. Apenas leitura; nenhum produto é fundido ou publicado.</p>
       <div className="max-h-96 overflow-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left"><th className="p-2">Nome original</th><th className="p-2">Marca / modelo / geração</th><th className="p-2">Tamanho / cor</th><th className="p-2">Ambiguidades</th></tr></thead><tbody>
       {masterPreview.samples.map(sample=><tr key={sample.externalIdentityId} className="border-b">
        <td className="p-2">{sample.rawName}</td>
        <td className="p-2">{sample.identity.master.brand??"Não identificado"} · {sample.identity.master.modelTokens.join(" ")||"—"} · {sample.identity.master.version??"—"}</td>
        <td className="p-2">{sample.normalization.size.normalized??"—"} · {sample.normalization.color.normalized?.join(", ")||"—"}</td>
        <td className="p-2">{sample.identity.ambiguities.join(", ")||"Nenhuma sinalizada"}</td>
       </tr>)}
       </tbody></table></div>
      </div>}
     </div>
     <p className="text-xs text-muted-foreground">{merchantAudit.note} {merchantAudit.storeFacetRule}</p>
     {merchantAudit.steps.storeVisibleInFilter&&<Link href={`/catalogo?merchant=${encodeURIComponent(merchantAudit.merchant.name)}`}><Button variant="outline">Ver produtos dessa loja no catálogo</Button></Link>}
    </div>}
   </Card>
   <Card className="p-5 space-y-2">
    <h2 className="text-lg font-semibold">Importar feed AWIN</h2>
    <p className="text-sm text-muted-foreground">A identificação do anunciante e do feed é lida do arquivo AWIN. Nenhum código é preenchido antecipadamente.</p>
    <p className="text-sm">Homologação: após enviar, a Curadoria faz triagem, importa somente os tênis aprovados e verifica automaticamente Produto Mestre, preços, catálogo e filtro Loja. A publicação ocorre somente após todas as verificações.</p>
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
      ["Promoção comprovada",report.stats.priceStates.PROMOTION_CONFIRMED??0],["Publicados diretamente no upload",report.published]] as Array<[string,number]>).map(([label,value])=>
      <div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{format(value)}</p></div>)}
    </div>
    <div><h3 className="font-semibold mb-2">Motivos de rejeição ou revisão</h3>
     {Object.keys(report.stats.reasons).length===0?<p className="text-sm text-muted-foreground">Nenhum problema encontrado.</p>:
     <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Motivo</th><th className="p-2 text-right">Ocorrências</th></tr></thead><tbody>
      {Object.entries(report.stats.reasons).sort((a,b)=>b[1]-a[1]).map(([reason,total])=><tr className="border-b" key={reason}><td className="p-2">{reason}</td><td className="p-2 text-right">{format(total)}</td></tr>)}
     </tbody></table></div>}
    </div>
    {report.masterSummary&&<div className="space-y-2" data-testid="master-automatic-report">
     <h3 className="font-semibold">Robô de identificação — Produto Mestre original</h3>
     <p className="text-sm text-muted-foreground">Parser {report.masterSummary.parserVersion} · {format(report.masterSummary.inspected)} registros analisados automaticamente · {format(report.masterSummary.unresolved)} com ambiguidades de identidade. Divergências não geram fusão automática nem publicação.</p>
     {Object.entries(report.masterSummary.byReason).length>0&&<div className="flex flex-wrap gap-2">{Object.entries(report.masterSummary.byReason).map(([reason,total])=><span key={reason} className="rounded-md border px-2 py-1 text-xs">{reason}: {format(total)}</span>)}</div>}
     {visibleMasterReviews.length>0&&<div className="max-h-64 overflow-y-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Linha</th><th className="p-2">Produto</th><th className="p-2">Pendência da identidade</th></tr></thead><tbody>
      {visibleMasterReviews.map(issue=><tr key={issue.row} className="border-b"><td className="p-2">{issue.row}</td><td className="p-2">{issue.name}</td><td className="p-2">{issue.reason}</td></tr>)}
     </tbody></table></div>}
     {(report.masterReviewsTotal??0)>300&&<div className="flex items-center justify-between gap-2">
      <Button variant="outline" disabled={masterReviewLoading||masterReviewPage===1} onClick={()=>void changeMasterReviewPage(masterReviewPage-1)}>Anterior</Button>
      <span className="text-sm">Página {masterReviewPage} de {Math.ceil((report.masterReviewsTotal??0)/300)}</span>
      <Button variant="outline" disabled={masterReviewLoading||masterReviewPage>=Math.ceil((report.masterReviewsTotal??0)/300)} onClick={()=>void changeMasterReviewPage(masterReviewPage+1)}>Próxima</Button>
     </div>}
    </div>}
    <div><h3 className="font-semibold mb-2">Produtos com problemas — {format(report.issuesTotal)} produtos com ocorrências</h3>
     <div className="overflow-x-auto max-h-80"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Linha</th><th className="p-2">Produto</th><th className="p-2">Motivo</th></tr></thead><tbody>
      {visibleIssues.map((issue,index)=><tr key={index} className="border-b"><td className="p-2">{issue.row}</td><td className="p-2">{issue.name}</td><td className="p-2">{issue.reason}</td></tr>)}
     </tbody></table></div>
     {report.issuesTotal>report.issuesPageSize&&<div className="flex items-center justify-between gap-3 py-3">
      <Button variant="outline" onClick={()=>void goToIssuesPage(issuesPage-1)} disabled={loadingIssues||issuesPage<=1}>Anterior</Button>
      <p className="text-sm">Página {issuesPage} de {Math.ceil(report.issuesTotal/report.issuesPageSize)}</p>
      <Button variant="outline" onClick={()=>void goToIssuesPage(issuesPage+1)} disabled={loadingIssues||issuesPage>=Math.ceil(report.issuesTotal/report.issuesPageSize)}>Próxima</Button>
     </div>}
    </div>
    {!processed?<div className="border-t pt-4 space-y-2">
     <p className="text-sm">Os produtos aprovados são processados automaticamente. A publicação na vitrine de homologação ocorre após verificação do Produto Mestre, preços, classificação e projeção.</p>
     <Button onClick={()=>void process()} disabled={processing||report.accepted===0||!report.canProcess} className="gap-2"><PlayCircle className="h-4 w-4"/>{processing?"Gravando produtos…":`Reprocessar ${format(report.accepted)} produtos aceitos`}</Button>
     {!report.canProcess&&<p className="text-sm text-destructive"><AlertTriangle className="inline h-4 w-4"/> Banco de catálogo indisponível para processamento.</p>}
    </div>:<div className="border-t pt-4 space-y-2" data-testid="awin-process-result">
     <p className="font-semibold text-green-700"><CheckCircle2 className="inline h-5 w-5 mr-2"/>Processamento concluído no banco</p>
     <p className="text-sm">Inseridos ou atualizados: {format(processed.imported)} · Já existentes sem alteração: {format(processed.unchanged)} · Publicados: {format(processed.published)}</p>
     <p className="text-sm text-muted-foreground">{processed.message}</p>
     {publication&&<div className="rounded-lg border p-3 space-y-2" data-testid="automatic-publication-status">
      <p className="font-semibold">Publicação automática na homologação</p>
      {["QUEUED","RUNNING"].includes(publication.status)&&<>
       <p className="text-sm" role="status">Processando: {publication.phase.replaceAll("_"," ").toLowerCase()}.</p>
       <p className="text-xs text-muted-foreground">O trabalho continua no servidor mesmo se esta página for fechada. Não reenvie o feed enquanto a validação estiver em andamento.</p>
      </>}
      {publication.status==="COMPLETED"&&<>
       <p className="font-semibold text-green-700" role="status">
        Produtos aprovados e disponíveis no catálogo: {format(publication.published??publication.result?.availableSearchProducts??0)}
       </p>
       <p className="text-sm">As demais lojas foram preservadas. Produtos rejeitados ou em revisão não foram publicados.</p>
       {merchantAudit?.merchant?.name&&<Link href={`/catalogo?merchant=${encodeURIComponent(merchantAudit.merchant.name)}`}>
        <Button variant="outline">Ver produtos da loja na vitrine</Button>
       </Link>}
      </>}
      {publication.status==="BLOCKED"&&<p className="text-sm text-destructive" role="alert">
       Publicação interrompida para preservar os dados. Staging mantido. Motivo: {publication.reason??publication.phase}.
      </p>}
      {publication.status==="NOT_ENABLED"&&<p className="text-sm text-muted-foreground" role="status">
       A publicação automática está desativada neste ambiente. O staging foi preservado; nada foi liberado sem verificação.
      </p>}
     </div>}
    </div>}
   </Card>}
  </main>
 </div>;
}
