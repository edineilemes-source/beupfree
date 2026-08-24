import { basename, resolve } from "node:path";
import pg from "pg";
import { analyzeAwinFeed } from "../server/integrations/awin/dryRun";
import { openGzipFile } from "../server/integrations/awin/input";
import { parseAwinCsv } from "../server/integrations/awin/csv";
import { isInvalidAwinItem, normalizeAwinItem } from "../server/integrations/awin/normalize";
import { PostgresAwinRepository } from "../server/integrations/awin/repository";

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

if (mode === "dry-run") {
  process.stdout.write(`${JSON.stringify(await analyzeAwinFeed(openGzipFile(resolve(file)), feedId), null, 2)}\n`);
  return;
} else {
  if (!args.includes("--confirm-staging")) throw new Error("Persistência exige --mode=staging e --confirm-staging explícitos");
  const connectionString = process.env.AWIN_STAGING_DATABASE_URL;
  if (!connectionString) throw new Error("AWIN_STAGING_DATABASE_URL é obrigatória; DATABASE_URL não é usada por segurança");
  const items = [];
  let invalid = 0;
  for await (const row of parseAwinCsv(openGzipFile(resolve(file)))) {
    const item = normalizeAwinItem(row, { feedId });
    if (isInvalidAwinItem(item)) invalid++;
    else items.push(item);
  }
  const pool = new pg.Pool({ connectionString });
  try {
    const startedAt = performance.now();
    const report = await new PostgresAwinRepository(pool).import(items, { feedId });
    report.invalid = invalid;
    const elapsedSeconds = (performance.now() - startedAt) / 1000;
    process.stdout.write(`${JSON.stringify({ ...report, performance: { elapsedSeconds: Number(elapsedSeconds.toFixed(3)), rowsPerSecond: Number((items.length / elapsedSeconds).toFixed(2)), maxRssKb: process.resourceUsage().maxRSS } }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
