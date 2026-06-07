import { normalizeForStockMatch } from "./fgStockSkuMatch";
import {
  createEmptyFifoLot,
  createEmptyPhysicalStockRows,
  getLotsFromProductRow,
  localIsoDate,
  normalizePhysicalStockPayload,
  PHYSICAL_STOCK_PRODUCT_LINES,
} from "./physicalStockTemplate";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Abbreviated physical-stock line → brand tokens for matching calculator SKUs. */
const PHYSICAL_LINE_BRANDS = {
  KO: ["COCA COLA", "COKE"],
  FX: ["FANTA"],
  SP: ["SPRITE"],
  CH: ["CHARGE", "CHARGED", "THUMS UP CHARGE"],
  KWAT: ["KINLEY WATER", "KINLEY"],
};

function extractVolumeToken(normalized) {
  const m = String(normalized || "").match(/(\d+(?:\.\d+)?)(ML|L)\b/);
  return m ? `${m[1]}${m[2]}` : "";
}

function physicalLineBrandTokens(productSku) {
  const raw = String(productSku || "").trim().toUpperCase();
  const prefix = raw.split(/\s+/)[0] || "";
  return PHYSICAL_LINE_BRANDS[prefix] || [raw.replace(/\s+\d.*$/, "").trim()];
}

function orderSkuMatchesPhysicalLine(orderNorm, productSku) {
  const lineNorm = normalizeForStockMatch(productSku);
  if (!orderNorm || !lineNorm) return false;
  if (orderNorm === lineNorm) return true;
  if (orderNorm.includes(lineNorm) || lineNorm.includes(orderNorm)) return true;

  const orderVol = extractVolumeToken(orderNorm);
  const lineVol = extractVolumeToken(lineNorm);
  if (!orderVol || orderVol !== lineVol) return false;

  return physicalLineBrandTokens(productSku).some((brand) => orderNorm.includes(brand));
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

function findOrCreateLot(lots, mfgDate, batchNo) {
  const mfg = String(mfgDate || "").trim();
  const batch = String(batchNo || "").trim();
  let lot = lots.find((l) => String(l.mfgDate || "").trim() === mfg && String(l.batchNo || "").trim() === batch);
  if (!lot) {
    lot = createEmptyFifoLot();
    lot.mfgDate = mfg;
    lot.batchNo = batch;
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
 * Credit dispatched order line quantities into distributor physical stock primary sale.
 * Matches SKU to physical-stock rows (abbreviated lines or exact calculator SKU).
 */
export function applyDispatchLinesToPrimarySales(rawPhysicalStock, orderLines, deliveredAt) {
  const reportDate = localIsoDate(deliveredAt ? new Date(deliveredAt) : new Date());
  const payload = normalizePhysicalStockPayload(rawPhysicalStock || {});
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
    rows.push(...createEmptyPhysicalStockRows());
  }

  for (const line of orderLines || []) {
    const sku = String(line?.sku || "").trim();
    const cases = num(line?.cases) || num(line?.quantity);
    if (!sku || cases <= 0) continue;

    const row = ensureRowForSku(rows, sku);
    const lots = getLotsFromProductRow(row);
    const lot = findOrCreateLot(lots, line.mfgDate ?? line.mfg_date, line.batchNo ?? line.batch_no);
    creditLotPrimarySale(lot, cases);
    row.lots = lots;
  }

  payload.rows = rows;
  return payload;
}
