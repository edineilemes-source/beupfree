import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { anonymousFavoritesKey, readFavorites, userFavoritesKey, writeFavorites } from "./favoritesStorage";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

afterEach(() => { delete (globalThis as any).window; });
function browser() {
  const localStorage = new MemoryStorage();
  (globalThis as any).window = { localStorage };
  return localStorage;
}

describe("favorites local cache", () => {
  it("uses the preserved anonymous key and a distinct key per user", () => {
    assert.equal(anonymousFavoritesKey, "beupfree:favorites:v1");
    assert.equal(userFavoritesKey("A"), "beupfree:favorites:user:A:v1");
    assert.notEqual(userFavoritesKey("A"), userFavoritesKey("B"));
  });

  it("keeps anonymous, user A and user B isolated and restores anonymous data", () => {
    browser();
    const anonymous = [{ productId: "A", savedAt: "2026-01-01T00:00:00.000Z" }];
    const accountA = [{ productId: "C", savedAt: "2026-01-03T00:00:00.000Z" }];
    const accountB = [{ productId: "D", savedAt: "2026-01-04T00:00:00.000Z" }];
    writeFavorites(anonymous);
    writeFavorites(accountA, userFavoritesKey("user-a"));
    writeFavorites(accountB, userFavoritesKey("user-b"));
    assert.deepEqual(readFavorites(userFavoritesKey("user-a")), accountA);
    assert.deepEqual(readFavorites(userFavoritesKey("user-b")), accountB);
    assert.deepEqual(readFavorites(), anonymous, "logout must restore the untouched anonymous set");
  });

  it("drops invalid and duplicate cached entries safely", () => {
    const storage = browser();
    storage.setItem(anonymousFavoritesKey, JSON.stringify([
      { productId: "A", savedAt: "invalid" },
      { productId: "B", savedAt: "2026-01-01T00:00:00.000Z" },
      { productId: "B", savedAt: "2026-01-02T00:00:00.000Z" }, null,
    ]));
    assert.deepEqual(readFavorites(), [{ productId: "B", savedAt: "2026-01-01T00:00:00.000Z" }]);
  });
});
