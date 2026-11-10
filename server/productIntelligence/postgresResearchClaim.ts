import { randomUUID } from "node:crypto";
import type { SqlExecutor } from "./postgresCache";
import type { ResearchClaim } from "./research";

export function createPostgresResearchClaim(executor: SqlExecutor): ResearchClaim {
  return async (card) => {
    const owner = randomUUID();
    const { rows } = await executor.query(
      `INSERT INTO research_claims (super_hash, master_id, owner)
       VALUES ($1, $2, $3) ON CONFLICT (super_hash) DO NOTHING RETURNING owner`,
      [card.superHash, card.masterId, owner],
    );
    if (rows.length === 0) {
      const { rows: [existing] } = await executor.query(
        "SELECT master_id FROM research_claims WHERE super_hash = $1",
        [card.superHash],
      );
      if (existing && existing.master_id !== card.masterId) throw new Error("CACHE_MASTER_ID_MISMATCH");
      return null;
    }
    // No automatic takeover: a stalled worker must never overlap a successor.
    return async () => {
      await executor.query(
        "DELETE FROM research_claims WHERE super_hash = $1 AND master_id = $2 AND owner = $3",
        [card.superHash, card.masterId, owner],
      );
    };
  };
}
