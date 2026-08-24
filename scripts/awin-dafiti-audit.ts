import { createReadStream, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createGunzip } from "node:zlib";
import { auditDafitiFeed } from "../server/integrations/awin/dafitiAudit";

async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");
  const file = fileIndex >= 0 ? args[fileIndex + 1] : null;
  if (!file) throw new Error("Uso: node --import tsx scripts/awin-dafiti-audit.ts --file <feed.csv.gz>");
  const path = resolve(file);
  const size = statSync(path).size;
  const stream = createReadStream(path).pipe(createGunzip());
  const report = await auditDafitiFeed(stream, { file: basename(path), compressedBytes: size, gzipValid: true, encoding: "UTF-8", delimiter: "," });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
