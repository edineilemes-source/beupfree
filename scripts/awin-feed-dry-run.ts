import { basename, resolve } from "node:path";
import { analyzeAwinFeed } from "../server/integrations/awin/dryRun";
import { downloadGzipFeed, openGzipFile } from "../server/integrations/awin/input";

async function main() {
const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const useEnv = args.includes("--env");
if (fileIndex < 0 && !useEnv) throw new Error("Uso: npm run awin:dry-run -- --file <feed.csv.gz> | --env");

const file = fileIndex >= 0 ? args[fileIndex + 1] : null;
if (fileIndex >= 0 && !file) throw new Error("Caminho do feed não informado");
const configuredUrl = useEnv ? process.env.AWIN_PRODUCT_FEED_URL : null;
if (useEnv && !configuredUrl) throw new Error("AWIN_PRODUCT_FEED_URL não configurada");

const feedId = file ? basename(file).replace(/\.csv\.gz$/i, "") : (process.env.AWIN_PRODUCT_FEED_ID || "awin-env-feed");
const stream = file ? openGzipFile(resolve(file)) : await downloadGzipFeed(configuredUrl!);
const report = await analyzeAwinFeed(stream, feedId);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
