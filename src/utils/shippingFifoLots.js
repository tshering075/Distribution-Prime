import { fgRowQuantity, fgRowsMatchingSku } from "./fgStockSkuMatch";

/** Parse MFG date string to sortable timestamp (FIFO: oldest first). */
export function mfgDateSortKey(mfgDate) {
  const s = String(mfgDate || "").trim();
  if (!s) return Number.MAX_SAFE_INTEGER;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const t = Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
  }
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    const t = Date.UTC(y, Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
  }
  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function lotKey(mfgDate, batchNo) {
  return `${String(mfgDate || "").trim()}\x00${String(batchNo || "").trim()}`;
}

/**
 * FIFO lot lines for one SKU from company FG opening stock rows.
 * @returns {Array<{ mfgDate: string, batchNo: string, quantity: number }>}
 */
export function buildSkuFifoLotsFromFgRows(fgRows, skuName) {
  if (!skuName) return [];
  const matched = fgRowsMatchingSku(skuName, fgRows);
  const map = new Map();
  for (const r of matched) {
    const mfgDate = String(r.mfgDate ?? r.mfg_date ?? "").trim();
    const batchNo = String(r.batchNo ?? r.batch_no ?? "").trim();
    const q = fgRowQuantity(r);
    if (!Number.isFinite(q) || q <= 0) continue;
    const key = lotKey(mfgDate, batchNo);
    const prev = map.get(key) || { mfgDate, batchNo, quantity: 0 };
    prev.quantity += q;
    map.set(key, prev);
  }
  return [...map.values()].sort((a, b) => mfgDateSortKey(a.mfgDate) - mfgDateSortKey(b.mfgDate));
}

/** Distinct MFG dates for SKU (FIFO order). */
export function getMfgDateOptionsForSku(fgRows, skuName) {
  const lots = buildSkuFifoLotsFromFgRows(fgRows, skuName);
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

/** Batch numbers for SKU + MFG date. */
export function getBatchOptionsForSkuMfg(fgRows, skuName, mfgDate) {
  const lots = buildSkuFifoLotsFromFgRows(fgRows, skuName);
  const mfg = String(mfgDate || "").trim();
  return lots.filter((l) => l.mfgDate === mfg).map((l) => l.batchNo).filter(Boolean);
}

/** Oldest lot with stock (FIFO). */
export function pickFifoMfgAndBatch(fgRows, skuName) {
  const lots = buildSkuFifoLotsFromFgRows(fgRows, skuName);
  const withStock = lots.filter((l) => l.quantity > 0);
  const pick = withStock[0] || lots[0];
  if (!pick) return { mfgDate: "", batchNo: "" };
  return { mfgDate: pick.mfgDate || "", batchNo: pick.batchNo || "" };
}

/** When MFG changes, default to first batch for that date. */
export function resolveBatchForMfg(fgRows, skuName, mfgDate, currentBatch) {
  const batches = getBatchOptionsForSkuMfg(fgRows, skuName, mfgDate);
  if (batches.length === 0) return "";
  if (currentBatch && batches.includes(currentBatch)) return currentBatch;
  return batches[0];
}
