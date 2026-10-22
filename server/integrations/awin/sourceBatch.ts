import type { NormalizedAwinItem } from "./types";

export type AwinSourceExpectation = { merchantId: string; feedId: string; expectedCount: number };

export function assertAwinSourceBatch(items: NormalizedAwinItem[], expectation: AwinSourceExpectation): void {
  if (!/^\d+$/.test(expectation.merchantId)) throw new Error("SOURCE_MERCHANT_REQUIRED");
  if (!/^\d+$/.test(expectation.feedId)) throw new Error("SOURCE_FEED_REQUIRED");
  if (!Number.isSafeInteger(expectation.expectedCount) || expectation.expectedCount < 1) throw new Error("SOURCE_EXPECTED_COUNT_REQUIRED");
  if (items.length !== expectation.expectedCount) throw new Error(`SOURCE_COUNT_MISMATCH:${items.length}:${expectation.expectedCount}`);
  const merchants = new Set(items.map((item) => item.provenance.merchantId));
  if (merchants.size !== 1 || !merchants.has(expectation.merchantId)) throw new Error("SOURCE_MERCHANT_MISMATCH");
  const feeds = new Set(items.map((item) => item.provenance.dataFeedId).filter(Boolean));
  if (feeds.size !== 1 || !feeds.has(expectation.feedId)) throw new Error("SOURCE_FEED_MISMATCH");
}
