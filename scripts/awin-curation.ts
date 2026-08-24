import pg from "pg";
import { AwinCurationService, type CurationFilters } from "../server/integrations/awin/curation";

async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const command = args[0] ?? "quality";
  const connectionString = process.env.AWIN_CURATOR_DATABASE_URL;
  if (!connectionString) throw new Error("AWIN_CURATOR_DATABASE_URL é obrigatória; DATABASE_URL não é usada implicitamente");
  const pool = new pg.Pool({ connectionString, max: 2 });
  try {
    const service = new AwinCurationService(pool);
    if (command === "quality") return process.stdout.write(`${JSON.stringify(await service.qualityReport(), null, 2)}\n`);
    if (command !== "preview") throw new Error("Uso: awin:curation -- quality | preview [--search=] [--brand=] [--merchant=] [--min-price=] [--max-price=] [--has-description=true|false] [--has-gtin=true|false] [--min-variants=] [--available=true|false] [--state=staging] [--limit=20]");
    const boolean = (name: string) => value(name) == null ? undefined : value(name) === "true";
    const numeric = (name: string) => value(name) == null ? undefined : Number(value(name));
    const filters: CurationFilters = { search: value("--search"), brand: value("--brand"), merchant: value("--merchant"), minPrice: numeric("--min-price"), maxPrice: numeric("--max-price"), hasDescription: boolean("--has-description"), hasValidGtin: boolean("--has-gtin"), minVariants: numeric("--min-variants"), available: boolean("--available"), publicationState: value("--state") };
    const limit = Math.min(100, Math.max(1, numeric("--limit") ?? 20));
    const products = (await service.products(filters)).slice(0, limit).map((product) => ({ ...product, images: product.images.slice(0, 5), variants: product.variants, offers: product.offers.map((offer) => ({ ...offer, affiliateUrl: undefined, merchantUrl: undefined })) }));
    process.stdout.write(`${JSON.stringify({ count: products.length, products }, null, 2)}\n`);
  } finally { await pool.end(); }
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
