import assert from "node:assert/strict";
import test from "node:test";
import { parseProductIdentity as parse } from "./parser";
import { matchProductIdentities as match, type IdentityDecision } from "./matcher";

const pairs: Array<[string, string, string, IdentityDecision]> = [
  ["A: color order", "Tênis Mizuno Edo Cross Preto e Branco", "Tênis Mizuno Edo Cross Branco e Preto", "AUTO_MATCH"],
  ["A: Fastpace colors", "Tênis Fila Racer Fastpace Azul e Verde", "Tênis Fila Racer Fastpace Verde e Azul", "AUTO_MATCH"],
  ["B: feminine position", "Tênis Feminino Fila Recovery Bege e Bordô", "Tênis Fila Recovery Feminino Bege e Bordô", "AUTO_MATCH"],
  ["B: children position", "Infantil - Tênis Bibi Roller 2.0 Preto", "Tênis Bibi Roller 2.0 Infantil Preto", "AUTO_MATCH"],
  ["C: same V4", "Tênis New Balance Fresh Foam Arishi V4 Feminino Cinza e Preto", "Tênis New Balance Fresh Foam Arishi V4 Feminino Preto e Cinza", "AUTO_MATCH"],
  ["D: V4 vs V5", "New Balance Arishi V4", "New Balance Arishi V5", "NO_MATCH"],
  ["E: numeric model", "New Balance 480", "New Balance 480", "AUTO_MATCH"],
  ["F: same decimal", "Bibi Roller 2.0", "Bibi Roller 2.0", "AUTO_MATCH"],
  ["G: decimal conflict", "Bibi Roller 2.0", "Bibi Roller 3.0", "NO_MATCH"],
  ["H: same roman", "Joma Top Flex II", "Joma Top Flex II", "AUTO_MATCH"],
  ["I: roman conflict", "Joma Top Flex II", "Joma Top Flex III", "NO_MATCH"],
  ["J: missing bare generation", "Olympikus Flutua 2", "Olympikus Flutua", "REVIEW"],
  ["K: missing decimal", "Puma Carina 3.0", "Puma Carina", "REVIEW"],
  ["L: missing first generation", "Reebok Floatzig 1", "Reebok Floatzig", "REVIEW"],
  ["M: conflicting height", "Nike Court Vision Low", "Nike Court Vision Mid", "NO_MATCH"],
  ["M: conflicting surface", "Nike Mercurial Academy FG", "Nike Mercurial Academy TF", "NO_MATCH"],
  ["N: different brands", "Fila Recovery", "Mizuno Recovery", "NO_MATCH"],
  ["O: model order", "Tênis Skechers Altus Glide-Step Preto e Cinza", "Tênis Skechers Glide-Step Altus Cinza e Preto", "AUTO_MATCH"],
  ["missing Eros version", "Olympikus Eros 2", "Olympikus Eros", "REVIEW"],
  ["missing Maxxi version", "Fila Float Maxxi", "Fila Float Maxxi 2", "REVIEW"],
  ["missing roman", "Joma Top Flex", "Joma Top Flex II", "REVIEW"],
  ["missing BDP version", "Puma Carina BDP II", "Puma Carina BDP", "REVIEW"],
  ["missing Wing version", "Under Armour Charged Wing 2", "Under Armour Charged Wing", "REVIEW"],
  ["numeric model conflict", "New Balance 480", "New Balance 1080", "NO_MATCH"],
  ["internally conflicting qualifiers", "Nike Court Low Mid", "Nike Court Low Mid", "REVIEW"],
  ["missing qualifier", "Fila Recovery Pro", "Fila Recovery", "REVIEW"],
  ["unknown different qualifier preserved", "Fila Recovery GTX", "Fila Recovery", "REVIEW"],
  ["high similarity insufficient", "Fila Racer Fastpace", "Fila Racer Fastpace Plus", "REVIEW"],
  ["different product types", "Tênis Fila Recovery", "Chinelo Fila Recovery", "NO_MATCH"],
  ["missing brands", "Recovery", "Recovery", "REVIEW"],
  ["empty input", "", "", "REVIEW"],
  ["only brand", "Fila", "Fila", "REVIEW"],
  ["only generic model", "Tênis Fila Casual", "Tênis Fila Casual", "REVIEW"],
  ["multiple versions", "Fila Recovery V2 V3", "Fila Recovery V2 V3", "REVIEW"],
  ["audience differences", "Fila Recovery Feminino", "Fila Recovery Masculino", "AUTO_MATCH"],
  ["color differences", "Fila Recovery Preto", "Fila Recovery Branco", "AUTO_MATCH"],
  ["multiset preserves duplicates", "Fila Racer Racer", "Fila Racer", "REVIEW"],
];
for (const [label, left, right, decision] of pairs) test(label, () => {
  const a = parse({ name: left }), b = parse({ name: right });
  const before = JSON.stringify([a, b]);
  const result = match(a, b);
  assert.equal(result.decision, decision);
  assert.deepEqual(match(b, a), result, "matching must be symmetric");
  assert.equal(JSON.stringify([a, b]), before, "matching must not mutate inputs");
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
  assert.ok(result.reasons.length);
  if (decision === "NO_MATCH") assert.ok(result.conflicts.length);
});
for (const name of ["New Balance 480", "New Balance 1080", "Fila 88"]) test(`numeric model preserved: ${name}`, () => {
  const identity = parse({ name });
  assert.equal(identity.version, null);
  assert.ok(identity.modelTokens.includes(name.split(" ").at(-1)!));
});
for (const [signal, version] of [["V2", "2"], ["V3", "3"], ["V4", "4"], ["V15", "15"], ["2.0", "2"], ["3.0", "3"], ["4.0", "4"], ["II", "2"], ["III", "3"], ["IV", "4"], ["VI", "6"]]) test(`extract version ${signal}`, () => {
  assert.equal(parse({ name: `Fila Recovery ${signal}` }).version, version);
});
test("extract complete identity and reuse compound color aliases", () => {
  const identity = parse({ name: "Tênis Feminino NEW BALANCE Arishi V4 Pro Azul-Marinho e Bordô" });
  assert.equal(identity.brand, "new balance");
  assert.equal(identity.productType, "SNEAKER");
  assert.deepEqual(identity.modelTokens, ["arishi"]);
  assert.equal(identity.modelFamily, "arishi");
  assert.deepEqual(identity.audience, ["FEMININO"]);
  assert.deepEqual(identity.colors, ["azul-marinho", "bordo"]);
  assert.deepEqual(identity.technicalQualifiers, ["pro"]);
  assert.ok(identity.normalizedTokens.includes("v4"));
});
test("all required qualifiers survive extraction", () => {
  for (const q of "Low Mid Pro SE PS JR FG TF MD Academy Club Elite Slip-On".split(" ")) {
    assert.deepEqual(parse({ name: `Fila Recovery ${q}` }).technicalQualifiers, [q.toLowerCase()]);
  }
});
test("structured unknown brand supports neutral multi-marketplace input", () => {
  const a = parse({ brand: "  Ácme  ", name: "Tênis Acme Comet Preto" });
  const b = parse({ brand: "acme", name: "Tênis Comet Branco" });
  assert.equal(match(a, b).decision, "AUTO_MATCH");
});
test("brand metadata contradiction blocks automatic matching", () => {
  const a = parse({ brand: "Fila", name: "Tênis Puma Recovery" });
  assert.ok(a.ambiguities.includes("BRAND_EVIDENCE_CONFLICT"));
  assert.equal(match(a, a).decision, "REVIEW");
});
test("unknown integers are retained instead of guessed as generation", () => {
  const a = parse({ name: "Fila Unknown 7" });
  assert.equal(a.version, null);
  assert.deepEqual(a.modelTokens, ["7", "unknown"]);
  assert.equal(match(a, parse({ name: "Fila Unknown" })).decision, "REVIEW");
});
test("model color words inside names are retained", () => {
  assert.deepEqual(parse({ name: "Nike Air Black Max Preto" }).modelTokens, ["air", "black", "max"]);
});

