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
    productName: "",
    sku: "",
    category: "CSD",
    mfgDate: "",
    batchNo: "",
    bbdDate: "",
    quantity: "",
  };
}

export function normalizeInventoryRow(row) {
  const id = String(row?.id || "").trim() || nextRowId();
  const qtyRaw = row?.quantity;
  const quantity =
    qtyRaw === "" || qtyRaw == null ? 0 : Math.max(0, Math.floor(num(qtyRaw)));

  return {
    id,
    productName: String(row?.productName ?? row?.product_name ?? "").trim(),
    sku: String(row?.sku ?? "").trim(),
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

  const byName = normalized.filter(
    (r) => r.productName && r.productName.toUpperCase() === upper
  );
  if (byName.length > 0) return byName;

  return normalized.filter((r) => {
    const fgLike = { description: r.productName || r.sku, sku: r.sku };
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
    if (!row.sku || row.quantity <= 0) continue;
    const key = row.sku.toUpperCase();
    const prev = map.get(key) || {
      sku: row.sku,
      productName: row.productName,
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
