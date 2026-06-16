import { customProductLineName } from "../constants/productSkus";
import {
  categorySortKey,
  ensureProductCatalog,
  formatProductLabelDisplay,
  getActiveProducts,
  getProductLineName,
  normalizeCategory,
} from "./productCatalog";
import { mfgDateToInputValue, mfgDateSortKey } from "./shippingFifoLots";
import { fgRowsMatchingSku } from "./fgStockSkuMatch";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function lotKey(mfgDate, batchNo, bbdDate) {
  return `${String(mfgDate || "").trim()}\x00${String(batchNo || "").trim()}\x00${String(bbdDate || "").trim()}`;
}

let rowIdSeq = 0;
function nextRowId() {
  rowIdSeq += 1;
  return `inv_${Date.now()}_${rowIdSeq}`;
}

export function createEmptyInventoryRow() {
  return {
    id: nextRowId(),
    catalogProductId: "",
    productName: "",
    sku: "",
    category: "CSD",
    mfgDate: "",
    batchNo: "",
    bbdDate: "",
    quantity: "",
  };
}

/** Calculator / order line key from inventory product name + SKU variant. */
export function getInventoryRowLineName(row) {
  const fromParts = customProductLineName(row?.productName, row?.sku);
  if (fromParts) return formatProductLabelDisplay(fromParts);
  return formatProductLabelDisplay(row?.sku || row?.productName || "");
}

function catalogRowMatchKey(product) {
  return String(product?.id || "").trim() || getProductLineName(product).toUpperCase();
}

/** Match a saved inventory row to an active catalogue product. */
export function findCatalogProductForInventoryRow(row, activeProducts) {
  const products = activeProducts || [];
  const catalogId = String(row?.catalogProductId || "").trim();
  if (catalogId) {
    const byId = products.find((p) => p.id === catalogId);
    if (byId) return byId;
  }

  const lineName = getProductLineName({
    name: row?.productName,
    variant: row?.sku,
  });
  const lineUpper = lineName.toUpperCase();
  if (lineUpper) {
    const byLine = products.find((p) => getProductLineName(p).toUpperCase() === lineUpper);
    if (byLine) return byLine;
  }

  const name = String(row?.productName || "").trim().toUpperCase();
  const sku = String(row?.sku || "").trim().toUpperCase();
  if (name && sku) {
    const byParts = products.find(
      (p) =>
        String(p.name || "").trim().toUpperCase() === name &&
        String(p.variant ?? p.sku ?? "").trim().toUpperCase() === sku
    );
    if (byParts) return byParts;
  }

  if (sku) {
    const bySkuAsLine = products.find((p) => getProductLineName(p).toUpperCase() === sku);
    if (bySkuAsLine) return bySkuAsLine;
  }

  return null;
}

export function createInventoryRowFromCatalogProduct(product, overrides = {}) {
  return {
    ...createEmptyInventoryRow(),
    catalogProductId: String(product?.id || "").trim(),
    productName: String(product?.name ?? "").trim(),
    sku: String(product?.variant ?? product?.sku ?? "").trim(),
    category: normalizeCategory(product?.category),
    ...overrides,
  };
}

/**
 * Build inventory rows from Product & Rate Master, merging saved lot data.
 * Each active catalogue product appears at least once; orphan lots are dropped.
 */
export function mergeInventoryWithCatalog(productRates, savedRows) {
  const active = getActiveProducts(ensureProductCatalog(productRates))
    .slice()
    .sort((a, b) => {
      const cat = categorySortKey(a.category) - categorySortKey(b.category);
      if (cat !== 0) return cat;
      return getProductLineName(a).localeCompare(getProductLineName(b));
    });

  const saved = (Array.isArray(savedRows) ? savedRows : []).map((r) => normalizeInventoryRow(r));
  const lotsByProduct = new Map();

  for (const row of saved) {
    const product = findCatalogProductForInventoryRow(row, active);
    if (!product) continue;
    const key = catalogRowMatchKey(product);
    if (!lotsByProduct.has(key)) lotsByProduct.set(key, []);
    lotsByProduct.get(key).push({
      ...row,
      catalogProductId: product.id,
      productName: String(product.name || "").trim(),
      sku: String(product.variant ?? product.sku ?? "").trim(),
      category: normalizeCategory(product.category),
    });
  }

  const merged = [];
  for (const product of active) {
    const key = catalogRowMatchKey(product);
    const lots = lotsByProduct.get(key) || [];
    if (lots.length === 0) {
      merged.push(createInventoryRowFromCatalogProduct(product));
    } else {
      merged.push(...lots);
    }
  }
  return merged;
}