const variantPairs: Array<[string, string, IdentityDecision, IdentityDecision]> = [
  ["Aramis Daily Slip Canvas Verde", "Aramis Daily Slip Canvas Preto", "AUTO_MATCH", "NO_MATCH"],
  ["New Balance FuelCell Rebel V5 Preto", "New Balance FuelCell Rebel V5 Verde", "AUTO_MATCH", "NO_MATCH"],
  ["New Balance FuelCell Rebel V5 Preto", "New Balance FuelCell Rebel V5 Feminino Preto", "AUTO_MATCH", "REVIEW"],
  ["New Balance 413 V3 Masculino", "New Balance 413 V3 Feminino", "AUTO_MATCH", "NO_MATCH"],
  ["Penalty Max 1000", "Penalty Max 300", "NO_MATCH", "NO_MATCH"],
  ["Bibi Roller 2.0 Preto", "Bibi Roller 2.0 Preto", "AUTO_MATCH", "AUTO_MATCH"],
  ["Bibi Roller 2.0 Preto", "Bibi Roller 2.0 Rosa", "AUTO_MATCH", "NO_MATCH"],
  ["Fila Float Maxxi 2 Pro Masculino", "Fila Float Maxxi 2 Pro Feminino", "AUTO_MATCH", "NO_MATCH"],
  ["Asics Japan S Branco e Preto", "Asics Japan S Branco", "AUTO_MATCH", "REVIEW"],
  ["Bibi Roller 2.0 Preto", "Bibi Roller 2.0", "AUTO_MATCH", "REVIEW"],
  ["Fila Recovery", "Fila Recovery", "AUTO_MATCH", "REVIEW"],
  ["Fila Recovery Feminino Infantil Preto", "Fila Recovery Feminino Preto", "AUTO_MATCH", "REVIEW"],
  ["Fila Recovery Masculino Feminino Preto", "Fila Recovery Feminino Preto", "AUTO_MATCH", "REVIEW"],
];
for (const [left, right, masterDecision, variantDecision] of variantPairs) test(`V1.1 ${left} / ${right}`, () => {
  const a = parse({ name: left }), b = parse({ name: right });
  const before = JSON.stringify([a, b]);
  const result = match(a, b);
  assert.equal(result.masterDecision, masterDecision);
  assert.equal(result.variantDecision, variantDecision);
  assert.deepEqual(match(b, a), result);
  assert.equal(JSON.stringify([a, b]), before);
  assert.equal(result.decision, result.masterDecision);
  if (variantDecision === "REVIEW") assert.ok(result.variantConfidence < result.masterConfidence);
});
for (const color of ["Coral", "Chalk", "Sand", "Taupe", "Olive"]) test(`V1.1 colorway ${color}`, () => {
  const p = parse({ name: `Tênis New Balance Fresh Foam X 880 V15 Feminino ${color}` });
  assert.deepEqual(p.modelTokens, ["880", "foam", "fresh", "x"]);
  assert.equal(p.version, "15");
  assert.deepEqual(p.ambiguities, []);
  assert.deepEqual(p.variant.colors, [color.toLowerCase()]);
});
test("V1.1 preserves unknown model, internal color word and raw input", () => {
  const raw = { name: "Tênis Acme Sand Quantumweave V3 Preto", brand: "Acme" };
  const p = parse(raw);
  assert.deepEqual(p.modelTokens, ["quantumweave", "sand"]);
  assert.deepEqual(p.raw, raw);
  assert.equal(p.master.modelFamily, p.modelFamily);
});
test("V1.1 scoped size affects variant only", () => {
  const a = parse({ name: "Bibi Roller 2.0 Preto", size: { value: "32", system: "BR" } });
  const b = parse({ name: "Bibi Roller 2.0 Preto", size: { value: "33", system: "BR" } });
  assert.equal(match(a, b).masterDecision, "AUTO_MATCH");
  assert.equal(match(a, b).variantDecision, "NO_MATCH");
  assert.equal(match(a, parse({ name: a.raw.name })).variantDecision, "REVIEW");
  assert.equal(match(a, parse({ name: a.raw.name, size: { value: "32", system: "EU" } })).variantDecision, "REVIEW");
  const titleSize = parse({ name: "Bibi Roller 2.0 Preto Tamanho 32" });
  assert.equal(titleSize.master.modelFamily, "roller");
  assert.equal(match(titleSize, titleSize).variantDecision, "REVIEW");
  assert.ok(titleSize.raw.name.includes("32"));
});
test("V1.1 validated GTIN supports missing variant evidence, never overrides conflicts", () => {
  const a = parse({ name: "Bibi Roller 2.0", gtin: "4006381333931" });
  const b = parse({ name: "Bibi Roller 2.0 Preto", gtin: "04006381333931" });
  assert.equal(match(a, b).variantDecision, "AUTO_MATCH");
  assert.equal(match(b, parse({ name: "Bibi Roller 2.0 Rosa", gtin: a.raw.gtin })).variantDecision, "NO_MATCH");
  assert.equal(match(a, parse({ name: "Bibi Roller 3.0", gtin: a.raw.gtin })).masterDecision, "NO_MATCH");
  const invalid = parse({ name: b.raw.name, gtin: "4006381333932" });
  assert.equal(invalid.variant.gtin, null);
  assert.equal(match(invalid, invalid).variantDecision, "REVIEW");
  assert.equal(match(a, parse({ name: a.raw.name, gtin: "012345678905" })).variantDecision, "NO_MATCH");
});
test("V1.1 MPN alone does not prove variant or erase structural evidence", () => {
  const a = parse({ name: "Bibi Roller 2.0", mpn: "PART-01" });
  assert.equal(match(a, a).variantDecision, "REVIEW");
});
test("V1.1 ambiguous color/model boundary cannot merge Easy Sand with Easy", () => {
  const a = parse({ name: "Tenis Aramis Easy Sand Cinza" });
  assert.ok(a.modelTokens.includes("sand"));
  assert.equal(match(a, parse({ name: "Tênis Aramis Easy Cinza" })).masterDecision, "REVIEW");
  assert.deepEqual(parse({ name: "Reebok Floatzig 1 Chalk/Sand/Pink" }).modelTokens, ["floatzig"]);
  assert.deepEqual(parse({ name: "Reebok Floatzig 1 Chalk e Sand" }).colors, ["chalk", "sand"]);
});
test("V1.1 baby and gender evidence is not lost in broad infant audience", () => {
  const a = parse({ name: "Tênis Klin Freestyle Infantil Preto", brand: "Klin" });
  const b = parse({ name: "Infantil - Tênis Klin Freestyle Baby Preto", brand: "Klin" });
  assert.equal(match(a, b).masterDecision, "AUTO_MATCH");
  assert.equal(match(a, b).variantDecision, "REVIEW");
  assert.equal(match(parse({name: "Bibi Roller Menino Preto"}), parse({name: "Bibi Roller Menina Preto"})).variantDecision, "NO_MATCH");
});
test("V1.1 multi-letter Roman generations keep order independence and conflicts", () => {
  assert.equal(match(parse({name: "Puma Club Era II Cinza"}), parse({name: "Puma Club II Era Branco"})).masterDecision, "AUTO_MATCH");
  assert.equal(match(parse({name: "Umbro Techno II Campo"}), parse({name: "Umbro Techno III Campo"})).masterDecision, "NO_MATCH");
  assert.equal(parse({name: "Puma X Ray 2 Square BDP II Branco"}).version, "2");
});
