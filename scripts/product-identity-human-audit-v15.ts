/** Offline human safety gate; stored parses reconstruct the unchanged V1.2/V1.4 baseline. */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseProductIdentity } from "../shared/product-identity/parser";
import { matchProductIdentities, type IdentityMatchResult } from "../shared/product-identity/matcher";
import { canonical } from "../server/productIdentity/contracts";
type Label = "YES" | "NO" | "UNSURE";
const matrix = () => ({ AUTO_MATCH: { YES: 0, NO: 0, UNSURE: 0 }, REVIEW: { YES: 0, NO: 0, UNSURE: 0 }, NO_MATCH: { YES: 0, NO: 0, UNSURE: 0 } });
export function auditHumanPairs() {
  const root = new URL("../shared/product-identity/validation/", import.meta.url);
  const golden = JSON.parse(readFileSync(new URL("golden-v1.json", root), "utf8"));
  const labeling = JSON.parse(readFileSync(new URL("labeling-v1.json", root), "utf8"));
  const labels = new Map<string, { sameMaster: Label; sameVariant: Label }>(labeling.cases.map((c: any) => [c.id, c.humanLabel]));
  if (golden.cases.length !== 247 || labels.size !== 247 || labeling.cases.length !== 247 || new Set(golden.cases.map((c: any) => c.id)).size !== 247) throw new Error("HUMAN_DATASET_INVALID");
  const before = matrix(), after = matrix(), human = { YES: 0, NO: 0, UNSURE: 0 };
  const cases = golden.cases.map((c: any) => {
    const label = labels.get(c.id);
    if (!label || !["YES", "NO", "UNSURE"].includes(label.sameMaster)) throw new Error("HUMAN_LABEL_INVALID");
    const old: IdentityMatchResult = matchProductIdentities(c.futFanatics.identity, c.dafiti.identity);
    const parsed = [parseProductIdentity(c.futFanatics.identity.raw), parseProductIdentity(c.dafiti.identity.raw)];
    const current = matchProductIdentities(parsed[0], parsed[1]);
    human[label.sameMaster]++; before[old.masterDecision][label.sameMaster]++; after[current.masterDecision][label.sameMaster]++;
    return { id: c.id, human: label, names: [c.futFanatics.name, c.dafiti.name], before: old, after: current,
      parseChanged: parsed.map((p, i) => canonical(p) !== canonical(i ? c.dafiti.identity : c.futFanatics.identity)) };
  });
  return { total: cases.length, human, before, after,
    decisionChanges: cases.filter((c: any) => c.before.masterDecision !== c.after.masterDecision || c.before.variantDecision !== c.after.variantDecision),
    reasonChanges: cases.filter((c: any) => canonical([c.before.master, c.before.variant]) !== canonical([c.after.master, c.after.variant])),
    humanNoToAutoMatch: after.AUTO_MATCH.NO, humanUnsureToAutoMatch: after.AUTO_MATCH.UNSURE,
    passed: after.AUTO_MATCH.NO === 0 && after.AUTO_MATCH.UNSURE === 0, cases };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = auditHumanPairs();
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
