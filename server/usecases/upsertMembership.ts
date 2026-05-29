import { db, pool } from "../db";
import { collectionMemberships } from "@shared/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import type { CollectedItem } from "../services/mlCollectionsCollector";

// Quantas coletas consecutivas um item pode ficar ausente do snapshot antes
// de ser marcado como esgotado (isActive=false). A página de ofertas do ML
// rotaciona quais produtos exibe a cada carregamento, então um item ainda à
// venda pode sumir de um snapshot e voltar no próximo. Anti-flapping: só
// desativa após MISSED_RUNS_THRESHOLD ausências seguidas.
const MISSED_RUNS_THRESHOLD = 2;

export interface UpsertMembershipInput {
  collectionSourceId: string;
  batchId: string;
  item: CollectedItem;
}

export async function upsertMembership(input: UpsertMembershipInput): Promise<void> {
  const { collectionSourceId, batchId, item } = input;

  const lookupConditions = item.externalItemId
    ? and(
        eq(collectionMemberships.collectionSourceId, collectionSourceId),
        eq(collectionMemberships.externalItemId, item.externalItemId)
      )
    : and(
        eq(collectionMemberships.collectionSourceId, collectionSourceId),
        eq(collectionMemberships.contentHash, item.contentHash)
      );

  const [existing] = await db
    .select()
    .from(collectionMemberships)
    .where(lookupConditions)
    .limit(1);

  if (existing) {
    await db
      .update(collectionMemberships)
      .set({
        lastSeenAt: new Date(),
        lastBatchId: batchId,
        rawTitle: item.nome,
        rawPrice: String(item.preco_atual),
        rawUrl: item.url,
        isActive: true,
        missedRunsCount: 0,
        // Also update contentHash in case it was stored as a short 8-char hash before
        contentHash: item.contentHash,
      })
      .where(eq(collectionMemberships.id, existing.id));
  } else {
    await db.insert(collectionMemberships).values({
      collectionSourceId,
      externalItemId: item.externalItemId,
      contentHash: item.contentHash,
      lastBatchId: batchId,
      rawTitle: item.nome,
      rawPrice: String(item.preco_atual),
      rawUrl: item.url,
      isActive: true,
      missedRunsCount: 0,
    });
  }
}

/**
 * Robust batch-based deactivation WITH anti-flapping:
 * For every active membership NOT seen in the current batch, increments
 * missedRunsCount. Only marks the item as ESGOTADO (isActive=false) once it has
 * been absent for MISSED_RUNS_THRESHOLD consecutive runs. Items seen again have
 * their missedRunsCount reset to 0 by upsertMembership.
 *
 * This prevents products that simply rotated out of one ML snapshot — but are
 * still for sale — from being wrongly flagged as sold out on a single miss.
 *
 * Only called when batch succeeded AND total_collected >= MIN_EXPECTED.
 * Returns the number of items actually deactivated in this run.
 */
export async function deactivateByBatch(
  collectionSourceId: string,
  currentBatchId: string
): Promise<number> {
  // Postgres evaluates all SET expressions against the OLD row, so both
  // `missed_runs_count + 1` and the CASE use the pre-update value consistently.
  const { rows } = await pool.query<{ is_active: boolean }>(
    `UPDATE collection_memberships
        SET missed_runs_count = missed_runs_count + 1,
            is_active = (missed_runs_count + 1 < $3)
      WHERE collection_source_id = $1
        AND is_active = true
        AND last_batch_id <> $2
      RETURNING is_active`,
    [collectionSourceId, currentBatchId, MISSED_RUNS_THRESHOLD]
  );

  return rows.filter((r) => r.is_active === false).length;
}

/**
 * Legacy time-based deactivation (kept for backward compat).
 */
export async function deactivateStaleMemberships(
  collectionSourceId: string,
  currentBatchId: string,
  antiFlappingThresholdMinutes: number
): Promise<number> {
  const thresholdDate = new Date(Date.now() - antiFlappingThresholdMinutes * 60 * 1000);

  const result = await db
    .update(collectionMemberships)
    .set({
      isActive: false,
      missedRunsCount: sql`${collectionMemberships.missedRunsCount} + 1`,
    })
    .where(
      and(
        eq(collectionMemberships.collectionSourceId, collectionSourceId),
        eq(collectionMemberships.isActive, true),
        ne(collectionMemberships.lastBatchId, currentBatchId),
        sql`${collectionMemberships.lastSeenAt} < ${thresholdDate}`
      )
    );

  return result.rowCount ?? 0;
}
