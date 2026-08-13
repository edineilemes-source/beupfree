import "dotenv/config";
import pg from "pg";

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5000";
export const DATABASE_URL = process.env.DATABASE_URL;
export const TEST_EMAIL_PREFIX = "regression-v1-";

export async function assertEnvironmentHealthy() {
  if (!DATABASE_URL) throw new Error("DATABASE_URL não existe. Configure um PostgreSQL antes da regressão.");
  let parsed: URL;
  try { parsed = new URL(DATABASE_URL); }
  catch { throw new Error("DATABASE_URL inválida: esperado PostgreSQL."); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL incompatível: esperado PostgreSQL.");
  }

  const pool = new pg.Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 5_000 });
  try {
    await pool.query("SELECT 1");
    const required = ["users", "user_favorites", "session"];
    const result = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
      [required],
    );
    const found = new Set(result.rows.map((row) => row.table_name));
    const missing = required.filter((table) => !found.has(table));
    if (missing.length) throw new Error(`Migration ausente: tabelas obrigatórias não encontradas: ${missing.join(", ")}.`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Migration ausente")) throw error;
    throw new Error(`PostgreSQL não está disponível em ${parsed.hostname}:${parsed.port || "5432"}: ${error instanceof Error ? error.message : String(error)}`);
  } finally { await pool.end(); }

  for (const endpoint of ["/", "/api/products?limit=1", "/api/auth/me"]) {
    let response: Response;
    try { response = await fetch(new URL(endpoint, BASE_URL)); }
    catch (error) { throw new Error(`Aplicação não responde em ${BASE_URL}: ${error instanceof Error ? error.message : String(error)}`); }
    const allowed = endpoint === "/api/auth/me" ? [401] : [200];
    if (!allowed.includes(response.status)) throw new Error(`Endpoint essencial ${endpoint} respondeu HTTP ${response.status}.`);
  }
}

export async function cleanupRegressionUsers() {
  if (!DATABASE_URL) return;
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    const result = await pool.query<{ id: string }>("SELECT id FROM users WHERE email LIKE $1", [`${TEST_EMAIL_PREFIX}%@example.test`]);
    const ids = result.rows.map((row) => row.id);
    if (!ids.length) return;
    await pool.query("DELETE FROM session WHERE sess->>'userId' = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM users WHERE id = ANY($1::varchar[])", [ids]);
  } finally { await pool.end(); }
}
