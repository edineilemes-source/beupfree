import type { ProductIdentity } from "./parser";

export type IdentityDecision = "AUTO_MATCH" | "REVIEW" | "NO_MATCH";
export interface DecisionEvidence {
  decision: IdentityDecision;
  /** Heuristic strength of this decision, not a calibrated probability. */
  confidence: number;
  reasons: string[];
  conflicts: string[];
}
const equal = (a: string[], b: string[]) => [...a].sort().join("|") === [...b].sort().join("|");
const isStrictSubmultiset = (a: string[], b: string[]) => a.length < b.length &&
  a.every(n => a.filter(value => value === n).length <= b.filter(value => value === n).length);
const qualifierGroups = [ ["low", "mid", "high"], ["fg", "tf", "md"], ["academy", "club", "elite", "pro"], ["ps", "jr"] ];

function matchMaster(a: ProductIdentity, b: ProductIdentity): DecisionEvidence {
  const conflicts: string[] = [];
  const reasons: string[] = [];
  if (a.brand && b.brand && a.brand !== b.brand) conflicts.push("BRAND_CONFLICT");
  if (a.productType && b.productType && a.productType !== b.productType) conflicts.push("PRODUCT_TYPE_CONFLICT");
  if (a.version && b.version && a.version !== b.version) conflicts.push("VERSION_CONFLICT");
  if (qualifierGroups.some(group => {
    const left = a.technicalQualifiers.filter(q => group.includes(q));
    const right = b.technicalQualifiers.filter(q => group.includes(q));
    return left.length && right.length && !equal(left, right);
  })) conflicts.push("TECHNICAL_QUALIFIER_CONFLICT");
  // Numeric model identifiers remain structural evidence, not generation guesses.
  const numbers = (p: ProductIdentity) => p.modelTokens.filter(t => /^\d+$/.test(t));
  const leftNumbers = numbers(a), rightNumbers = numbers(b);
  if (leftNumbers.length && rightNumbers.length && !equal(leftNumbers, rightNumbers)) {
    // Additional numbers are unresolved evidence, never inferred sizes or SKUs.
    // Preserve multiplicity and require REVIEW; replacements remain conflicts.
    if (isStrictSubmultiset(leftNumbers, rightNumbers) || isStrictSubmultiset(rightNumbers, leftNumbers)) {
      reasons.push("AMBIGUOUS_ADDITIONAL_MODEL_NUMBER");
    } else conflicts.push("MODEL_NUMBER_CONFLICT");
  }
  if (conflicts.length) return { decision: "NO_MATCH", confidence: 0, reasons: ["STRUCTURAL_CONFLICT"], conflicts };

  if (!a.brand || !b.brand) reasons.push("BRAND_EVIDENCE_MISSING");
  if (a.ambiguities.length || b.ambiguities.length) reasons.push("AMBIGUOUS_PARSE");
  if ([a, b].some(p => qualifierGroups.some(group => p.technicalQualifiers.filter(q => group.includes(q)).length > 1))) reasons.push("AMBIGUOUS_TECHNICAL_QUALIFIERS");
  if (!a.modelTokens.length || !b.modelTokens.length) reasons.push("MODEL_EVIDENCE_MISSING");
  else if (!equal(a.modelTokens, b.modelTokens)) reasons.push("MODEL_EVIDENCE_DIFFERS");
  if (Boolean(a.version) !== Boolean(b.version)) reasons.push("VERSION_PRESENT_ON_ONE_SIDE");
  if (!equal(a.technicalQualifiers, b.technicalQualifiers)) reasons.push("TECHNICAL_QUALIFIER_EVIDENCE_DIFFERS");
  if (Boolean(a.productType) !== Boolean(b.productType)) reasons.push("PRODUCT_TYPE_PRESENT_ON_ONE_SIDE");
  // Generic descriptors alone cannot establish a model identity.
  const generic = new Set(["casual", "running", "corrida", "esportivo", "conforto", "lifestyle", "original", "novo"]);
  if (a.modelTokens.every(t => generic.has(t)) || b.modelTokens.every(t => generic.has(t))) reasons.push("INSUFFICIENT_DISTINCTIVE_MODEL_EVIDENCE");
  if (reasons.length) return { decision: "REVIEW", confidence: 0.5, reasons, conflicts };
  return { decision: "AUTO_MATCH", confidence: 0.95,
    reasons: ["SAME_BRAND", "SAME_MODEL_TOKEN_MULTISET", "COMPATIBLE_VERSION_EVIDENCE", "SAME_TECHNICAL_QUALIFIERS", "COLOR_AUDIENCE_ORDER_IGNORED"], conflicts };
}


