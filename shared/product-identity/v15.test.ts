import assert from "node:assert/strict";
import test from "node:test";
import { parseProductIdentity as parse } from "./parser";
import { matchProductIdentities as match } from "./matcher";
const p = (name: string) => parse({ name: `Tênis Acme ${name}`, brand: "Acme" });
for (const [model, version] of [["1080", "14"], ["880", "15"], ["520", "9"]]) {
  for (const marker of ["v", "V"]) test(`V1.5 numeric model ${model}${marker}${version} equals spaced evidence`, () => {
    const a = p(`Fresh Foam X ${model} V${version} Feminino Preto`), b = p(`Fresh Foam X ${model}${marker}${version} Feminino Preto`);
    assert.deepEqual(a.master, b.master);
    assert.equal(match(a, b).masterDecision, "AUTO_MATCH");
    assert.equal(b.version, version);
  });
}
for (const token of ["revolution14", "x1080v14", "1080v14x", "abv14", "vapor15", "1080v", "1080v014", "01080v14", "1080v0", "1080v123", "12v14", "12345v14", "1080.5v14"]) {
  test(`V1.5 never splits legitimate/ambiguous token ${token}`, () => {
    const result = p(`Orbit ${token} Preto`);
    assert.equal(result.version, null);
    assert.ok(result.modelTokens.includes(token));
  });
}
for (const name of ["Orbit 1080v14", "Camiseta Acme 1080v14", "Tênis Acme SKU 1080v14", "Tênis Acme Ref 1080v14", "Tênis Acme MPN 1080v14"]) {
  test(`V1.5 requires sneaker model context: ${name}`, () => {
    const result = parse({ name, brand: "Acme" });
    assert.ok(result.modelTokens.includes("1080v14")); assert.equal(result.version, null);
  });
}
test("V1.5 missing brand prevents joined normalization; conflicting versions remain blocked", () => {
  assert.ok(parse({ name: "Tênis Unknown 1080v14" }).modelTokens.includes("1080v14"));
  assert.equal(match(p("1080v14"), p("1080 V15")).masterDecision, "NO_MATCH");
  assert.equal(match(p("1080v14"), p("880 V14")).masterDecision, "NO_MATCH");
  assert.equal(match(p("1080v14 V15"), p("1080 V14")).masterDecision, "REVIEW");
});
for (const color of ["Verde Limão", "Verde Claro", "Verde Escuro", "Azul Claro", "Azul Escuro", "Rosa Claro", "Rosa Escuro", "Cinza Claro", "Cinza Escuro"]) {
  test(`V1.5 suffix compound color ${color} keeps shade and removes no model token`, () => {
    const result = p(`Orbit Masculino ${color}`);
    assert.deepEqual(result.modelTokens, ["orbit"]);
    assert.equal(result.colors.length, 1);
    assert.equal(result.colors[0], color.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(" ", "-"));
  });
}
for (const model of ["Claro", "Escuro", "Limão", "Orbit Verde Claro Edition", "Orbit Verde Limão Tech", "Azul Claro Runner", "Limão Verde Runner"]) {
  test(`V1.5 color qualifiers inside models remain evidence: ${model}`, () => {
    const result = p(`${model} Preto`);
    assert.ok(result.modelTokens.includes(model.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(" ")[0]));
    assert.deepEqual(result.colors, ["preto"]);
    assert.equal(match(result, p("Orbit Preto")).masterDecision, "REVIEW");
  });
}
test("V1.5 shade differences never collapse into a Variant AUTO_MATCH", () => {
  for (const other of ["Verde", "Verde Escuro", "Verde Limão"]) {
    const result = match(p("Orbit Feminino Verde Claro"), p(`Orbit Feminino ${other}`));
    assert.equal(result.masterDecision, "AUTO_MATCH"); assert.equal(result.variantDecision, "NO_MATCH");
  }
  assert.deepEqual(p("Orbit Verde Claro e Preto").colors, ["preto", "verde-claro"]);
  assert.deepEqual(p("Orbit Verde Limão e Azul Escuro").colors, ["azul-escuro", "verde-limao"]);
});
test("real V1.4 title regressions use general parsing rules", () => {
  const a = parse({ name: "Tênis New Balance Fresh Foam X 1080 V14 Feminino Verde", brand: "New Balance" });
  const b = parse({ name: "Tênis New Balance Fresh Foam X 1080v14 Feminino Verde Claro", brand: "New Balance" });
  assert.deepEqual(a.master, b.master);
  assert.equal(match(a, b).masterDecision, "AUTO_MATCH"); assert.equal(match(a, b).variantDecision, "NO_MATCH");
  for (const [brand, stem] of [["Fila", "KR7 Pro Speed Tech"], ["New Balance", "Infinion 1080 V15"]]) {
    const parsed = ["Verde", "Verde Limão", "Verde Claro"].map(color => parse({ name: `Tênis ${brand} ${stem} Feminino ${color}`, brand }));
    assert.deepEqual(parsed[0].master, parsed[1].master); assert.deepEqual(parsed[0].master, parsed[2].master);
  }
});