export function normalizeInventoryRow(row) {
  const id = String(row?.id || "").trim() || nextRowId();
  const qtyRaw = row?.quantity;
  const quantity =
    qtyRaw === "" || qtyRaw == null ? 0 : Math.max(0, Math.floor(num(qtyRaw)));

  return {
    id,
    catalogProductId: String(row?.catalogProductId ?? row?.catalog_product_id ?? "").trim(),
    productName: formatProductLabelDisplay(row?.productName ?? row?.product_name ?? ""),
    sku: formatProductLabelDisplay(row?.sku ?? ""),
    category: String(row?.category ?? "CSD").trim() || "CSD",
    mfgDate: mfgDateToInputValue(row?.mfgDate ?? row?.mfg_date ?? "") || String(row?.mfgDate ?? "").trim(),
    batchNo: String(row?.batchNo ?? row?.batch_no ?? "").trim(),
    bbdDate: mfgDateToInputValue(row?.bbdDate ?? row?.bbd_date ?? row?.expiry ?? "") || String(row?.bbdDate ?? "").trim(),
    quantity,
  };
}

export function normalizeInventoryPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return { rows: [], updatedAt: null, updatedBy: "" };
  }
  const rows = (Array.isArray(raw.rows) ? raw.rows : [])
    .map((r) => normalizeInventoryRow(r))
    .filter((r) => r.sku || r.productName);
  return {
    rows,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
    updatedBy: raw.updatedBy != null ? String(raw.updatedBy) : "",
  };
}

/** Match inventory rows to a calculator / order SKU label. */
export function inventoryRowsMatchingSku(skuName, rows) {
  const sku = String(skuName || "").trim();
  if (!sku) return [];

  const normalized = (rows || []).map((r) => normalizeInventoryRow(r));
  const upper = sku.toUpperCase();

  const exact = normalized.filter((r) => r.sku && r.sku.toUpperCase() === upper);
  if (exact.length > 0) return exact;

  const byLine = normalized.filter(
    (r) => getInventoryRowLineName(r).toUpperCase() === upper
  );
  if (byLine.length > 0) return byLine;

  const byName = normalized.filter(
    (r) => r.productName && r.productName.toUpperCase() === upper
  );
  if (byName.length > 0) return byName;

  return normalized.filter((r) => {
    const fgLike = {
      description: getInventoryRowLineName(r) || r.productName || r.sku,
      sku: r.sku,
    };
    return fgRowsMatchingSku(sku, [fgLike]).length > 0;
  });
}

/**
 * FIFO lot lines for one SKU from workspace inventory.
 * @returns {Array<{ mfgDate: string, batchNo: string, bbdDate: string, quantity: number }>}
 */
export function buildSkuFifoLotsFromInventory(inventoryRows, skuName) {
  if (!skuName) return [];
  const matched = inventoryRowsMatchingSku(skuName, inventoryRows);
  const map = new Map();

  for (const r of matched) {
    const mfgDate = String(r.mfgDate || "").trim();
    const batchNo = String(r.batchNo || "").trim();
    const bbdDate = String(r.bbdDate || "").trim();
    const q = num(r.quantity);
    if (q <= 0) continue;
    const key = lotKey(mfgDate, batchNo, bbdDate);
    const prev = map.get(key) || { mfgDate, batchNo, bbdDate, quantity: 0 };
    prev.quantity += q;
    map.set(key, prev);
  }

  return [...map.values()].sort((a, b) => mfgDateSortKey(a.mfgDate) - mfgDateSortKey(b.mfgDate));
}

export function getMfgDateOptionsForSkuFromInventory(inventoryRows, skuName) {
  const lots = buildSkuFifoLotsFromInventory(inventoryRows, skuName);
  const seen = new Set();
  const dates = [];
  for (const lot of lots) {
    const d = lot.mfgDate;
    if (!d || seen.has(d)) continue;
    seen.add(d);
    dates.push(d);
  }
  return dates;
}