export interface IdentityMatchResult extends DecisionEvidence {
  /** Legacy fields above alias master evidence; confidence retains the V1 scale. */
  masterDecision: IdentityDecision;
  variantDecision: IdentityDecision;
  masterConfidence: number;
  variantConfidence: number;
  master: DecisionEvidence;
  variant: DecisionEvidence;
}

function matchVariant(a: ProductIdentity, b: ProductIdentity, master: DecisionEvidence): DecisionEvidence {
  const left = a.variant, right = b.variant;
  const conflicts: string[] = [];
  const reasons: string[] = [];
  if (master.decision === "NO_MATCH") return { decision: "NO_MATCH", confidence: 0.99, reasons: ["MASTER_INCOMPATIBLE"], conflicts: [...master.conflicts] };
  if (master.decision !== "AUTO_MATCH") reasons.push("MASTER_NOT_CONFIRMED");
  if (left.ambiguities.length || right.ambiguities.length) reasons.push("AMBIGUOUS_VARIANT_PARSE");
  if (!left.colors.length || !right.colors.length) reasons.push("COLOR_EVIDENCE_MISSING");
  else if (!equal(left.colors, right.colors)) {
    if (left.colors.some(c => right.colors.includes(c))) reasons.push("COLORWAY_PARTIAL_OVERLAP");
    else conflicts.push("COLOR_CONFLICT");
  }
  // Gender and age are separate axes: child + female is not internally contradictory.
  for (const axis of [["MASCULINO", "FEMININO", "UNISSEX"], ["INFANTIL"], ["BABY"]]) {
    const l = left.audience.filter(v => axis.includes(v)), r = right.audience.filter(v => axis.includes(v));
    if (l.length > 1 || r.length > 1) reasons.push("AMBIGUOUS_AUDIENCE");
    else if (l.length && r.length && !equal(l, r)) conflicts.push("AUDIENCE_CONFLICT");
    else if (!equal(l, r)) reasons.push("AUDIENCE_PRESENT_ON_ONE_SIDE");
  }
  if (left.size && right.size) {
    if (left.size.system !== right.size.system) reasons.push("SIZE_SYSTEM_DIFFERS");
    else if (left.size.value !== right.size.value) conflicts.push("SIZE_CONFLICT");
  } else if (left.size || right.size) reasons.push("SIZE_PRESENT_ON_ONE_SIDE");
  if (left.gtin && right.gtin && left.gtin !== right.gtin) conflicts.push("GTIN_CONFLICT");
  if (left.mpn && right.mpn && left.mpn !== right.mpn) reasons.push("MPN_DIFFERS");
  // A shared identifier cannot erase an explicit structural contradiction.
  if (conflicts.length) return { decision: "NO_MATCH", confidence: 0.99, reasons: ["EXPLICIT_VARIANT_CONFLICT", ...reasons], conflicts };
  const sameGtin = left.gtin && left.gtin === right.gtin;
  if (sameGtin && reasons.every(r => ["COLOR_EVIDENCE_MISSING", "AUDIENCE_PRESENT_ON_ONE_SIDE", "SIZE_PRESENT_ON_ONE_SIDE"].includes(r))) {
    return { decision: "AUTO_MATCH", confidence: 0.98, reasons: ["SAME_VALIDATED_GTIN"], conflicts };
  }
  if (reasons.length) return { decision: "REVIEW", confidence: 0.5, reasons: [...new Set(reasons)], conflicts };
  return { decision: "AUTO_MATCH", confidence: 0.85,
    reasons: ["MASTER_CONFIRMED", "SAME_OBSERVED_VARIANT_ATTRIBUTES", "UNOBSERVED_ATTRIBUTES_NOT_PROVEN", ...(left.mpn && left.mpn === right.mpn ? ["SAME_BRAND_SCOPED_MPN"] : [])], conflicts };
}

export function matchProductIdentities(a: ProductIdentity, b: ProductIdentity): IdentityMatchResult {
  const legacy = matchMaster(a, b);
  const master = { ...legacy, confidence: legacy.decision === "NO_MATCH" ? 0.99 : legacy.confidence };
  const variant = matchVariant(a, b, master);
  return { ...legacy, masterDecision: master.decision, variantDecision: variant.decision,
    masterConfidence: master.confidence, variantConfidence: variant.confidence, master, variant };
}

/** Evidence signature for audit grouping, not a persistent or verified product ID. */
export function masterIdentityKey(identity: ProductIdentity): string {
  const p = identity.master;
  return JSON.stringify([p.brand, p.productType, p.modelTokens, p.version, p.technicalQualifiers]);
}
