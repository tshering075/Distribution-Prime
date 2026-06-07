/**
 * Dynamic product catalogue — single source of truth for rates, weight, and UC.
 * Legacy `skuRates` / `customProducts` / built-in lists are migrated on read only.
 */

import { customProductLineName } from "../constants/productSkus";

export const DEFAULT_UC_DIVISOR = 5.678;

export const PRODUCT_CATEGORIES = ["CSD", "Water", "CAN"];

/** Common SKU labels for dropdowns (e.g. 300 ML — not the product name). */
export const COMMON_SKU_OPTIONS = ["200 ML", "300 ML", "500 ML", "1 L", "1.25 L"];

/** @deprecated Use COMMON_SKU_OPTIONS */
export const DEFAULT_VARIANT_SIZES = COMMON_SKU_OPTIONS;

const CATEGORY_ORDER = { CSD: 0, CAN: 1, Water: 2 };

function uniqueStrings(list) {
  const out = [];
  const seen = new Set();
  for (const raw of list || []) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function normalizeCatalogSettings(settings = {}) {
  return {
    ucDivisor: parseNum(settings.ucDivisor, DEFAULT_UC_DIVISOR) ?? DEFAULT_UC_DIVISOR,
    ucEnabled: settings.ucEnabled === true,
    customCategories: uniqueStrings(settings.customCategories),
    customVariants: uniqueStrings([...(settings.customVariants || []), ...(settings.customSkus || [])]),
    customSkus: uniqueStrings([...(settings.customSkus || []), ...(settings.customVariants || [])]),
  };
}

export function isUcEnabled(catalog) {
  const c = catalog?.settings ? catalog : ensureProductCatalog(catalog);
  return c.settings?.ucEnabled === true;
}

export function generateProductId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Display / order line key: product name + SKU (e.g. Product A + 300 ML). */
export function getProductLineName(product) {
  if (!product) return "";
  if (product.lineName) return String(product.lineName).trim();
  return customProductLineName(product.name, product.variant ?? product.sku);
}

export function normalizeCategory(raw) {
  const c = String(raw ?? "CSD").trim();
  if (!c) return "CSD";
  if (/^water$/i.test(c)) return "Water";
  if (/^can$/i.test(c)) return "CAN";
  if (/^csd$/i.test(c)) return "CSD";
  if (PRODUCT_CATEGORIES.includes(c)) return c;
  return c
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Dropdown options: built-ins + workspace customs + values already used in rows. */
export function buildCategoryOptions(catalog, rowValues = []) {
  const settings = normalizeCatalogSettings(catalog?.settings);
  return uniqueStrings([
    ...PRODUCT_CATEGORIES,
    ...settings.customCategories,
    ...rowValues,
  ]);
}

export function buildSkuOptions(catalog, rowValues = []) {
  const settings = normalizeCatalogSettings(catalog?.settings);
  return uniqueStrings([...COMMON_SKU_OPTIONS, ...settings.customSkus, ...rowValues]);
}

/** @deprecated Use buildSkuOptions */
export const buildVariantOptions = buildSkuOptions;

export function categorySortKey(category) {
  return CATEGORY_ORDER[normalizeCategory(category)] ?? 99;
}

export function createEmptyProduct() {
  return {
    id: generateProductId(),
    name: "",
    variant: "",
    category: "CSD",
    rate: "",
    kgPerCase: "",
    ucMultiplier: "",
    ucUse: false,
    sortOrder: 0,
    active: true,
  };
}

function parseNum(v, fallback = null) {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function guessCategoryFromLineName(lineName) {
  const s = String(lineName || "");
  if (/\bCAN\b/i.test(s) || /^COKE\s+ZERO\b/i.test(s)) return "CAN";
  if (/\bWATER\b/i.test(s) || /\bKINLEY\b/i.test(s)) return "Water";
  return "CSD";
}

function productToStored(p) {
  const name = String(p.name ?? "").trim();
  const variant = String(p.variant ?? p.sku ?? "").trim();
  const lineName = getProductLineName({ name, variant });
  const rate = parseNum(p.rate, 0);
  const kgPerCase = parseNum(p.kgPerCase, 0);
  let ucMultiplier = null;
  if (p.ucMultiplier !== "" && p.ucMultiplier != null && p.ucMultiplier !== undefined) {
    const m = parseNum(p.ucMultiplier, null);
    if (m != null && m > 0) ucMultiplier = m;
  }
  return {
    id: p.id || generateProductId(),
    name,
    variant,
    lineName,
    category: normalizeCategory(p.category),
    rate,
    kgPerCase,
    ucMultiplier,
    sortOrder: parseNum(p.sortOrder, 0) ?? 0,
    active: p.active !== false,
  };
}

/** Migrate legacy payload into `{ products, settings }`. */
export function migrateLegacyProductRates(legacy = {}) {
  const products = [];
  const seen = new Set();
  const skuRates = legacy.skuRates && typeof legacy.skuRates === "object" ? legacy.skuRates : {};
  const canRate = parseNum(legacy.canRate, null);

  const pushLine = (lineName, fields) => {
    const key = String(lineName || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    const saved = skuRates[key] || {};
    const rate =
      parseNum(fields.rate, null) ??
      parseNum(saved.rate, null) ??
      (normalizeCategory(fields.category) === "CAN" && canRate != null ? canRate : 0);
    const kgPerCase = parseNum(fields.kgPerCase, null) ?? parseNum(saved.kgPerCase, 0) ?? 0;
    let ucMultiplier = fields.ucMultiplier;
    if (ucMultiplier === undefined && Object.prototype.hasOwnProperty.call(saved, "ucMultiplier")) {
      ucMultiplier = saved.ucMultiplier;
    }
    if (ucMultiplier === "" || ucMultiplier === undefined) ucMultiplier = null;
    else {
      const m = parseNum(ucMultiplier, null);
      ucMultiplier = m != null && m > 0 ? m : null;
    }
    const parts = key.split(/\s+/);
    const name = fields.name ?? (parts.length > 2 ? parts.slice(0, -2).join(" ") : parts[0] || key);
    const variant = fields.variant ?? (parts.length > 1 ? parts.slice(-2).join(" ") : "");
    products.push(
      productToStored({
        id: generateProductId(),
        name: fields.name ?? name,
        variant: fields.variant ?? variant,
        category: fields.category ?? guessCategoryFromLineName(key),
        rate,
        kgPerCase,
        ucMultiplier,
        sortOrder: products.length,
        active: true,
      })
    );
  };

  for (const p of legacy.customProducts || []) {
    const lineName = customProductLineName(p?.name, p?.sku);
    if (!lineName) continue;
    pushLine(lineName, {
      name: p.name,
      variant: p.sku,
      category: p.category,
      rate: p.rate,
      kgPerCase: p.kgPerCase,
      ucMultiplier: p.ucMultiplier,
    });
  }

  for (const [lineName, saved] of Object.entries(skuRates)) {
    pushLine(lineName, {
      category: guessCategoryFromLineName(lineName),
      rate: saved?.rate,
      kgPerCase: saved?.kgPerCase,
      ucMultiplier: saved?.ucMultiplier,
    });
  }

  return {
    products,
    settings: {
      ucDivisor: parseNum(legacy.settings?.ucDivisor, DEFAULT_UC_DIVISOR) ?? DEFAULT_UC_DIVISOR,
    },
  };
}

export function normalizeProductCatalogPayload(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return { products: [], settings: normalizeCatalogSettings() };
  }

  if (Array.isArray(parsed.products) && parsed.products.length > 0) {
    const products = parsed.products
      .map((p) => productToStored(p))
      .filter((p) => p.lineName);
    const byLine = new Map();
    for (const p of products) {
      if (!byLine.has(p.lineName)) byLine.set(p.lineName, p);
    }
    return {
      products: [...byLine.values()].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || categorySortKey(a.category) - categorySortKey(b.category)
      ),
      settings: normalizeCatalogSettings(parsed.settings),
    };
  }

  if (parsed.skuRates || parsed.customProducts?.length || parsed.canRate != null) {
    const migrated = migrateLegacyProductRates(parsed);
    return { ...migrated, settings: normalizeCatalogSettings({ ...migrated.settings, ...parsed.settings }) };
  }

  return {
    products: [],
    settings: normalizeCatalogSettings(parsed.settings),
  };
}

/** Ensure catalogue shape (migrate legacy once). */
export function ensureProductCatalog(productRates) {
  return normalizeProductCatalogPayload(productRates);
}

export function getActiveProducts(catalog) {
  const c = catalog?.products ? catalog : ensureProductCatalog(catalog);
  return (c.products || []).filter((p) => p.active !== false);
}

export function getUcDivisor(catalog) {
  const c = catalog?.settings ? catalog : ensureProductCatalog(catalog);
  return parseNum(c.settings?.ucDivisor, DEFAULT_UC_DIVISOR) ?? DEFAULT_UC_DIVISOR;
}

/** Form rows for Rate Master editor. */
export function catalogToEditorRows(catalog) {
  return ensureProductCatalog(catalog).products.map((p) => ({
    id: p.id,
    name: p.name,
    variant: p.variant ?? "",
    category: p.category,
    rate: p.rate != null ? String(p.rate) : "",
    kgPerCase: p.kgPerCase != null ? String(p.kgPerCase) : "",
    ucMultiplier: p.ucMultiplier != null ? String(p.ucMultiplier) : "",
    ucUse: p.ucMultiplier != null && p.ucMultiplier !== "" && Number(p.ucMultiplier) > 0,
    sortOrder: p.sortOrder ?? 0,
    active: p.active !== false,
  }));
}

export function validateAndNormalizeEditorRows(rows, ucDivisor, catalogSettings = {}) {
  const products = [];
  const lineNames = new Map();
  const ucEnabled = catalogSettings.ucEnabled === true;
  const div = parseNum(ucDivisor, DEFAULT_UC_DIVISOR);
  if (ucEnabled && (!div || div <= 0)) {
    return { error: "UC divisor must be a positive number when UC is enabled." };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row.name || "").trim();
    const variant = String(row.variant || "").trim();
    const hasAny =
      name ||
      variant ||
      row.rate !== "" ||
      row.kgPerCase !== "" ||
      row.ucMultiplier !== "";
    if (!hasAny) continue;

    const lineName = customProductLineName(name, variant);
    if (!lineName) {
      return { error: `Row ${i + 1}: enter a product name and SKU (e.g. Product A + 300 ML).` };
    }
    if (lineNames.has(lineName)) {
      return { error: `Duplicate product line: "${lineName}".` };
    }
    lineNames.set(lineName, true);

    const rate = parseFloat(row.rate);
    const kg = parseFloat(row.kgPerCase);
    if (!Number.isFinite(rate) || rate <= 0) {
      return { error: `"${lineName}": rate must be a positive number.` };
    }
    if (!Number.isFinite(kg) || kg <= 0) {
      return { error: `"${lineName}": weight per case (kg) must be a positive number.` };
    }
    let ucMultiplier = null;
    if (ucEnabled && row.ucUse && row.ucMultiplier !== "" && row.ucMultiplier != null) {
      const m = parseFloat(row.ucMultiplier);
      if (!Number.isFinite(m) || m <= 0) {
        return { error: `"${lineName}": UC multiplier must be a positive number when UC is on for this line.` };
      }
      ucMultiplier = m;
    }

    products.push(
      productToStored({
        id: row.id || generateProductId(),
        name,
        variant,
        category: row.category,
        rate,
        kgPerCase: kg,
        ucMultiplier,
        sortOrder: i,
        active: row.active !== false,
      })
    );
  }

  return {
    catalog: {
      products,
      settings: normalizeCatalogSettings({
        ucDivisor: div ?? DEFAULT_UC_DIVISOR,
        ucEnabled,
        ...catalogSettings,
        customSkus: catalogSettings.customVariants ?? catalogSettings.customSkus,
      }),
    },
  };
}

/** Seed rows for reports / performance tables (CSD + Water SKUs from catalogue). */
export function getReportSkuSeeds(productRates) {
  const grouped = getCatalogSkusGrouped(productRates);
  return {
    csd: grouped.csd.map((p) => ({ sku: p.name, pc: 0, uc: 0 })),
    water: grouped.water.map((p) => ({ sku: p.name, pc: 0, uc: 0 })),
  };
}

/** SKU list grouped for reports / performance. */
export function getCatalogSkusGrouped(productRates) {
  const active = getActiveProducts(ensureProductCatalog(productRates));
  const mapRow = (p) => ({
    name: getProductLineName(p),
    category: p.category,
    rate: p.rate,
    kgPerCase: p.kgPerCase,
    ucMultiplier: p.ucMultiplier,
  });
  return {
    csd: active.filter((p) => normalizeCategory(p.category) === "CSD").map(mapRow),
    water: active.filter((p) => normalizeCategory(p.category) === "Water").map(mapRow),
    can: active.filter((p) => normalizeCategory(p.category) === "CAN").map(mapRow),
    all: active.map(mapRow),
  };
}

const PICKER_CATEGORY_ORDER = ["CSD", "CAN", "Water"];

/**
 * Active product lines grouped by category for pickers (schemes, filters, etc.).
 * @returns {Record<string, string[]>}
 */
export function getCatalogProductsGrouped(productRates) {
  const active = getActiveProducts(ensureProductCatalog(productRates));
  const groups = new Map();
  for (const p of active) {
    const line = getProductLineName(p);
    if (!line) continue;
    const cat = normalizeCategory(p.category);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(line);
  }
  const sorted = {};
  for (const cat of PICKER_CATEGORY_ORDER) {
    if (groups.has(cat)) {
      sorted[cat] = [...groups.get(cat)].sort((a, b) => a.localeCompare(b));
    }
  }
  for (const [cat, lines] of groups) {
    if (!sorted[cat]) sorted[cat] = [...lines].sort((a, b) => a.localeCompare(b));
  }
  return sorted;
}

/** All active catalogue line names (e.g. COKE 300 ML). */
export function getAllCatalogLineNames(productRates) {
  return Object.values(getCatalogProductsGrouped(productRates)).flat();
}

/** Category for a catalogue line; falls back to name heuristics if not in catalogue. */
export function getCatalogLineCategory(lineName, productRates) {
  const catalog = ensureProductCatalog(productRates);
  const key = String(lineName || "").trim();
  const product = catalog.products.find(
    (p) => p.active !== false && (p.lineName === key || getProductLineName(p) === key)
  );
  return product ? normalizeCategory(product.category) : guessCategoryFromLineName(key);
}

/** Scheme `appliesTo`: csd | water | both — from selected SKU categories. */
export function inferSchemeAppliesTo(skuList, productRates) {
  let hasCsd = false;
  let hasWater = false;
  for (const sku of skuList || []) {
    const cat = getCatalogLineCategory(sku, productRates);
    if (cat === "Water") hasWater = true;
    else hasCsd = true;
  }
  if (hasCsd && hasWater) return "both";
  if (hasWater) return "water";
  return "csd";
}

/** Generic sample lines for new workspaces (Product A / B / C — not brand-specific). */
const WORKSPACE_STARTER_LINES = [
  { name: "Product A", variant: "300 ML", category: "CSD", kgPerCase: 8.28, rate: 480 },
  { name: "Product A", variant: "500 ML", category: "CSD", kgPerCase: 13.16, rate: 625 },
  { name: "Product B", variant: "300 ML", category: "CSD", kgPerCase: 8.28, rate: 480 },
  { name: "Product B", variant: "500 ML", category: "CSD", kgPerCase: 13.16, rate: 625 },
  { name: "Product C", variant: "300 ML", category: "CSD", kgPerCase: 8.28, rate: 480 },
  { name: "Product C", variant: "1 L", category: "CSD", kgPerCase: 12.5, rate: 640 },
  { name: "Product A", variant: "500 ML", category: "Water", kgPerCase: 13.2, rate: 135 },
];

/** Sample catalogue for new workspaces (editable after import). */
export function getWorkspaceStarterCatalog() {
  const products = WORKSPACE_STARTER_LINES.map((line, index) =>
    productToStored({
      id: generateProductId(),
      name: line.name,
      variant: line.variant,
      category: line.category,
      rate: line.rate,
      kgPerCase: line.kgPerCase,
      ucMultiplier: null,
      sortOrder: index,
      active: true,
    })
  );
  return {
    products,
    settings: { ucDivisor: DEFAULT_UC_DIVISOR, ucEnabled: false },
  };
}