export function getBatchOptionsForSkuMfgFromInventory(inventoryRows, skuName, mfgDate) {
  const lots = buildSkuFifoLotsFromInventory(inventoryRows, skuName);
  const mfg = String(mfgDate || "").trim();
  return lots.filter((l) => l.mfgDate === mfg).map((l) => l.batchNo).filter(Boolean);
}

export function getBbdOptionsForSkuMfgBatchFromInventory(inventoryRows, skuName, mfgDate, batchNo) {
  const lots = buildSkuFifoLotsFromInventory(inventoryRows, skuName);
  const mfg = String(mfgDate || "").trim();
  const batch = String(batchNo || "").trim();
  const bbds = lots
    .filter((l) => l.mfgDate === mfg && l.batchNo === batch)
    .map((l) => l.bbdDate)
    .filter(Boolean);
  return [...new Set(bbds)];
}

export function resolveBbdForMfgBatchFromInventory(inventoryRows, skuName, mfgDate, batchNo, currentBbd) {
  const options = getBbdOptionsForSkuMfgBatchFromInventory(inventoryRows, skuName, mfgDate, batchNo);
  if (options.length === 0) return "";
  if (currentBbd && options.includes(currentBbd)) return currentBbd;
  return options[0];
}

export function resolveBatchForMfgFromInventory(inventoryRows, skuName, mfgDate, currentBatch) {
  const batches = getBatchOptionsForSkuMfgFromInventory(inventoryRows, skuName, mfgDate);
  if (batches.length === 0) return "";
  if (currentBatch && batches.includes(currentBatch)) return currentBatch;
  return batches[0];
}

/** Oldest lot with stock (FIFO). */
export function pickFifoLotFromInventory(inventoryRows, skuName) {
  const lots = buildSkuFifoLotsFromInventory(inventoryRows, skuName);
  const withStock = lots.filter((l) => l.quantity > 0);
  const pick = withStock[0] || lots[0];
  if (!pick) return { mfgDate: "", batchNo: "", bbdDate: "" };
  return {
    mfgDate: pick.mfgDate || "",
    batchNo: pick.batchNo || "",
    bbdDate: pick.bbdDate || "",
  };
}

/** Available cases for a specific lot selection. */
export function getInventoryLotQuantity(inventoryRows, skuName, mfgDate, batchNo, bbdDate) {
  const lots = buildSkuFifoLotsFromInventory(inventoryRows, skuName);
  const mfg = String(mfgDate || "").trim();
  const batch = String(batchNo || "").trim();
  const bbd = String(bbdDate || "").trim();
  const lot = lots.find((l) => l.mfgDate === mfg && l.batchNo === batch && l.bbdDate === bbd);
  if (lot) return Math.max(0, Math.round(lot.quantity));
  if (!bbd) {
    const partial = lots.find((l) => l.mfgDate === mfg && l.batchNo === batch);
    return partial ? Math.max(0, Math.round(partial.quantity)) : 0;
  }
  return 0;
}

/** Sum available qty for SKU across all lots. */
export function getInventorySkuTotalQuantity(inventoryRows, skuName) {
  return buildSkuFifoLotsFromInventory(inventoryRows, skuName).reduce(
    (s, lot) => s + Math.max(0, Math.round(lot.quantity)),
    0
  );
}

/** SKU options for shipping dropdown — inventory lots with stock. */
export function getInventorySkuOptions(inventoryRows) {
  const map = new Map();
  for (const raw of inventoryRows || []) {
    const row = normalizeInventoryRow(raw);
    const lineName = getInventoryRowLineName(row);
    if (!lineName || row.quantity <= 0) continue;
    const key = lineName.toUpperCase();
    const prev = map.get(key) || {
      sku: lineName,
      productName: row.productName,
      variant: row.sku,
      category: row.category,
      totalQty: 0,
    };
    prev.totalQty += row.quantity;
    if (!prev.productName && row.productName) prev.productName = row.productName;
    map.set(key, prev);
  }
  return [...map.values()].sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
}

/**
 * All catalogue products with total available cases and FIFO lot breakdown (for shipping reference).
 */
