import { normalizeForStockMatch } from "./fgStockSkuMatch";
import { orderSkuMatchesPhysicalLine } from "./physicalStockSkuMatch";
import {
  createEmptyFifoLot,
  createEmptyPhysicalStockRows,
  getLotsFromProductRow,
  localIsoDate,
  normalizePhysicalStockPayload,
  PHYSICAL_STOCK_PRODUCT_LINES,
  resolvePhysicalStockProductLines,
} from "./physicalStockTemplate";

function preserveRawPhysicalStockRows(raw) {
  if (!Array.isArray(raw?.rows) || raw.rows.length === 0) return [];
  return raw.rows
    .map((r) => ({
      productSku: String(r?.productSku || "").trim(),
      lots: getLotsFromProductRow(r).map((lot) => ({ ...lot })),
    }))
    .filter((r) => r.productSku);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function traceabilityFromLine(line) {
  const mfgDate = String(line?.mfgDate ?? line?.mfg_date ?? "").trim().slice(0, 10);
  const batchNo = String(line?.batchNo ?? line?.batch_no ?? "").trim();
  const bbdDate = String(line?.bbdDate ?? line?.bbd_date ?? line?.expiry ?? "").trim().slice(0, 10);
  return { mfgDate, batchNo, bbdDate };
}

function findPhysicalStockRow(rows, orderSku) {
  const orderNorm = normalizeForStockMatch(orderSku);
  if (!orderNorm) return null;

  for (const row of rows || []) {
    if (orderSkuMatchesPhysicalLine(orderNorm, row.productSku)) return row;
  }
  return null;
}

function recalcSecondarySale(lot) {
  const opening = lot.openingStockQty;
  const primary = lot.primarySale;
  const physical = lot.physicalStockQty;
  const has = (v) => v !== "" && v != null && Number.isFinite(Number(v));
  if (has(opening) && has(primary) && has(physical)) {
    lot.secondarySale = Math.max(0, Math.round(Number(opening) + Number(primary) - Number(physical)));
  }
}

function creditLotPrimarySale(lot, cases) {
  const add = Math.max(0, Math.round(num(cases)));
  if (add <= 0) return;
  const prev = lot.primarySale === "" || lot.primarySale == null ? 0 : num(lot.primarySale);
  lot.primarySale = prev + add;
  recalcSecondarySale(lot);
}

function findOrCreateLot(lots, mfgDate, batchNo, bbdDate) {
  const mfg = String(mfgDate || "").trim();
  const batch = String(batchNo || "").trim();
  const bbd = String(bbdDate || "").trim();
  let lot = lots.find(
    (l) =>
      String(l.mfgDate || "").trim() === mfg &&
      String(l.batchNo || "").trim() === batch &&
      String(l.bbdDate || "").trim() === bbd
  );
  if (!lot) {
    lot = createEmptyFifoLot();
    lot.mfgDate = mfg;
    lot.batchNo = batch;
    lot.bbdDate = bbd;
    lots.push(lot);
  }
  return lot;
}

function ensureRowForSku(rows, orderSku) {
  let row = findPhysicalStockRow(rows, orderSku);
  if (row) return row;

  const skuLabel = String(orderSku || "").trim();
  row = { productSku: skuLabel, lots: [createEmptyFifoLot()] };
  rows.push(row);
  return row;
}

/**
 * Attach MFG / batch from dispatch lines to lots that already have primary sale but empty traceability.
 * Does not change primary sale totals (fixes orders dispatched before traceability was saved on lines).
 */
export function fillMissingLotTraceabilityFromOrderLines(rows, orderLines) {
  const nextRows = (rows || []).map((row) => ({
    productSku: row.productSku,
    lots: getLotsFromProductRow(row).map((lot) => ({ ...lot })),
  }));

  for (const line of orderLines || []) {
    const sku = String(line?.sku || "").trim();
    const { mfgDate, batchNo } = traceabilityFromLine(line);
    if (!sku || (!mfgDate && !batchNo)) continue;

    const row = findPhysicalStockRow(nextRows, sku);
    if (!row) continue;

    const lots = getLotsFromProductRow(row);
    const hasLot = lots.some(
      (l) => String(l.mfgDate || "").trim() === mfgDate && String(l.batchNo || "").trim() === batchNo
    );
    if (hasLot) continue;

    const cases = Math.round(num(line.cases) || num(line.quantity));
    let lot = lots.find(
      (l) =>
        !String(l.mfgDate || "").trim() &&
        !String(l.batchNo || "").trim() &&
        num(l.primarySale) > 0 &&
        (cases <= 0 || num(l.primarySale) === cases)
    );
    if (!lot) {
      lot = lots.find(
        (l) => !String(l.mfgDate || "").trim() && !String(l.batchNo || "").trim() && num(l.primarySale) > 0
      );
    }
    if (lot) {
      if (mfgDate) lot.mfgDate = mfgDate;
      if (batchNo) lot.batchNo = batchNo;
      row.lots = lots;
    }
  }

  return nextRows;
}

/**
 * Credit dispatched order line quantities into distributor physical stock primary sale.
 * Matches SKU to physical-stock rows (abbreviated lines or exact calculator SKU).
 */
export function applyDispatchLinesToPrimarySales(
  rawPhysicalStock,
  orderLines,
  deliveredAt,
  productRatesOrLines = null
) {
  const reportDate = localIsoDate(deliveredAt ? new Date(deliveredAt) : new Date());
  const productLines = resolvePhysicalStockProductLines(productRatesOrLines);
  const payload = normalizePhysicalStockPayload(rawPhysicalStock || {}, productLines);
  if (payload.rows.length === 0) {
    const preserved = preserveRawPhysicalStockRows(rawPhysicalStock);
    if (preserved.length > 0) payload.rows = preserved;
  }
  payload.reportDate = reportDate;
  payload.updatedAt = new Date().toISOString();

  const templateSkus = new Set(
    PHYSICAL_STOCK_PRODUCT_LINES.map((s) => String(s).trim().toUpperCase())
  );
  const rows = [...payload.rows];

  const savedExtras = (rawPhysicalStock?.rows || [])
    .map((r) => ({
      productSku: String(r?.productSku || "").trim(),
      lots: getLotsFromProductRow(r),
    }))
    .filter((r) => r.productSku && !templateSkus.has(r.productSku.toUpperCase()));

  for (const extra of savedExtras) {
    if (!rows.some((r) => String(r.productSku).toUpperCase() === extra.productSku.toUpperCase())) {
      rows.push(extra);
    }
  }

  if (rows.length === 0) {
    rows.push(...createEmptyPhysicalStockRows(productLines));
  }

  for (const line of orderLines || []) {
    const sku = String(line?.sku || "").trim();
    const cases = num(line?.cases) || num(line?.quantity);
    if (!sku || cases <= 0) continue;

    const row = ensureRowForSku(rows, sku);
    const lots = getLotsFromProductRow(row);
    const { mfgDate, batchNo, bbdDate } = traceabilityFromLine(line);
    const lot = findOrCreateLot(lots, mfgDate, batchNo, bbdDate);
    creditLotPrimarySale(lot, cases);
    row.lots = lots;
  }

  payload.rows = fillMissingLotTraceabilityFromOrderLines(rows, orderLines);
  return payload;
}
