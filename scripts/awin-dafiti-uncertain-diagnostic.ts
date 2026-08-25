import pg from "pg";
import { classifyDafitiScope, DAFITI_MERCHANT_ID } from "../server/integrations/awin/dafitiCuration";

type Row = Record<string, unknown>;
const fold = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const count = (map: Map<string, number>, key: string) => map.set(key || "(empty)", (map.get(key || "(empty)") ?? 0) + 1);
const top = (map: Map<string, number>, limit = 30) => Array.from(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([value, products]) => ({ value, products }));
const stop = new Set("tenis sneaker masculino feminina feminino infantil unissex para com sem de da do das dos em e o a os as um uma preto branca branco bege azul cinza rosa verde marrom".split(" "));
const positive = /\b(tenis|sneaker|sapat[eê]nis|calcado esportivo)\b/i;
const negative = /\b(sandalia|chinelo|rasteira|sapatilha|scarpin|bota|mocassim|oxford|sapato social|papete)\b/i;
const activity = /\b(corrida|running|runner|caminhada|walking|treino|training|academia|futebol|futsal|basquete|basketball|skate|trail|quadra|volei|volleyball|performance|sportswear|casual|lifestyle)\b/i;

async function main() {
  const connectionString = process.env.AWIN_CURATOR_DATABASE_URL;
  if (!connectionString) throw new Error("AWIN_CURATOR_DATABASE_URL é obrigatória; DATABASE_URL não é usada");
  const pool = new pg.Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const user = (await client.query("SELECT current_user")).rows[0].current_user;
    const rows = (await client.query(`
      SELECT DISTINCT ON (e.product_id) e.product_id, p.main_name name,
        p.detailed_description description, r.raw_payload->>'brand_name' brand,
        r.raw_payload->>'merchant_category' merchant_category,
        r.raw_payload->>'merchant_product_category_path' category_path,
        r.raw_payload->>'merchant_product_second_category' second_category,
        r.raw_payload->>'merchant_product_third_category' third_category,
        r.raw_payload->>'product_type' product_type,
        r.raw_payload->>'Fashion:category' fashion_category,
        r.raw_payload->>'Fashion:suitable_for' suitable_for,
        v.attributes
      FROM commerce_merchants m
      JOIN external_product_identities e ON e.merchant_id=m.id
      JOIN products p ON p.id=e.product_id
      JOIN product_variants v ON v.product_id=p.id AND v.merchant_id=m.id
      LEFT JOIN commerce_raw_feed_items r ON r.merchant_id=m.id AND r.merchant_product_id=v.merchant_product_id
      WHERE m.external_merchant_id=$1
      ORDER BY e.product_id, v.id
    `, [DAFITI_MERCHANT_ID])).rows as Row[];
    const uncertain = rows.filter(row => classifyDafitiScope({
      merchantCategory: row.merchant_category, categoryPath: row.category_path,
      secondCategory: row.second_category, thirdCategory: row.third_category,
      productType: row.product_type, fashionCategory: row.fashion_category,
      name: row.name, description: row.description,
    }).scope === "UNCERTAIN");
    const causes = new Map<string, number>(), categories = new Map<string, number>(), brands = new Map<string, number>(), terms = new Map<string, number>();
    const examples = new Map<string, Array<Record<string, unknown>>>();
    for (const row of uncertain) {
      const structured = fold([row.merchant_category,row.category_path,row.second_category,row.third_category,row.product_type,row.fashion_category,JSON.stringify(row.attributes ?? {})].join(" "));
      const name = fold(row.name), description = fold(row.description);
      const labels: string[] = [];
      if (positive.test(structured)) labels.push("GENERIC_STRUCTURED_SNEAKER_SIGNAL");
      if (positive.test(name)) labels.push("NAME_SNEAKER_SIGNAL");
      if (activity.test(description) && !activity.test(`${structured} ${name}`)) labels.push("DESCRIPTION_ONLY_ACTIVITY_SIGNAL");
      if (negative.test(`${structured} ${name}`)) labels.push("CONFLICTING_NEGATIVE_FOOTWEAR_SIGNAL");
      if (!activity.test(`${structured} ${name} ${description}`)) labels.push("NO_STYLE_OR_ACTIVITY_SIGNAL");
      if (!positive.test(`${structured} ${name}`)) labels.push("NO_EXPLICIT_SNEAKER_SIGNAL");
      for (const label of labels.length ? labels : ["OTHER_UNMAPPED_SIGNAL"]) {
        count(causes, label);
        const sample = examples.get(label) ?? [];
        if (sample.length < 5) sample.push({ productId: row.product_id, brand: row.brand, name: row.name, merchantCategory: row.merchant_category });
        examples.set(label, sample);
      }
      count(categories, String(row.merchant_category ?? "")); count(brands, String(row.brand ?? ""));
      const uniqueTerms = new Set(fold(`${row.merchant_category ?? ""} ${row.name ?? ""}`).match(/[a-z0-9]{3,}/g) ?? []);
      for (const term of Array.from(uniqueTerms)) if (!stop.has(term) && !/^\d+$/.test(term)) count(terms, term);
    }
    const total = uncertain.length;
    console.log(JSON.stringify({ currentUser:user, analysedProducts:rows.length, oldUncertain:total,
      causes: top(causes, 50).map(item => ({ ...item, percent:+(item.products * 100 / total).toFixed(2), examples:examples.get(item.value) })),
      topCategories:top(categories), topBrands:top(brands), topTerms:top(terms, 50) }, null, 2));
    await client.query("ROLLBACK");
  } finally { client.release(); await pool.end(); }
}

void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
