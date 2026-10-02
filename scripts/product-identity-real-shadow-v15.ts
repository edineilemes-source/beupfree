/** Manual V1.5 entrypoint. Reuses V1.4 read-only selection; never overwrites its report. */
import pg from "pg";
import { access, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { executeRealShadow, type ReadClient } from "./product-identity-real-shadow";

export const OUTPUT_V15 = "/tmp/product-identity-real-shadow-v15.json";
export async function executeRealShadowV15(env: NodeJS.ProcessEnv, factory: (url: string) => ReadClient,
  save: (path: string, content: string) => Promise<unknown> = (path, content) => writeFile(path, content, { flag: "wx" })) {
  // The injected callback prevents the legacy runner from writing OUTPUT (V1.4).
  return executeRealShadow(env, factory, async (_legacyPath, content) => {
    const report = JSON.parse(content);
    report.releaseVersion = "product-identity-v1.5";
    report.limitations = [...report.limitations,
      "V1.5 structural retrieval scores schedule candidates only; complete matcher verification remains mandatory.",
      "Top-K and retrieval/evaluation budgets remain unchanged; limited coverage is not a quality estimate."];
    return save(OUTPUT_V15, JSON.stringify(report, null, 2) + "\n");
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    // Refuse an existing output before opening a connection; wx also prevents races.
    try { await access(OUTPUT_V15); throw new Error("OUTPUT_ALREADY_EXISTS"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await executeRealShadowV15(process.env, url => new pg.Client({
      connectionString: url, connectionTimeoutMillis: 15000, query_timeout: 120000,
    }));
    console.log(`REAL_SHADOW_REPORT: ${OUTPUT_V15}`);
  })().catch(() => {
    console.error("REAL_SHADOW_V15_FAILED: check credentials, READ ONLY and that the V1.5 output does not exist; credentials suppressed.");
    process.exitCode = 1;
  });
}
