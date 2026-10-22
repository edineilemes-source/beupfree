import type { IdentityDecision } from "../../shared/product-identity/matcher";
import { compare, digest, pairKey } from "./contracts";

export interface GroupConflict { proposal: string[]; blockedPairs: Array<{ left: string; right: string; decision: IdentityDecision | "NOT_EVALUATED" }> }
/** Report-only groups. Every proposed merge checks its entire Cartesian boundary. */
export function simulateGroups(keys: string[], automaticPairs: Array<{ left: string; right: string }>,
  evaluate: (left: string, right: string) => IdentityDecision | "NOT_EVALUATED") {
  const groups = [...keys].sort(compare).map(key => [key]);
  const conflicts: GroupConflict[] = [];
  for (const edge of [...automaticPairs].sort((a, b) => compare(pairKey(a.left, a.right), pairKey(b.left, b.right)))) {
    const left = groups.find(g => g.includes(edge.left))!;
    const right = groups.find(g => g.includes(edge.right))!;
    if (left === right) continue;
    const blockedPairs: GroupConflict["blockedPairs"] = [];
    for (const a of left) for (const b of right) {
      const decision = evaluate(a, b);
      if (decision !== "AUTO_MATCH") blockedPairs.push({ left: a, right: b, decision });
    }
    if (blockedPairs.length) { conflicts.push({ proposal: [...left, ...right].sort(compare), blockedPairs }); continue; }
    left.push(...right); left.sort(compare);
    groups.splice(groups.indexOf(right), 1);
  }
  return { groups: groups.map(members => ({ id: `shadow-${digest(members)}`, members }))
    .sort((a, b) => compare(a.id, b.id)), conflicts };
}
