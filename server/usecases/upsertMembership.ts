import { db } from "../db";
import { collectionMemberships } from "@shared/schema";
import { and, eq, lt, ne, sql } from "drizzle-orm";
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
        lt(collectionMemberships.lastSeenAt, thresholdDate)
      )
    );

  return result.rowCount ?? 0;
}
