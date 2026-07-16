(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FiscalEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCALE_DIGITS = 12;
  const SCALE = 10n ** BigInt(SCALE_DIGITS);
  const MONEY_TOLERANCE = "0.01";
  const ROUNDING_LIMIT = "0.05";

  function pow10(value) { return 10n ** BigInt(value); }

  class Decimal {
    constructor(units) { this.units = units; }
    static from(value) {
      if (value instanceof Decimal) return value;
      let text = value === null || value === undefined || value === "" ? "0" : String(value).trim();
      if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
      const match = text.match(/^(-?)(\d+)(?:\.(\d+))?$/);
      if (!match) return new Decimal(0n);
      const fraction = (match[3] || "").slice(0, SCALE_DIGITS).padEnd(SCALE_DIGITS, "0");
      const units = BigInt(match[2]) * SCALE + BigInt(fraction || "0");
      return new Decimal(match[1] ? -units : units);
    }
    add(value) { return new Decimal(this.units + Decimal.from(value).units); }
    sub(value) { return new Decimal(this.units - Decimal.from(value).units); }
    mul(value) { return new Decimal(divRound(this.units * Decimal.from(value).units, SCALE)); }
    div(value) {
      const divisor = Decimal.from(value).units;
      return divisor === 0n ? new Decimal(0n) : new Decimal(divRound(this.units * SCALE, divisor));
    }
    abs() { return new Decimal(this.units < 0n ? -this.units : this.units); }
    round(digits) {
      const factor = pow10(SCALE_DIGITS - digits);
      return new Decimal(divRound(this.units, factor) * factor);
    }
    compare(value) { const other = Decimal.from(value).units; return this.units < other ? -1 : this.units > other ? 1 : 0; }
    isZero() { return this.units === 0n; }
    toNumber() { return Number(this.units) / Number(SCALE); }
    toString(digits) {
      const rounded = digits === undefined ? this : this.round(digits);
      const negative = rounded.units < 0n;
      const absolute = negative ? -rounded.units : rounded.units;
      const integer = absolute / SCALE;
      let fraction = (absolute % SCALE).toString().padStart(SCALE_DIGITS, "0");
      fraction = digits === undefined ? fraction.replace(/0+$/, "") : fraction.slice(0, digits);
      return `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
    }
  }

  function divRound(numerator, denominator) {
    if (denominator === 0n) return 0n;
    const negative = (numerator < 0n) !== (denominator < 0n);
    const a = numerator < 0n ? -numerator : numerator;
    const b = denominator < 0n ? -denominator : denominator;
    const quotient = a / b;
    const rounded = a % b * 2n >= b ? quotient + 1n : quotient;
    return negative ? -rounded : rounded;
  }

  const D = Decimal.from;
  const percentFactor = (rate) => D(rate).div(100);
  const output = (value, digits) => ({ raw: D(value).toString(digits), value: D(value).toNumber() });

  function compareFiscalValues(xmlValue, calculatedValue, config) {
    const tolerance = D(config && config.tolerance || MONEY_TOLERANCE);
    const roundingLimit = D(config && config.roundingLimit || ROUNDING_LIMIT);
    const difference = D(calculatedValue).sub(xmlValue);
    const absolute = difference.abs();
    const classification = absolute.compare(tolerance) <= 0 ? "exact" : absolute.compare(roundingLimit) <= 0 ? "rounding" : "divergent";
    return { xml: output(xmlValue), calculated: output(calculatedValue), difference: output(difference), absoluteDifference: output(absolute), classification };
  }

  const componentDefinitions = [
    { key: "discount", label: "Desconto", sign: -1, optional: true },
    { key: "freight", label: "Frete", sign: 1, optional: true },
    { key: "insurance", label: "Seguro", sign: 1, optional: true },
    { key: "other", label: "Outras despesas", sign: 1, optional: true },
    { key: "ipi", label: "IPI", sign: 1, optional: true },
  ];

  function compositionCandidates(values) {
    const active = componentDefinitions.filter((entry) => !D(values[entry.key]).isZero());
    const candidates = [];
    for (let mask = 0; mask < (1 << active.length); mask += 1) {
      let total = D(values.product);
      const components = [{ key: "product", label: "Mercadoria", sign: 1, included: true, amount: output(values.product) }];
      active.forEach((entry, index) => {
        const included = Boolean(mask & (1 << index));
        if (included) total = entry.sign > 0 ? total.add(values[entry.key]) : total.sub(values[entry.key]);
        components.push({ ...entry, included, amount: output(values[entry.key]) });
      });
      const standardMatches = active.reduce((score, entry, index) => score + (Boolean(mask & (1 << index)) === (entry.key !== "ipi") ? 1 : 0), 0);
      candidates.push({ total, components, standardMatches });
    }
    return candidates;
  }

  function confidenceFor(comparison, candidateCount) {
    if (comparison.classification === "exact") return candidateCount === 1 ? "high" : "medium";
    if (comparison.classification === "rounding") return "medium";
    return "low";
  }

  function chooseComposition(values, target, transform) {
    const ranked = compositionCandidates(values).map((candidate) => {
      const transformed = transform ? transform(candidate.total) : candidate.total;
      const comparison = compareFiscalValues(target, transformed);
      return { ...candidate, transformed, comparison };
    }).sort((a, b) => a.comparison.absoluteDifference.value - b.comparison.absoluteDifference.value || b.standardMatches - a.standardMatches);
    const best = ranked[0];
    const tied = ranked.filter((entry) => entry.comparison.absoluteDifference.raw === best.comparison.absoluteDifference.raw).length;
    return {
      components: best.components.filter((entry) => entry.included),
      excludedComponents: best.components.filter((entry) => entry.included === false),
      calculated: output(best.total),
      transformed: output(best.transformed),
      xml: output(target),
      difference: best.comparison.difference,
      comparison: best.comparison,
      confidence: confidenceFor(best.comparison, tied),
      alternativesWithSameDifference: tied,
    };
  }

  function analyzeIcmsBaseComposition(item) {
    return chooseComposition(item, item.icmsBase || 0);
  }

  function calculateOwnIcms(item, composition) {
    const base = item.icmsBase !== undefined && item.icmsBase !== "" ? item.icmsBase : composition ? composition.calculated.raw : 0;
    const calculated = D(base).mul(percentFactor(item.icmsRate || 0)).round(2);
    return { base: output(base), rate: output(item.icmsRate || 0, 6), calculated: output(calculated), xml: output(item.icmsValue || 0), comparison: compareFiscalValues(item.icmsValue || 0, calculated) };
  }

  function inferMva(params) {
    const base = D(params.baseBeforeMva);
    const reductionFactor = D(1).sub(percentFactor(params.reduction || 0));
    if (base.compare(0) <= 0 || reductionFactor.compare(0) <= 0) return null;
    const beforeReduction = D(params.stBase).div(reductionFactor);
    const value = beforeReduction.div(base).sub(1).mul(100);
    return { ...output(value, 6), source: "inferred" };
  }

  function calculateMvaAdjusted(params) {
    if (params.originalMva === undefined || params.interstateRate === undefined || params.internalRate === undefined) return null;
    const denominator = D(1).sub(percentFactor(params.internalRate));
    if (denominator.compare(0) <= 0) return null;
    const adjusted = D(1).add(percentFactor(params.originalMva)).mul(D(1).sub(percentFactor(params.interstateRate))).div(denominator).sub(1).mul(100);
    return { ...output(adjusted, 6), source: "calculated-adjusted" };
  }

  function analyzeIcmsStBaseComposition(item, mva) {
    const reductionFactor = D(1).sub(percentFactor(item.stReduction || 0));
    const transform = mva ? (base) => base.mul(D(1).add(percentFactor(mva.raw))).mul(reductionFactor).round(2) : null;
    return chooseComposition(item, item.stBase || 0, transform);
  }

  function reverseCalculateOwnIcmsFromSt(params) {
    const implicit = D(params.stBase).mul(percentFactor(params.stRate)).round(2).sub(params.stValue).round(2);
    return { implicit: output(implicit), xmlComparison: compareFiscalValues(params.ownXml || 0, implicit), calculatedComparison: compareFiscalValues(params.ownCalculated || 0, implicit) };
  }

  function calculateIcmsSt(item, config) {
    const ownComposition = analyzeIcmsBaseComposition(item);
    const ownIcms = calculateOwnIcms(item, ownComposition);
    let mva = item.hasMva ? { ...output(item.mva, 6), source: "xml" } : null;
    let stComposition;
    if (mva) stComposition = analyzeIcmsStBaseComposition(item, mva);
    else {
      const baseCandidate = ownComposition.comparison.classification !== "divergent" ? ownComposition.calculated.raw : chooseComposition(item, item.product).calculated.raw;
      mva = inferMva({ baseBeforeMva: baseCandidate, stBase: item.stBase, reduction: item.stReduction });
      stComposition = mva ? analyzeIcmsStBaseComposition(item, mva) : analyzeIcmsStBaseComposition(item, null);
    }
    const baseBeforeMva = D(stComposition.calculated.raw);
    const baseAfterMva = mva ? baseBeforeMva.mul(D(1).add(percentFactor(mva.raw))) : baseBeforeMva;
    const stBaseCalculated = baseAfterMva.mul(D(1).sub(percentFactor(item.stReduction || 0))).round(2);
    const presumed = D(item.stBase || stBaseCalculated).mul(percentFactor(item.stRate || 0)).round(2);
    const ownDeduction = item.hasOwnIcmsValue ? D(item.icmsValue) : D(ownIcms.calculated.raw);
    const stCalculated = presumed.sub(ownDeduction).round(2);
    const baseComparison = compareFiscalValues(item.stBase || 0, stBaseCalculated, config);
    const valueComparison = compareFiscalValues(item.stValue || 0, stCalculated, config);
    const reverse = reverseCalculateOwnIcmsFromSt({ stBase: item.stBase, stRate: item.stRate, stValue: item.stValue, ownXml: item.icmsValue, ownCalculated: ownIcms.calculated.raw });
    const status = valueComparison.classification === "exact" && baseComparison.classification === "exact" ? "success"
      : valueComparison.classification === "rounding" || baseComparison.classification === "rounding" ? "rounding"
      : stComposition.confidence === "low" ? "unidentified-base" : "divergent";
    const result = {
      xmlValues: item,
      ownBaseComposition: ownComposition,
      stBaseComposition: stComposition,
      ownIcms,
      mva,
      calculatedValues: { baseBeforeMva: output(baseBeforeMva), baseAfterMva: output(baseAfterMva), stBase: output(stBaseCalculated), presumedIcms: output(presumed), ownDeduction: output(ownDeduction), stValue: output(stCalculated) },
      differences: { stBase: baseComparison, stValue: valueComparison },
      reverse,
      adjustedMva: calculateMvaAdjusted(item.adjustedMvaParams || {}),
      status,
    };
    result.explanation = generateIcmsStExplanation(result);
    return result;
  }

  function generateIcmsStExplanation(result) {
    const included = result.ownBaseComposition.components.map((entry) => entry.label).join(", ");
    const mvaText = result.mva ? `A MVA ${result.mva.source === "xml" ? "informada" : "inferida matematicamente"} foi ${result.mva.raw}%.` : "Nao havia MVA suficiente para esta reconstrucao.";
    const deductionText = result.xmlValues.hasOwnIcmsValue ? "Foi deduzido prioritariamente o ICMS proprio informado no XML." : "Na ausencia de vICMS, foi deduzido o ICMS proprio reconstruido.";
    return `A composicao mais provavel da base propria utiliza: ${included}. ${mvaText} ${deductionText} O resultado ${result.status === "success" ? "reproduz os valores do XML" : result.status === "rounding" ? "apresenta pequena diferenca compativel com arredondamento" : "nao reproduz integralmente os valores do XML"}.`;
  }

  return { Decimal, compareFiscalValues, analyzeIcmsBaseComposition, calculateOwnIcms, analyzeIcmsStBaseComposition, calculateIcmsSt, calculateMvaAdjusted, inferMva, reverseCalculateOwnIcmsFromSt, generateIcmsStExplanation };
});
