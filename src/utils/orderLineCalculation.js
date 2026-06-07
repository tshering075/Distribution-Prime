import {
  ensureProductCatalog,
  getActiveProducts,
  getProductLineName,
  getUcDivisor,
  isUcEnabled,
} from "./productCatalog";

export const DEFAULT_CAN_RATE = 750;

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Build SKU catalogue from dynamic product list. */
export function buildCalculatorSkus(productRates) {
  const catalog = ensureProductCatalog(productRates);
  const ucEnabled = isUcEnabled(catalog);
  const ucDivisor = getUcDivisor(catalog);

  return getActiveProducts(catalog).map((p) => {
    const name = getProductLineName(p);
    const ucMul = p.ucMultiplier;
    const ucFormula =
      ucEnabled && ucMul != null && typeof ucMul === "number" && !Number.isNaN(ucMul)
        ? (q) => (q * ucMul) / ucDivisor
        : null;
    return {
      id: p.id,
      name,
      category: p.category,
      kgPerCase: Number(p.kgPerCase) || 0,
      rate: Number(p.rate) || 0,
      ucMultiplier: ucMul,
      ucFormula,
    };
  });
}

export function resolveSkuMeta(skuName, productRates, skus = null) {
  const list = skus || buildCalculatorSkus(productRates);
  return list.find((s) => s.name === skuName) || null;
}

export function getPurchasedCasesFromRow(row) {
  const cases = num(row.cases);
  const freeCases = num(row.freeCases);
  return freeCases > 0 ? Math.max(0, cases - freeCases) : cases;
}

function findApplicableSchemes(sku, category, schemes) {
  return (schemes || []).filter((scheme) => {
    const now = new Date();
    const startDate = new Date(scheme.startDate);
    const endDate = new Date(scheme.endDate);
    if (startDate > now || endDate < now) return false;

    if (scheme.appliesToSKUs && Array.isArray(scheme.appliesToSKUs) && scheme.appliesToSKUs.length > 0) {
      return scheme.appliesToSKUs.includes(sku);
    }
    const cat = String(category || "CSD").toLowerCase();
    return scheme.appliesTo === "both" || scheme.appliesTo === cat;
  });
}

/**
 * Recalculate one order line from purchased case quantity (excludes free cases in input).
 * @returns {object|null} line in saved-order `data[]` shape
 */
export function calculateOrderLine({
  sku,
  purchasedCases,
  productRates,
  schemes = [],
  preferSchemeName = null,
}) {
  const trimmedSku = String(sku || "").trim();
  const cases = Math.max(0, Math.floor(num(purchasedCases)));
  if (!trimmedSku || cases <= 0) return null;

  const item = resolveSkuMeta(trimmedSku, productRates);
  if (!item) return null;

  const rate = item.rate;
  const kgPerCase = item.kgPerCase;
  const ucFormula = item.ucFormula;
  const category = item.category === "Water" ? "Water" : item.category === "CAN" ? "CAN" : "CSD";

  if (!rate || !kgPerCase) return null;

  let schemeApplied = null;
  let freeCases = 0;
  let discountAmount = 0;
  let finalAmount = cases * rate;
  let finalCases = cases;

  const applicableSchemes = findApplicableSchemes(trimmedSku, category, schemes);
  let schemeToApply = applicableSchemes[0];
  if (preferSchemeName) {
    const preferred = applicableSchemes.find((s) => s.name === preferSchemeName);
    if (preferred) schemeToApply = preferred;
  }

  if (schemeToApply) {
    schemeApplied = schemeToApply.name;
    if (schemeToApply.type === "freeCases") {
      const buy = num(schemeToApply.buyCases, 0);
      const free = num(schemeToApply.freeCases, 0);
      if (buy > 0 && free > 0) {
        const sets = Math.floor(cases / buy);
        freeCases = sets * free;
        finalCases = cases + freeCases;
      }
    } else if (schemeToApply.type === "discount") {
      const pct = num(schemeToApply.discountPercent, 0);
      discountAmount = (cases * rate * pct) / 100;
      finalAmount = cases * rate - discountAmount;
    }
  }

  const totalTon = (finalCases * kgPerCase) / 1000;
  const totalUC = ucFormula ? ucFormula(finalCases) : null;

  return {
    sku: trimmedSku,
    cases: finalCases,
    rate,
    totalAmount: finalAmount,
    totalTon,
    totalUC,
    category,
    schemeApplied,
    freeCases,
    discountAmount,
  };
}

export function aggregateOrderLineTotals(lines) {
  const totals = (lines || []).reduce(
    (acc, row) => {
      const cases = num(row.cases) || num(row.quantity);
      const cat = String(row.category || "CSD").trim();
      const isWater = cat.toLowerCase() === "water";
      const isCan = cat.toLowerCase() === "can";

      acc.gross += num(row.totalAmount) + num(row.discountAmount);
      acc.discount += num(row.discountAmount);
      acc.net += num(row.totalAmount);
      acc.tons += num(row.totalTon);

      if (!isCan && cases > 0) {
        if (isWater) {
          acc.waterPC += cases;
        } else {
          acc.csdPC += cases;
        }
      }
      if (!isCan && row.totalUC != null) {
        if (isWater) {
          acc.waterUC += num(row.totalUC);
        } else {
          acc.csdUC += num(row.totalUC);
        }
      }
      return acc;
    },
    { gross: 0, discount: 0, net: 0, tons: 0, csdPC: 0, csdUC: 0, waterPC: 0, waterUC: 0 }
  );
  totals.totalUC = totals.csdUC + totals.waterUC;
  return totals;
}

export function buildOrderDataFromEditRows(rows, productRates, schemes = []) {
  const data = [];
  for (const row of rows || []) {
    const purchased =
      row.purchasedCases !== "" && row.purchasedCases != null
        ? num(row.purchasedCases)
        : getPurchasedCasesFromRow(row);
    const line = calculateOrderLine({
      sku: row.sku,
      purchasedCases: purchased,
      productRates,
      schemes,
      preferSchemeName: row.preferSchemeName || row.schemeApplied || null,
    });
    if (line) data.push(line);
  }
  return data;
}

let editRowKeySeq = 0;
function nextEditRowKey() {
  editRowKeySeq += 1;
  return `er_${Date.now()}_${editRowKeySeq}`;
}

export function createEmptyEditRow() {
  return {
    _key: nextEditRowKey(),
    sku: "",
    purchasedCases: "",
    mfgDate: "",
    batchNo: "",
    preferSchemeName: null,
  };
}

export function orderRowsToEditState(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row) => row?.sku)
    .map((row) => ({
      _key: nextEditRowKey(),
      sku: row.sku,
      purchasedCases: getPurchasedCasesFromRow(row),
      mfgDate: row.mfgDate ?? "",
      batchNo: row.batchNo ?? "",
      preferSchemeName: row.schemeApplied ?? null,
    }));
}
