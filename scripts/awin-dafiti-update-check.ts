import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { createGunzip } from "node:zlib";
import pg from "pg";
import { parseAwinCsv } from "../server/integrations/awin/csv";
import { parseDafitiMoney } from "../server/integrations/awin/dafitiAudit";
import { DafitiStagingRepository, eligibleDafitiItem, type DafitiEligibleItem } from "../server/integrations/awin/dafitiStaging";
import type { AwinFeedItem } from "../server/integrations/awin/types";

const args = process.argv.slice(2), fileIndex = args.indexOf("--file"), file = fileIndex >= 0 ? args[fileIndex + 1] : null;
if (!file || !args.includes("--confirm-controlled-update")) throw new Error("Uso: --file <feed.csv.gz> --confirm-controlled-update");
if (process.env.PUBLIC_DEMO_MODE !== "true" || !process.env.DATABASE_URL) throw new Error("Ambiente oficial seguro não configurado");

async function firstEligible(path: string) {
  const rows: AwinFeedItem[] = [];
  for await (const row of parseAwinCsv(createReadStream(path).pipe(createGunzip()))) {
    if (eligibleDafitiItem(row).item) rows.push(structuredClone(row));
    if (rows.length === 3) break;
  }
  if (rows.length !== 3) throw new Error("Não foi possível obter três fixtures reais elegíveis");
  return rows;
}

function normalized(rows: AwinFeedItem[]): DafitiEligibleItem[] {
  return rows.map((row) => { const result = eligibleDafitiItem(row); if (!result.item) throw new Error(`Fixture deixou de ser elegível: ${result.reason}`); return result.item; });
}

async function main() {
  const originals = await firstEligible(resolve(file!)), modified = structuredClone(originals);
  modified[0].raw.search_price = (parseDafitiMoney(modified[0].raw.search_price)! - 0.01).toFixed(2);
  modified[1].raw.product_price_old = `${(parseDafitiMoney(modified[1].raw.product_price_old)! + 0.01).toFixed(2)} BRL`;
  modified[2].raw.in_stock = "true";
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const repository = new DafitiStagingRepository(pool), now = new Date();
  let update: { created: number; updated: number; unchanged: number } | null = null, restore: { created: number; updated: number; unchanged: number } | null = null;
  try {
    const changed = normalized(modified); await repository.initialize(changed[0], now); update = await repository.importBatch(changed, now);
  } finally {
    try { const source = normalized(originals); if (!update) await repository.initialize(source[0], new Date()); restore = await repository.importBatch(source, new Date()); }
    finally { await pool.end(); }
  }
  process.stdout.write(`${JSON.stringify({ selected: 3, sameProductKeys: normalized(originals).every((item, index) => item.productKey === normalized(modified)[index].productKey), sameVariantKeys: normalized(originals).every((item, index) => item.variantKey === normalized(modified)[index].variantKey), sameOfferKeys: normalized(originals).every((item, index) => item.offerKey === normalized(modified)[index].offerKey), update, restore, restored: restore?.updated === 3 }, null, 2)}\n`);
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
