import { db } from "../db";
import { collectionMemberships } from "@shared/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import type { CollectedItem } from "../services/mlCollectionsCollector";

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
 * Robust batch-based deactivation:
 * Marks as ESGOTADO all active memberships that were NOT seen in the current batch.
 * Only called when batch succeeded AND total_collected >= MIN_EXPECTED.
 */
export async function deactivateByBatch(
  collectionSourceId: string,
  currentBatchId: string
): Promise<number> {
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
        ne(collectionMemberships.lastBatchId, currentBatchId)
      )
    );

  return result.rowCount ?? 0;
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
