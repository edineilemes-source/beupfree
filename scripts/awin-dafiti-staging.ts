import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createGunzip } from "node:zlib";
import pg from "pg";
import { parseAwinCsv } from "../server/integrations/awin/csv";
import { DafitiStagingRepository, eligibleDafitiItem, emptyDafitiImportReport, type DafitiEligibleItem } from "../server/integrations/awin/dafitiStaging";

const args = process.argv.slice(2);
const argument = (name: string) => { const inline = args.find((value) => value.startsWith(`${name}=`)); if (inline) return inline.slice(name.length + 1) || null; const index = args.indexOf(name); return index < 0 ? null : args[index + 1] ?? null; };
const file = argument("--file"), mode = argument("--mode") ?? "dry-run";
const expectedEligible = Number(argument("--expected-eligible") ?? "74968"), batchSize = Number(argument("--batch-size") ?? "250");
if (!file || !["dry-run", "staging"].includes(mode) || !Number.isInteger(expectedEligible) || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error("Uso: --file <feed.csv.gz> --mode=dry-run|staging [--expected-eligible=74968] [--batch-size=250]");

async function scan(path: string, onBatch?: (items: DafitiEligibleItem[]) => Promise<void>) {
  const report = emptyDafitiImportReport(), batch: DafitiEligibleItem[] = [];
  for await (const row of parseAwinCsv(createReadStream(path).pipe(createGunzip()))) {
    report.seen++;
    const candidate = eligibleDafitiItem(row);
    if (!candidate.item) { report.ignored++; report.ignoredReasons[candidate.reason] = (report.ignoredReasons[candidate.reason] ?? 0) + 1; continue; }
    report.eligible++; batch.push(candidate.item);
    if (onBatch && batch.length >= batchSize) { await onBatch(batch.splice(0)); report.batches++; }
  }
  if (onBatch && batch.length) { await onBatch(batch.splice(0)); report.batches++; }
  return report;
}

async function officialBaseline(pool: pg.Pool) {
  const result = await pool.query("SELECT (SELECT count(*)::int FROM products WHERE catalog_status=$1) published,(SELECT count(*)::int FROM external_product_identities e JOIN commerce_merchants m ON m.id=e.merchant_id WHERE m.external_merchant_id=$2) lauri_products,(SELECT count(*)::int FROM product_variants v JOIN commerce_merchants m ON m.id=v.merchant_id WHERE m.external_merchant_id=$2) lauri_variants,(SELECT count(*)::int FROM offers o JOIN commerce_merchants m ON m.id=o.merchant_id WHERE m.external_merchant_id=$2) lauri_offers", ["published", "118977"]);
  const baseline = result.rows[0];
  if (baseline.published !== 508 || baseline.lauri_products !== 484 || baseline.lauri_variants !== 1514 || baseline.lauri_offers !== 1514) throw new Error(`Baseline público/Lauri não íntegro: ${JSON.stringify(baseline)}`);
  return baseline;
}

async function main() {
  const path = resolve(file!);
  const preflightStarted = performance.now(), preflight = await scan(path);
  if (preflight.eligible !== expectedEligible) throw new Error(`Gate DAFITI001 falhou: elegíveis=${preflight.eligible}, esperado=${expectedEligible}; nenhuma escrita executada`);
  if (mode === "dry-run") { process.stdout.write(`${JSON.stringify({ mode, ...preflight, performance: { elapsedSeconds: Number(((performance.now() - preflightStarted) / 1000).toFixed(3)), maxRssKb: process.resourceUsage().maxRSS } }, null, 2)}\n`); return; }
  if (!args.includes("--confirm-official-staging")) throw new Error("Staging oficial exige --confirm-official-staging explícito");
  if (process.env.PUBLIC_DEMO_MODE !== "true") throw new Error("PUBLIC_DEMO_MODE deve ser true");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL oficial ausente");
  const pool = new pg.Pool({ connectionString, max: 3 });
  try {
    const baseline = await officialBaseline(pool), repository = new DafitiStagingRepository(pool);
    let initialized = false;
    const imported = emptyDafitiImportReport(), importStarted = performance.now(), observedAt = new Date();
    const streamed = await scan(path, async (batch) => {
      if (!initialized) { await repository.initialize(batch[0], observedAt); initialized = true; }
      const batchReport = await repository.importBatch(batch, observedAt);
      imported.created += batchReport.created; imported.updated += batchReport.updated; imported.unchanged += batchReport.unchanged;
    });
    imported.seen = streamed.seen; imported.eligible = streamed.eligible; imported.ignored = streamed.ignored; imported.invalid = streamed.invalid; imported.batches = streamed.batches; imported.ignoredReasons = streamed.ignoredReasons;
    await repository.finalize(observedAt); imported.roundTrips = repository.roundTrips;
    process.stdout.write(`${JSON.stringify({ mode, baseline, preflight: { seen: preflight.seen, eligible: preflight.eligible, ignored: preflight.ignored }, import: imported, performance: { preflightSeconds: Number(((importStarted - preflightStarted) / 1000).toFixed(3)), importSeconds: Number(((performance.now() - importStarted) / 1000).toFixed(3)), rowsPerSecond: Number((imported.seen / ((performance.now() - importStarted) / 1000)).toFixed(2)), maxRssKb: process.resourceUsage().maxRSS, batchSize } }, null, 2)}\n`);
  } finally { await pool.end(); }
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
