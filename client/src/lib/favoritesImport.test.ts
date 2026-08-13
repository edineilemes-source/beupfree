import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideFavoritesImport, favoritesImportDecisionKey, pendingFavoritesImport } from "./favoritesImport";

const local = [
  { productId: "A", savedAt: "2026-01-01T00:00:00.000Z" },
  { productId: "B", savedAt: "2026-01-02T00:00:00.000Z" },
];

describe("anonymous favorites import decision", () => {
  it("does not request confirmation when login has no anonymous favorites", () => {
    assert.equal(pendingFavoritesImport("user-a", []), null);
  });

  it("uses a decision marker isolated by account for the current browser session", () => {
    assert.notEqual(favoritesImportDecisionKey("user-a"), favoritesImportDecisionKey("user-b"));
  });

  it("requests confirmation with a snapshot when login or registration has anonymous favorites", () => {
    const pending = pendingFavoritesImport("user-a", local)!;
    assert.equal(pending.userId, "user-a");
    assert.deepEqual(pending.favorites, local);
    assert.notEqual(pending.favorites, local);
  });

  it("confirmation executes one deduplicated merge and remains idempotent server-side", async () => {
    const pending = pendingFavoritesImport("user-a", [...local, local[0]])!;
    let calls = 0;
    const result = await decideFavoritesImport("confirm", pending, async (ids) => {
      calls += 1;
      assert.deepEqual(ids, ["A", "B"]);
      return ["server-C", ...ids];
    });
    assert.equal(calls, 1);
    assert.deepEqual(result, ["server-C", "A", "B"]);
  });

  it("declining never calls merge and leaves local favorites intact for logout", async () => {
    const original = structuredClone(local);
    let calls = 0;
    const result = await decideFavoritesImport("decline", pendingFavoritesImport("user-b", local)!, async () => {
      calls += 1;
      return [];
    });
    assert.equal(calls, 0);
    assert.equal(result, null);
    assert.deepEqual(local, original);
  });

  it("a merge error propagates for retry without changing the pending/local snapshot", async () => {
    const pending = pendingFavoritesImport("user-a", local)!;
    const before = structuredClone(pending);
    await assert.rejects(decideFavoritesImport("confirm", pending, async () => {
      throw new Error("offline");
    }), /offline/);
    assert.deepEqual(pending, before);
    assert.deepEqual(local, before.favorites);
  });
});