export function buildProductStockAvailabilityList(productRates, inventoryRows) {
  const rows = mergeInventoryWithCatalog(productRates, inventoryRows || []);
  const map = new Map();

  for (const row of rows) {
    const lineName = getInventoryRowLineName(row);
    if (!lineName) continue;
    const key = lineName.toUpperCase();
    if (!map.has(key)) {
      map.set(key, {
        product: lineName,
        productName: row.productName,
        variant: row.sku,
        category: row.category || "CSD",
        totalQty: 0,
        lots: [],
      });
    }
    const entry = map.get(key);
    const qty = Math.max(0, Math.floor(Number(row.quantity) || 0));
    if (qty <= 0) continue;
    entry.totalQty += qty;
    entry.lots.push({
      mfgDate: String(row.mfgDate || "").trim(),
      batchNo: String(row.batchNo || "").trim(),
      bbdDate: String(row.bbdDate || "").trim(),
      quantity: qty,
    });
  }

  return [...map.values()].sort((a, b) => {
    const cat = categorySortKey(a.category) - categorySortKey(b.category);
    if (cat !== 0) return cat;
    return String(a.product).localeCompare(String(b.product));
  });
}

/**
 * Deduct dispatched order line quantities from workspace inventory (FIFO per lot).
 */
export function deductInventoryForDispatch(inventoryRows, orderLines) {
  const updated = (inventoryRows || []).map((r) => normalizeInventoryRow(r));
  const shortages = [];

  for (const line of orderLines || []) {
    const sku = String(line?.sku || "").trim();
    const cases = Math.max(0, Math.round(num(line?.cases) || num(line?.quantity)));
    if (!sku || cases <= 0) continue;

    const mfg = String(line?.mfgDate ?? line?.mfg_date ?? "").trim();
    const batch = String(line?.batchNo ?? line?.batch_no ?? "").trim();
    const bbd = String(line?.bbdDate ?? line?.bbd_date ?? "").trim();

    let remaining = cases;
    const candidateIndices = [];

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (!inventoryRowsMatchingSku(sku, [row]).length) continue;
      if (mfg && row.mfgDate !== mfg) continue;
      if (batch && row.batchNo !== batch) continue;
      if (bbd && row.bbdDate !== bbd) continue;
      if (row.quantity <= 0) continue;
      candidateIndices.push(i);
    }

    candidateIndices.sort(
      (a, b) => mfgDateSortKey(updated[a].mfgDate) - mfgDateSortKey(updated[b].mfgDate)
    );

    for (const idx of candidateIndices) {
      if (remaining <= 0) break;
      const row = updated[idx];
      const take = Math.min(row.quantity, remaining);
      row.quantity -= take;
      remaining -= take;
    }

    if (remaining > 0) {
      shortages.push({ sku, requested: cases, short: remaining, mfgDate: mfg, batchNo: batch, bbdDate: bbd });
    }
  }

  return { rows: updated, shortages };
}

/** Simulate dispatch and return lines where order qty exceeds available inventory. */
export function getInventoryDispatchShortages(inventoryRows, orderLines) {
  const { shortages } = deductInventoryForDispatch(inventoryRows || [], orderLines || []);
  return shortages;
}

/** User-facing message for inventory shortages before dispatch. */
export function formatInventoryDispatchShortageMessage(shortages) {
  if (!Array.isArray(shortages) || shortages.length === 0) return "";

  const parts = shortages.map((s) => {
    const lotParts = [s.mfgDate, s.batchNo, s.bbdDate].filter(Boolean);
    const lotLabel = lotParts.length ? ` (${lotParts.join(" / ")})` : "";
    const requested = Math.max(0, Math.round(num(s.requested)));
    const short = Math.max(0, Math.round(num(s.short)));
    const avail = Math.max(0, requested - short);
    return `${s.sku}${lotLabel}: need ${requested}, only ${avail} available`;
  });

  return `Insufficient inventory — ${parts.join("; ")}`;
}

/**
 * Check whether order lines can be dispatched against workspace inventory.
 * @returns {{ ok: boolean, shortages: Array, message: string }}
 */
export function validateOrderLinesAgainstInventory(inventoryRows, orderLines) {
  const shortages = getInventoryDispatchShortages(inventoryRows, orderLines);
  const message = formatInventoryDispatchShortageMessage(shortages);
  return {
    ok: shortages.length === 0,
    shortages,
    message,
  };
}
