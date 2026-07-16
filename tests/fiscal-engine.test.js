const assert = require("node:assert/strict");
const engine = require("../fiscal-engine.js");

function calculate(overrides) {
  return engine.calculateIcmsSt({
    product: "1000.00", discount: "0", freight: "0", insurance: "0", other: "0", ipi: "0",
    icmsBase: "1000.00", icmsRate: "12", icmsValue: "120.00", hasOwnIcmsValue: true,
    stBase: "1400.00", stRate: "18", stValue: "132.00", stReduction: "0", mva: "40", hasMva: true,
    ...overrides,
  });
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test("ICMS-ST padrao", () => {
  const result = calculate({});
  assert.equal(result.status, "success");
  assert.equal(result.calculatedValues.stValue.raw, "132");
});

test("IPI compondo a base propria", () => {
  const result = calculate({ product: "1703.70", ipi: "88.59", icmsBase: "1792.29", icmsRate: "12", icmsValue: "215.07", stBase: "2098.601859", mva: "17.0734", stRate: "18", stValue: "162.68" });
  assert.deepEqual(result.ownBaseComposition.components.map((entry) => entry.key), ["product", "ipi"]);
  assert.equal(result.ownBaseComposition.calculated.raw, "1792.29");
});

test("MVA preserva alta precisao", () => {
  const result = calculate({ product: "4265.86", icmsBase: "4265.86", icmsRate: "4", icmsValue: "170.63", stBase: "4994.18", stRate: "18", stValue: "728.32", mva: "17.0734" });
  assert.equal(result.mva.raw, "17.073400");
  assert.equal(result.calculatedValues.stBase.raw, "4994.19");
  const roundedMva = calculate({ product: "4265.86", icmsBase: "4265.86", icmsRate: "4", icmsValue: "170.63", stBase: "4994.18", stRate: "18", stValue: "728.32", mva: "17.07" });
  assert.notEqual(roundedMva.calculatedValues.stBase.raw, result.calculatedValues.stBase.raw);
});

test("MVA inferida e identificada", () => {
  const result = calculate({ mva: "0", hasMva: false, stBase: "1170.734", stRate: "18", stValue: "90.73" });
  assert.equal(result.mva.source, "inferred");
  assert.equal(result.mva.raw, "17.073400");
});

test("Frete compondo a base", () => {
  const result = calculate({ product: "1000", freight: "50", icmsBase: "1050", icmsValue: "126", stBase: "1470", stValue: "138.60" });
  assert.ok(result.ownBaseComposition.components.some((entry) => entry.key === "freight"));
});

test("Desconto reduzindo a base", () => {
  const result = calculate({ product: "1000", discount: "100", icmsBase: "900", icmsValue: "108", stBase: "1260", stValue: "118.80" });
  assert.ok(result.ownBaseComposition.components.some((entry) => entry.key === "discount"));
});

test("Reducao da base ST", () => {
  const result = calculate({ stBase: "1120", stReduction: "20", stValue: "81.60" });
  assert.equal(result.calculatedValues.stBase.raw, "1120");
  assert.equal(result.status, "success");
});

test("Divergencia nao ganha justificativa inventada", () => {
  const result = calculate({ stBase: "9999", stValue: "1" });
  assert.notEqual(result.status, "success");
  assert.match(result.explanation, /nao reproduz integralmente/);
});

let failures = 0;
for (const entry of tests) {
  try { entry.run(); console.log(`OK  ${entry.name}`); }
  catch (error) { failures += 1; console.error(`ERRO ${entry.name}\n${error.stack}`); }
}
if (failures) process.exitCode = 1;
else console.log(`\n${tests.length} testes aprovados.`);
