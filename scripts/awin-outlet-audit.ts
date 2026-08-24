import { readFile } from "node:fs/promises";
import pg from "pg";
import { buildOutletAudit, LAURI_OUTLET_URL, loadAwinAuditProducts, parseLauriOutletHtml, type AwinAuditProduct } from "../server/integrations/awin/outletAudit";

async function main() {
  const args = process.argv.slice(2); const json = args.includes("--json");
  const value = (name: string) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const htmlFile = value("--html-file");
  if (!htmlFile) throw new Error(`Uso: awin:outlet-audit -- --html-file=<arquivo> [--json] [--outlet-only]. A URL oficial é ${LAURI_OUTLET_URL}; a CLI não faz crawling implícito.`);
  const html = await readFile(htmlFile, "utf8"); const items = parseLauriOutletHtml(html);
  let awin: AwinAuditProduct[] = [];
  if (!args.includes("--outlet-only")) {
    const connectionString = process.env.AWIN_CURATOR_DATABASE_URL;
    if (!connectionString) throw new Error("AWIN_CURATOR_DATABASE_URL é obrigatória; DATABASE_URL não é usada implicitamente");
    const pool = new pg.Pool({ connectionString, max: 1 });
    try { awin = await loadAwinAuditProducts(pool); } finally { await pool.end(); }
  }
  const report = buildOutletAudit(items, awin);
  if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write([`Outlet: ${report.outlet.observed}`, `Confirmadas: ${report.outlet.promotionConfirmed}`, `Incertas: ${report.outlet.promotionUncertain}`, `Não promocionais: ${report.outlet.notPromotional}`, `Matches finais Awin: ${report.matching.matchedToAwin}`].join("\n")+"\n");
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
