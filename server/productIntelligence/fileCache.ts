import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ResearchCache, ResearchResult } from "./research";

/** Local durable pilot cache, not a replacement for the future PostgreSQL store.
 * No API keys, raw provider responses or offers are written here.
 * One process per cache directory; atomic rename prevents partial JSON files.
 */
export function createFileResearchCache(directory: string): ResearchCache {
  const pathFor = (key: string) => {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("INVALID_CACHE_KEY");
    return join(directory, key + ".json");
  };
  return {
    async get(key) {
      try {
        const parsed: unknown = JSON.parse(await readFile(pathFor(key), "utf8"));
        if (!parsed || typeof parsed !== "object") return null;
        const result = parsed as Partial<ResearchResult>;
        if (result.state !== "ENRICHED" || result.card?.superHash !== key ||
            !Array.isArray(result.card.fields) || !Array.isArray(result.warnings)) return null;
        return result as ResearchResult;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return null;
        throw error;
      }
    },
    async set(key, result) {
      if (result.state !== "ENRICHED" || result.card.superHash !== key) throw new Error("INVALID_CACHE_ENTRY");
      const target = pathFor(key);
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      const temporary = target + "." + randomUUID() + ".tmp";
      try {
        await writeFile(temporary, JSON.stringify(result), { mode: 0o600, flag: "wx" });
        await rename(temporary, target);
      } catch (error) {
        const { unlink } = await import("node:fs/promises");
        await unlink(temporary).catch(() => {});
        throw error;
      }
    },
  };
}
