import "dotenv/config";
import { basename, resolve } from "node:path";
import pg from "pg";
import { analyzeAwinFeed } from "../server/integrations/awin/dryRun";
import { openGzipFile } from "../server/integrations/awin/input";
import { parseAwinCsv } from "../server/integrations/awin/csv";
import { isInvalidAwinItem, normalizeAwinItem } from "../server/integrations/awin/normalize";
import { PostgresAwinRepository, type AwinImportProgress } from "../server/integrations/awin/repository";
import type { NormalizedAwinItem } from "../server/integrations/awin/types";

async function main() {
const args = process.argv.slice(2);
const argument = (name: string) => {
  const inline = args.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || null;
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1] ?? null;
};
const file = argument("--file");
const mode = argument("--mode") ?? "dry-run";
if (!file || !["dry-run", "staging"].includes(mode)) throw new Error("Uso: npm run awin:import -- --file <feed.csv.gz> --mode=dry-run|staging [--confirm-staging]");
const feedId = argument("--feed-id") ?? basename(file).replace(/\.csv\.gz$/i, "");
const expectedMerchant = argument("--merchant");
const expectedCountRaw = argument("--expected-count");

let invalid = 0;
async function* streamItems(): AsyncGenerator<NormalizedAwinItem> {
  for await (const row of parseAwinCsv(openGzipFile(resolve(file!)))) {
    const item = normalizeAwinItem(row, { feedId });
    if (isInvalidAwinItem(item)) invalid++;
    else yield item;
  }
}
if ((expectedMerchant && !expectedCountRaw) || (!expectedMerchant && expectedCountRaw)) throw new Error("--merchant e --expected-count devem ser informados juntos");

if (mode === "dry-run") {
  const analysis = await analyzeAwinFeed(openGzipFile(resolve(file)), feedId);
  if (expectedMerchant || expectedCountRaw) {
    invalid = 0;
    let count = 0; const merchants = new Set<string>();
    for await (const item of streamItems()) { count++; merchants.add(item.provenance.merchantId); }
    if (count !== Number(expectedCountRaw)) throw new Error(`AWIN_SOURCE_COUNT_MISMATCH: expected=${expectedCountRaw} observed=${count}`);
    if (merchants.size !== 1 || !merchants.has(expectedMerchant!)) throw new Error("AWIN_SOURCE_MERCHANT_MISMATCH");
  }
  process.stdout.write(`${JSON.stringify(analysis, null, 2)}\n`);
  return;
} else {
  if (!args.includes("--confirm-staging")) throw new Error("Persistência exige --mode=staging e --confirm-staging explícitos");
  const connectionString = process.env.AWIN_STAGING_DATABASE_URL;
  if (!connectionString) throw new Error("AWIN_STAGING_DATABASE_URL é obrigatória; DATABASE_URL não é usada por segurança");
  const pool = new pg.Pool({ connectionString });
  try {
    const startedAt = performance.now();
    const chunkSize = Number(argument("--chunk-size") ?? "1000");
    const rawLastSeenRefreshHours = Number(argument("--raw-last-seen-refresh-hours") ?? "24");
    if (!Number.isFinite(rawLastSeenRefreshHours) || rawLastSeenRefreshHours < 0) throw new Error("AWIN_RAW_LAST_SEEN_REFRESH_HOURS_INVALID");
    let latest: AwinImportProgress = { phase: "initializing", processed: 0, batches: 0, roundTrips: 0 };
    const printProgress = () => {
      const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
      const step = latest.sqlStep ? ` step=${latest.sqlStep.name} stepMs=${latest.sqlStep.durationMs} rowCount=${latest.sqlStep.rowCount ?? "unknown"} stepRoundTrips=${latest.sqlStep.roundTrips}` : "";
      process.stderr.write(`[awin-import] phase=${latest.phase} rows=${latest.processed} batches=${latest.batches} rate=${(latest.processed / elapsedSeconds).toFixed(1)}/s elapsed=${elapsedSeconds.toFixed(1)}s roundTrips=${latest.roundTrips}${step}\n`);
    };
    const heartbeat = setInterval(printProgress, 10_000);
    let report;
    try {
      report = await new PostgresAwinRepository(pool).import(streamItems(), {
        feedId, chunkSize, expectedMerchant: expectedMerchant ?? undefined,
        expectedCount: expectedCountRaw === null ? undefined : Number(expectedCountRaw),
        rawItemLastSeenRefreshMs: rawLastSeenRefreshHours * 60 * 60 * 1_000,
        onProgress(value) { latest = value; printProgress(); },
      });
    } finally { clearInterval(heartbeat); }
    report.invalid = invalid;
    const elapsedSeconds = (performance.now() - startedAt) / 1000;
    process.stdout.write(`${JSON.stringify({ ...report, performance: { elapsedSeconds: Number(elapsedSeconds.toFixed(3)), rowsPerSecond: Number((report.seen / elapsedSeconds).toFixed(2)), maxRssKb: process.resourceUsage().maxRSS } }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
