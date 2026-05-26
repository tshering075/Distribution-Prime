/**
 * SKU-level achieved sales per distributor (aligned with Reports → Distributor performance
 * and Admin performance totals attribution rules).
 */

import { DEFAULT_SKUS } from "../constants/productSkus";
import { findDistributorForPartyName } from "./distributorNameMatch";

function readField(obj, keys, fallback = undefined) {
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return fallback;
}

/** Parse invoice date from a sales_data row. */
export function parseSaleInvoiceDate(sale) {
  const raw = readField(sale, ["invoiceDate", "invoice_date", "date"], null);
  if (raw == null) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw?.toDate === "function") {
    const d = raw.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toLocalIsoDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Min/max invoice dates (YYYY-MM-DD) for one distributor in uploaded sales. */
export function getSalesInvoiceDateBoundsForDistributor(allSalesData, distributors, distributorCode) {
  const code = String(distributorCode || "").trim();
  if (!code) return { minDate: "", maxDate: "", rowCount: 0 };
  let min = null;
  let max = null;
  let rowCount = 0;
  for (const sale of Array.isArray(allSalesData) ? allSalesData : []) {
    if (resolveSaleDistributorCode(sale, distributors) !== code) continue;
    rowCount += 1;
    const inv = parseSaleInvoiceDate(sale);
    if (!inv) continue;
    if (!min || inv < min) min = inv;
    if (!max || inv > max) max = inv;
  }
  return {
    minDate: min ? toLocalIsoDate(min) : "",
    maxDate: max ? toLocalIsoDate(max) : "",
    rowCount,
  };
}

function saleMatchesDateRange(sale, dateFrom, dateTo) {
  const inv = parseSaleInvoiceDate(sale);
  if (!inv) return true;
  if (dateFrom) {
    const start = new Date(`${String(dateFrom).slice(0, 10)}T00:00:00`);
    if (inv < start) return false;
  }
  if (dateTo) {
    const end = new Date(`${String(dateTo).slice(0, 10)}T23:59:59.999`);
    if (inv > end) return false;
  }
  return true;
}

function createSkuGroupMaps(seedFromDefaults) {
  const csd = new Map();
  const water = new Map();
  if (seedFromDefaults) {
    DEFAULT_SKUS.filter((s) => categoryNameToKey(s.category) === "csd").forEach((s) => {
      csd.set(s.name, { sku: s.name, category: "CSD", pc: 0, uc: 0 });
    });
    DEFAULT_SKUS.filter((s) => categoryNameToKey(s.category) === "water").forEach((s) => {
      water.set(s.name, { sku: s.name, category: "Water", pc: 0, uc: 0 });
    });
  }
  return { csd, water };
}

function aggregateSaleIntoSkuMaps(record, maps) {
  if (Array.isArray(record.products) && record.products.length > 0) {
    record.products.forEach((product) => {
      if (!product?.sku) return;
      const pc = Number(product.quantity) || 0;
      if (pc <= 0) return;
      const category = categoryNameToKey(product.category);
      const canonicalSku = canonicalizeSku(category, product.sku);
      if (!canonicalSku || !category) return;
      const uc = Number(product.uc) || convertPCtoUC(pc, product.sku);
      const target = category === "csd" ? maps.csd : maps.water;
      addSku(target, canonicalSku, pc, uc);
      const entry = target.get(canonicalSku);
      if (entry) entry.category = category === "csd" ? "CSD" : "Water";
    });
    return;
  }
  const csdPC = Number(record.csdPC) || 0;
  const csdUC = Number(record.csdUC) || 0;
  const waterPC = Number(record.waterPC) || 0;
  const waterUC = Number(record.waterUC) || 0;
  if (csdPC || csdUC) {
    addSku(maps.csd, "CSD Total", csdPC, csdUC);
    const e = maps.csd.get("CSD Total");
    if (e) e.category = "CSD";
  }
  if (waterPC || waterUC) {
    addSku(maps.water, "K WATER Total", waterPC, waterUC);
    const e = maps.water.get("K WATER Total");
    if (e) e.category = "Water";
  }
}

function sortSkuList(map, category) {
  const list = Array.from(map.values()).filter((item) => item.pc > 0 || item.uc > 0);
  if (category === "csd") {
    return list.sort((a, b) => {
      const sizeDiff = getCsdSizeOrder(a.sku) - getCsdSizeOrder(b.sku);
      if (sizeDiff !== 0) return sizeDiff;
      const brandDiff = getCsdBrandOrder(a.sku) - getCsdBrandOrder(b.sku);
      if (brandDiff !== 0) return brandDiff;
      return a.sku.localeCompare(b.sku);
    });
  }
  return list.sort((a, b) => {
    const sizeDiff = getWaterSizeOrder(a.sku) - getWaterSizeOrder(b.sku);
    if (sizeDiff !== 0) return sizeDiff;
    return a.sku.localeCompare(b.sku);
  });
}

/**
 * Per-SKU liftings for one distributor from uploaded sales, optional invoice date range.
 * @returns {{ csd: object[], water: object[], totals: object, invoiceRows: number }}
 */
export function buildDistributorSkuLiftingsForDateRange(
  allSalesData,
  distributors,
  distributorCode,
  dateFrom,
  dateTo
) {
  const code = String(distributorCode || "").trim();
  const maps = createSkuGroupMaps(false);
  let invoiceRows = 0;

  for (const record of Array.isArray(allSalesData) ? allSalesData : []) {
    if (!record) continue;
    if (resolveSaleDistributorCode(record, distributors) !== code) continue;
    if (!saleMatchesDateRange(record, dateFrom, dateTo)) continue;
    invoiceRows += 1;
    aggregateSaleIntoSkuMaps(record, maps);
  }

  const csd = sortSkuList(maps.csd, "csd");
  const water = sortSkuList(maps.water, "water");

  const totals = { csdPC: 0, csdUC: 0, waterPC: 0, waterUC: 0 };
  csd.forEach((item) => {
    totals.csdPC += item.pc;
    totals.csdUC += item.uc;
  });
  water.forEach((item) => {
    totals.waterPC += item.pc;
    totals.waterUC += item.uc;
  });

  totals.csdPC = Math.round(totals.csdPC);
  totals.waterPC = Math.round(totals.waterPC);
  totals.csdUC = Math.round(totals.csdUC * 100) / 100;
  totals.waterUC = Math.round(totals.waterUC * 100) / 100;

  return { csd, water, totals, invoiceRows };
}

/**
 * SKU liftings from one or more sales_data rows (e.g. one lift row or all visible lifts).
 */
export function buildSkuLiftingsFromSalesRecords(salesRecords) {
  const maps = createSkuGroupMaps(false);
  let invoiceRows = 0;

  for (const record of Array.isArray(salesRecords) ? salesRecords : []) {
    if (!record) continue;
    invoiceRows += 1;
    aggregateSaleIntoSkuMaps(record, maps);
  }

  const csd = sortSkuList(maps.csd, "csd");
  const water = sortSkuList(maps.water, "water");

  const totals = { csdPC: 0, csdUC: 0, waterPC: 0, waterUC: 0 };
  csd.forEach((item) => {
    totals.csdPC += item.pc;
    totals.csdUC += item.uc;
  });
  water.forEach((item) => {
    totals.waterPC += item.pc;
    totals.waterUC += item.uc;
  });

  totals.csdPC = Math.round(totals.csdPC);
  totals.waterPC = Math.round(totals.waterPC);
  totals.csdUC = Math.round(totals.csdUC * 100) / 100;
  totals.waterUC = Math.round(totals.waterUC * 100) / 100;

  return { csd, water, totals, invoiceRows };
}

/** Same resolution as AdminDashboard performanceDistributors sales aggregation. */
export function resolveSaleDistributorCode(sale, distributors) {
  if (!sale || !Array.isArray(distributors)) return null;
  const rawCode = readField(sale, ["distributorCode", "distributor_code"], null);
  const codeStr = rawCode != null && rawCode !== "" ? String(rawCode).trim() : "";
  if (codeStr && distributors.some((d) => String(d.code ?? "").trim() === codeStr)) {
    return codeStr;
  }
  const partyName = readField(sale, ["distributorName", "distributor_name", "distributor", "name"], "");
  const matched = findDistributorForPartyName(distributors, partyName);
  return matched?.code != null ? String(matched.code).trim() : null;
}

function convertPCtoUC(pc, sku) {
  if (!pc || !sku) return 0;
  const pcNum = Number(pc) || 0;
  if (pcNum === 0) return 0;

  const skuLower = sku.toString().toLowerCase().trim().replace(/\s+/g, " ");

  if (skuLower.includes("can") || skuLower.includes("tin")) {
    return 0;
  }

  if (
    (skuLower.includes("200ml") || skuLower.includes("200 ml")) &&
    (skuLower.includes("water") || skuLower.includes("kinley"))
  ) {
    return (pcNum * 4.8) / 5.678;
  }

  if ((skuLower.includes("300ml") || skuLower.includes("300 ml")) && !skuLower.includes("can")) {
    return (pcNum * 7.2) / 5.678;
  }

  if (
    (skuLower.includes("500ml") || skuLower.includes("500 ml")) &&
    (skuLower.includes("water") || skuLower.includes("kinley"))
  ) {
    return (pcNum * 12) / 5.678;
  }

  if (
    (skuLower.includes("500ml") || skuLower.includes("500 ml")) &&
    !skuLower.includes("water") &&
    !skuLower.includes("kinley")
  ) {
    return (pcNum * 12) / 5.678;
  }

  if (
    skuLower.includes("1.25l") ||
    skuLower.includes("1.25 l") ||
    skuLower.includes("1.25ltr") ||
    skuLower.includes("1.25 ltr")
  ) {
    return (pcNum * 15) / 5.678;
  }

  if (
    (skuLower.includes("1l") || skuLower.includes("1 l") || skuLower.includes("1ltr") || skuLower.includes("1 ltr")) &&
    (skuLower.includes("water") || skuLower.includes("kinley"))
  ) {
    return (pcNum * 12) / 5.678;
  }

  return 0;
}

function normalizeSkuText(value) {
  return (value || "")
    .toString()
    .toUpperCase()
    .replace(/[.\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryNameToKey(category) {
  const value = (category || "").toString().trim().toLowerCase();
  if (value === "csd") return "csd";
  if (value === "water") return "water";
  return null;
}

function canonicalizeSku(category, sku) {
  const raw = (sku || "").toString().trim();
  if (!raw) return "";

  const skuNorm = normalizeSkuText(raw);
  if (category === "water") {
    const waterLike = /\b(KINLEY|K\s*WATER|WATER|KWATER|K WATER R)\b/.test(skuNorm);
    if (waterLike && /\b200\s*ML\b/.test(skuNorm)) return "KINLEY WATER 200 ML";
    if (waterLike && /\b500\s*ML\b/.test(skuNorm)) return "KINLEY WATER 500 ML";
    if (waterLike && /\b1\s*(L|LTR)\b/.test(skuNorm)) return "KINLEY WATER 1 L";
  }

  return raw;
}

function getCsdSizeOrder(sku) {
  const s = normalizeSkuText(sku);
  if (/\b300\s*ML\b/.test(s)) return 0;
  if (/\b500\s*ML\b/.test(s)) return 1;
  if (/\b1\s*\.?\s*25\s*(L|LTR)\b/.test(s)) return 2;
  return 3;
}

function getCsdBrandOrder(sku) {
  const s = normalizeSkuText(sku);
  if (/\bCOKE\b|\bCOCA\s*COLA\b/.test(s)) return 0;
  if (/\bFANTA\b/.test(s)) return 1;
  if (/\bSPRITE\b/.test(s)) return 2;
  if (/\bCHARGE\b|\bCHARGED\b/.test(s)) return 3;
  return 4;
}

function getWaterSizeOrder(sku) {
  const s = normalizeSkuText(sku);
  if (/\b200\s*ML\b/.test(s)) return 0;
  if (/\b500\s*ML\b/.test(s)) return 1;
  if (/\b1\s*(L|LTR)\b/.test(s)) return 2;
  return 3;
}

function addSku(skuMap, sku, pc, uc) {
  if (!skuMap.has(sku)) {
    skuMap.set(sku, { sku, pc: 0, uc: 0 });
  }
  const current = skuMap.get(sku);
  current.pc += pc;
  current.uc += uc;
}

/**
 * Flat rows for Excel: one row per distributor × SKU (CSD and Water), achieved from uploaded sales.
 * @param {unknown[]} allSalesData
 * @param {unknown[]} distributors
 * @param {Set<string>} exportDistributorCodes - distributor codes included in the performance export
 * @returns {Array<Record<string, string|number>>}
 */
export function buildDistributorPerformanceSkuDetailRows(allSalesData, distributors, exportDistributorCodes) {
  if (!(exportDistributorCodes instanceof Set) || exportDistributorCodes.size === 0) {
    return [];
  }

  const seededSkus = {
    csd: DEFAULT_SKUS.filter((sku) => categoryNameToKey(sku.category) === "csd").map((sku) => ({
      sku: sku.name,
      pc: 0,
      uc: 0,
    })),
    water: DEFAULT_SKUS.filter((sku) => categoryNameToKey(sku.category) === "water").map((sku) => ({
      sku: sku.name,
      pc: 0,
      uc: 0,
    })),
  };

  const distributorMap = new Map();

  const ensureGroup = (code) => {
    const c = String(code || "").trim();
    if (!c || !exportDistributorCodes.has(c)) return null;
    if (!distributorMap.has(c)) {
      const d = distributors.find((x) => String(x.code ?? "").trim() === c);
      distributorMap.set(c, {
        key: c,
        name: d?.name || c,
        region: d?.region || "",
        csd: new Map(),
        water: new Map(),
      });
      const g = distributorMap.get(c);
      seededSkus.csd.forEach((item) => {
        g.csd.set(item.sku, { ...item });
      });
      seededSkus.water.forEach((item) => {
        g.water.set(item.sku, { ...item });
      });
    }
    return distributorMap.get(c);
  };

  (Array.isArray(allSalesData) ? allSalesData : []).forEach((record) => {
    if (!record) return;
    const resolvedCode = resolveSaleDistributorCode(record, distributors);
    const group = ensureGroup(resolvedCode);
    if (!group) return;
    aggregateSaleIntoSkuMaps(record, group);
  });

  exportDistributorCodes.forEach((code) => {
    ensureGroup(code);
  });

  const groups = Array.from(distributorMap.values()).sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
  );

  const detailRows = [];
  for (const g of groups) {
    const csdSorted = Array.from(g.csd.values()).sort((a, b) => {
      const sizeDiff = getCsdSizeOrder(a.sku) - getCsdSizeOrder(b.sku);
      if (sizeDiff !== 0) return sizeDiff;
      const brandDiff = getCsdBrandOrder(a.sku) - getCsdBrandOrder(b.sku);
      if (brandDiff !== 0) return brandDiff;
      return a.sku.localeCompare(b.sku);
    });
    const waterSorted = Array.from(g.water.values()).sort((a, b) => {
      const sizeDiff = getWaterSizeOrder(a.sku) - getWaterSizeOrder(b.sku);
      if (sizeDiff !== 0) return sizeDiff;
      return a.sku.localeCompare(b.sku);
    });

    for (const { sku, pc, uc } of csdSorted) {
      detailRows.push({
        distributor_name: g.name,
        distributor_code: g.key,
        region: g.region,
        category: "CSD",
        product_sku: sku,
        achieved_pc: Math.round(pc),
        achieved_uc: Math.round(uc * 100) / 100,
      });
    }
    for (const { sku, pc, uc } of waterSorted) {
      detailRows.push({
        distributor_name: g.name,
        distributor_code: g.key,
        region: g.region,
        category: "Water",
        product_sku: sku,
        achieved_pc: Math.round(pc),
        achieved_uc: Math.round(uc * 100) / 100,
      });
    }
  }

  if (detailRows.length > 0) {
    let sumPc = 0;
    let sumUc = 0;
    for (const r of detailRows) {
      sumPc += Number(r.achieved_pc) || 0;
      sumUc += Number(r.achieved_uc) || 0;
    }
    detailRows.push({
      distributor_name: "TOTAL",
      distributor_code: "",
      region: "",
      category: "",
      product_sku: "",
      achieved_pc: Math.round(sumPc),
      achieved_uc: Math.round(sumUc * 100) / 100,
    });
  }

  return detailRows;
}
