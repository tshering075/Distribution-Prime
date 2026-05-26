/** Daily physical stock: opening, primary sale, physical stock, secondary sale by SKU (FIFO lot lines). */
export const PHYSICAL_STOCK_PRODUCT_LINES = [
  "KO 300ML",
  "FX 300ML",
  "SP 300ML",
  "CH 300ML",
  "KO 500ML",
  "FX 500ML",
  "SP 500ML",
  "KO 1.25ML",
  "FX 1.25ML",
  "SP 1.25ML",
  "KWAT 200ML",
  "KWAT 500ML",
  "KWAT 1L",
];

export function createFifoLotId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `lot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** One FIFO layer: manufacturing traceability + quantities (PC). */
export function createEmptyFifoLot() {
  return {
    lotId: createFifoLotId(),
    mfgDate: "",
    batchNo: "",
    bbdDate: "",
    openingStockQty: "",
    primarySale: "",
    physicalStockQty: "",
    secondarySale: "",
  };
}

function normalizeDateField(value) {
  if (value === "" || value == null) return "";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function normalizeBatchNo(value) {
  if (value === "" || value == null) return "";
  return String(value).trim();
}

export function normalizeFifoLot(raw) {
  if (!raw || typeof raw !== "object") return createEmptyFifoLot();
  const lotId = typeof raw.lotId === "string" && raw.lotId.trim() ? raw.lotId.trim() : createFifoLotId();
  const normalizeQty = (value) => {
    if (value === "" || value == null) return "";
    const n = Number(value);
    return Number.isFinite(n) ? n : "";
  };
  return {
    lotId,
    mfgDate: normalizeDateField(raw.mfgDate),
    batchNo: normalizeBatchNo(raw.batchNo),
    bbdDate: normalizeDateField(raw.bbdDate),
    openingStockQty: normalizeQty(raw.openingStockQty),
    primarySale: normalizeQty(raw.primarySale),
    physicalStockQty: normalizeQty(raw.physicalStockQty ?? raw.closingStockQty),
    secondarySale: normalizeQty(raw.secondarySale),
  };
}

/** Return lots[] for a product row (migrates legacy flat row). */
export function getLotsFromProductRow(row) {
  if (!row || typeof row !== "object") return [createEmptyFifoLot()];
  if (Array.isArray(row.lots) && row.lots.length > 0) {
    return row.lots.map((l) => normalizeFifoLot(l));
  }
  // Legacy: single line of qtys on the row
  const lot = createEmptyFifoLot();
  lot.mfgDate = normalizeDateField(row.mfgDate);
  lot.batchNo = normalizeBatchNo(row.batchNo);
  lot.bbdDate = normalizeDateField(row.bbdDate);
  const normalizeQty = (value) => {
    if (value === "" || value == null) return "";
    const n = Number(value);
    return Number.isFinite(n) ? n : "";
  };
  lot.openingStockQty = normalizeQty(row.openingStockQty);
  lot.primarySale = normalizeQty(row.primarySale);
  lot.physicalStockQty = normalizeQty(row.physicalStockQty ?? row.closingStockQty);
  lot.secondarySale = normalizeQty(row.secondarySale);
  return [lot];
}

export function createEmptyPhysicalStockRows() {
  return PHYSICAL_STOCK_PRODUCT_LINES.map((productSku) => ({
    productSku,
    lots: [createEmptyFifoLot()],
  }));
}

/** Sum physical stock across all lots in one SKU row (legacy helper). */
export function rowTotal(row) {
  return getLotsFromProductRow(row).reduce((s, l) => s + (Number(l?.physicalStockQty) || 0), 0);
}

function lotQtyComplete(lot) {
  const has = (v) => v !== "" && v != null && Number.isFinite(Number(v));
  return has(lot?.openingStockQty) && has(lot?.primarySale) && has(lot?.physicalStockQty);
}

/** Progress for distributor UX: lots/SKUs with O, P, and Phy entered. */
export function getPhysicalStockCompletionStats(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { skuCount: 0, lotsTotal: 0, lotsComplete: 0, skusComplete: 0, skusStarted: 0, percent: 0 };
  }
  let lotsTotal = 0;
  let lotsComplete = 0;
  let skusComplete = 0;
  let skusStarted = 0;
  for (const row of rows) {
    const lots = getLotsFromProductRow(row);
    lotsTotal += lots.length;
    let skuComplete = lots.length > 0;
    let skuStarted = false;
    for (const lot of lots) {
      if (lotQtyComplete(lot)) lotsComplete += 1;
      else skuComplete = false;
      const started =
        (lot?.openingStockQty !== "" && lot?.openingStockQty != null) ||
        (lot?.primarySale !== "" && lot?.primarySale != null) ||
        (lot?.physicalStockQty !== "" && lot?.physicalStockQty != null);
      if (started) skuStarted = true;
    }
    if (skuComplete) skusComplete += 1;
    if (skuStarted) skusStarted += 1;
  }
  const skuCount = rows.length;
  const percent = lotsTotal > 0 ? Math.round((lotsComplete / lotsTotal) * 100) : 0;
  return { skuCount, lotsTotal, lotsComplete, skusComplete, skusStarted, percent };
}

/** Sum opening / primary / physical / secondary across all SKU rows and all FIFO lots. */
export function aggregatePhysicalStockTotals(rows) {
  if (!Array.isArray(rows)) return { opening: 0, primary: 0, physical: 0, secondary: 0 };
  return rows.reduce(
    (acc, r) => {
      for (const lot of getLotsFromProductRow(r)) {
        acc.opening += Number(lot?.openingStockQty) || 0;
        acc.primary += Number(lot?.primarySale) || 0;
        acc.physical += Number(lot?.physicalStockQty) || 0;
        acc.secondary += Number(lot?.secondarySale) || 0;
      }
      return acc;
    },
    { opening: 0, primary: 0, physical: 0, secondary: 0 }
  );
}

function normalizeRowShape(rawRow) {
  if (!rawRow || typeof rawRow !== "object") return null;
  const productSku = rawRow.productSku ? String(rawRow.productSku).trim() : "";
  if (!productSku) return null;

  // Legacy FIFO-lot shape (category/sku/lots qty only) → single product line lump
  if (rawRow.category && rawRow.sku && Array.isArray(rawRow.lots) && !rawRow.productSku) {
    const total = rawRow.lots.reduce((s, l) => s + (Number(l?.qty) || 0), 0);
    return {
      productSku: `${String(rawRow.sku).trim()} ${String(rawRow.category).trim()}`.trim(),
      lots: [
        {
          ...createEmptyFifoLot(),
          openingStockQty: total,
          primarySale: "",
          physicalStockQty: total,
          secondarySale: "",
        },
      ],
    };
  }

  return {
    productSku,
    lots: getLotsFromProductRow(rawRow),
  };
}

/** Merge saved rows with current template (new SKU lines appear; matches keep values). */
export function mergePhysicalStockRows(savedRows) {
  const template = createEmptyPhysicalStockRows();
  if (!Array.isArray(savedRows) || savedRows.length === 0) return template;

  const map = new Map();
  savedRows.forEach((r) => {
    const n = normalizeRowShape(r);
    if (!n?.productSku) return;
    map.set(String(n.productSku).trim().toUpperCase(), n);
  });

  return template.map((t) => {
    const saved = map.get(String(t.productSku).trim().toUpperCase());
    if (!saved) return { ...t, lots: (t.lots || [createEmptyFifoLot()]).map(normalizeFifoLot) };
    const mergedLots = getLotsFromProductRow(saved);
    return {
      productSku: t.productSku,
      lots: mergedLots.length > 0 ? mergedLots.map(normalizeFifoLot) : [createEmptyFifoLot()],
    };
  });
}

export function normalizePhysicalStockPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      reportDate: new Date().toISOString().slice(0, 10),
      rows: createEmptyPhysicalStockRows(),
    };
  }
  const reportDate =
    typeof raw.reportDate === "string" && raw.reportDate
      ? raw.reportDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  return {
    reportDate,
    updatedAt: raw.updatedAt || new Date().toISOString(),
    rows: mergePhysicalStockRows(raw.rows),
  };
}

/**
 * Flat list for Excel / APIs: one record per product × FIFO lot.
 * @param {Array<{ productSku: string, lots?: unknown[] }>} rows
 * @returns {Array<{ product_sku: string, mfg_date: string, batch_no: string, bbd_date: string, opening_stock_qty: number, primary_sale: number, physical_stock_qty: number, secondary_sale: number }>}
 */
export function flattenPhysicalStockRowsForExport(rows) {
  const out = [];
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    const sku = r?.productSku || "";
    const lots = getLotsFromProductRow(r);
    lots.forEach((lot, idx) => {
      out.push({
        product_sku: sku,
        fifo_lot_seq: idx + 1,
        mfg_date: lot.mfgDate || "",
        batch_no: lot.batchNo || "",
        bbd_date: lot.bbdDate || "",
        opening_stock_qty: Number(lot.openingStockQty) || 0,
        primary_sale: Number(lot.primarySale) || 0,
        physical_stock_qty: Number(lot.physicalStockQty) || 0,
        secondary_sale: Number(lot.secondarySale) || 0,
      });
    });
  }
  return out;
}

/** Supabase: `physical_stock`; legacy/local: `physicalStock` */
export function getRawPhysicalStockFromDistributor(d) {
  if (!d || typeof d !== "object") return null;
  return d.physical_stock ?? d.physicalStock ?? null;
}

/** Local calendar date YYYY-MM-DD (avoids UTC off-by-one for IST-style users). */
export function localIsoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Previous calendar day relative to an ISO date string. */
export function previousReportDate(isoDate) {
  const s = String(isoDate || "").slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return localIsoDate(new Date(Date.now() - 86400000));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return localIsoDate(dt);
}

const LOCAL_SNAPSHOT_KEY_PREFIX = "distributor_physical_stock_snapshots_v1_";

function snapshotStorageKey(distributorCode) {
  return `${LOCAL_SNAPSHOT_KEY_PREFIX}${String(distributorCode || "").trim()}`;
}

/** Persist one report-date payload in localStorage (offline carry-forward + history). */
export function saveLocalPhysicalStockSnapshot(distributorCode, payload) {
  const code = String(distributorCode || "").trim();
  if (!code || !payload || typeof payload !== "object") return;
  const reportDate =
    typeof payload.reportDate === "string" && payload.reportDate
      ? payload.reportDate.slice(0, 10)
      : localIsoDate();
  try {
    const key = snapshotStorageKey(code);
    const map = JSON.parse(localStorage.getItem(key) || "{}");
    map[reportDate] = {
      reportDate,
      rows: payload.rows,
      updatedAt: payload.updatedAt || new Date().toISOString(),
    };
    const dates = Object.keys(map).sort();
    if (dates.length > 120) {
      for (const old of dates.slice(0, dates.length - 120)) delete map[old];
    }
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Load a saved report-date payload from localStorage. */
export function getLocalPhysicalStockSnapshot(distributorCode, reportDate) {
  const code = String(distributorCode || "").trim();
  const date = String(reportDate || "").slice(0, 10);
  if (!code || !date) return null;
  try {
    const map = JSON.parse(localStorage.getItem(snapshotStorageKey(code)) || "{}");
    const raw = map[date];
    if (!raw) return null;
    return normalizePhysicalStockPayload(raw);
  } catch {
    return null;
  }
}

/** All report-date payloads stored locally for this distributor. */
export function listLocalPhysicalStockSnapshots(distributorCode) {
  const code = String(distributorCode || "").trim();
  if (!code) return [];
  try {
    const map = JSON.parse(localStorage.getItem(snapshotStorageKey(code)) || "{}");
    return Object.values(map)
      .map((raw) => normalizePhysicalStockPayload(raw))
      .filter((p) => rowsHaveCarryForwardSource(p.rows));
  } catch {
    return [];
  }
}

function physicalStockPayloadTimestamp(payload) {
  const iso = payload?.updatedAt;
  if (iso) {
    const t = Date.parse(iso);
    if (Number.isFinite(t)) return t;
  }
  const rd = payload?.reportDate;
  if (rd) {
    const t = Date.parse(`${String(rd).slice(0, 10)}T23:59:59`);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

/** Any saved field on any lot (qty or batch traceability). */
export function rowsHaveAnyStockData(rows) {
  for (const row of rows || []) {
    for (const lot of getLotsFromProductRow(row)) {
      if (lot.mfgDate || lot.batchNo || lot.bbdDate) return true;
      for (const key of ["openingStockQty", "primarySale", "physicalStockQty", "secondarySale"]) {
        const v = lot[key];
        if (v !== "" && v != null && Number.isFinite(Number(v))) return true;
      }
    }
  }
  return false;
}

/**
 * Pick the most recently updated saved stock for carry-forward (not the same report date as target).
 */
export function findLatestPhysicalStockForCarryForward(candidates, targetReportDate) {
  const target = String(targetReportDate || "").slice(0, 10);
  let best = null;
  let bestTs = -1;
  for (const item of candidates || []) {
    if (!item) continue;
    const norm = normalizePhysicalStockPayload(item);
    if (!rowsHaveCarryForwardSource(norm.rows)) continue;
    const rd = String(norm.reportDate || "").slice(0, 10);
    if (rd === target) continue;
    const ts = physicalStockPayloadTimestamp(norm);
    if (ts > bestTs) {
      bestTs = ts;
      best = norm;
    }
  }
  return best;
}

export function rowsHaveUserQuantityEntry(rows) {
  const hasQty = (v) => v !== "" && v != null && Number.isFinite(Number(v));
  for (const row of rows || []) {
    for (const lot of getLotsFromProductRow(row)) {
      if (hasQty(lot.openingStockQty) || hasQty(lot.primarySale) || hasQty(lot.physicalStockQty)) {
        return true;
      }
    }
  }
  return false;
}

/** Yesterday (or prior day) had batch lines or quantities worth carrying forward. */
export function rowsHaveCarryForwardSource(rows) {
  for (const row of rows || []) {
    for (const lot of getLotsFromProductRow(row)) {
      if (lot.mfgDate || lot.batchNo || lot.bbdDate) return true;
      if (lot.physicalStockQty !== "" && lot.physicalStockQty != null && Number.isFinite(Number(lot.physicalStockQty))) {
        return true;
      }
      if (lot.openingStockQty !== "" && lot.openingStockQty != null && Number.isFinite(Number(lot.openingStockQty))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Copy last-saved FIFO lines into a new report day: same MFG / batch / BBD;
 * prior physical stock → opening; primary / physical / secondary cleared (user may edit all).
 */
export function buildRowsCarriedFromPreviousDay(previousRows) {
  const base = mergePhysicalStockRows(previousRows);
  return base.map((row) => ({
    productSku: row.productSku,
    lots: getLotsFromProductRow(row).map((lot) => {
      const next = createEmptyFifoLot();
      next.mfgDate = lot.mfgDate || "";
      next.batchNo = lot.batchNo || "";
      next.bbdDate = lot.bbdDate || "";
      const phy = lot.physicalStockQty;
      if (phy !== "" && phy != null && Number.isFinite(Number(phy))) {
        next.openingStockQty = Math.max(0, Math.round(Number(phy)));
      }
      return next;
    }),
  }));
}

/** True when any lot is missing MFG, batch, or BBD (should pull from last save). */
export function rowsNeedTraceabilityFill(rows) {
  for (const row of rows || []) {
    for (const lot of getLotsFromProductRow(row)) {
      if (!lot.mfgDate || !lot.batchNo || !lot.bbdDate) return true;
    }
  }
  return false;
}

/** Fill empty MFG / batch / BBD on current rows from a prior report (per SKU + lot index). */
export function mergeTraceabilityFromPriorRows(currentRows, priorRows) {
  const merged = mergePhysicalStockRows(currentRows);
  const priorMerged = mergePhysicalStockRows(priorRows);
  const priorMap = new Map();
  priorMerged.forEach((r) => {
    priorMap.set(String(r.productSku).trim().toUpperCase(), getLotsFromProductRow(r));
  });
  return merged.map((row) => {
    const priorLots = priorMap.get(String(row.productSku).trim().toUpperCase()) || [];
    const lots = getLotsFromProductRow(row).map((lot, i) => {
      const priorLot = priorLots[i] || priorLots[priorLots.length - 1];
      if (!priorLot) return lot;
      return {
        ...lot,
        mfgDate: lot.mfgDate || priorLot.mfgDate || "",
        batchNo: lot.batchNo || priorLot.batchNo || "",
        bbdDate: lot.bbdDate || priorLot.bbdDate || "",
      };
    });
    return { productSku: row.productSku, lots };
  });
}

/** New FIFO line with MFG / batch / BBD copied from an existing lot (same SKU). */
export function createFifoLotWithTraceabilityFrom(sourceLot) {
  const next = createEmptyFifoLot();
  if (!sourceLot) return next;
  next.mfgDate = sourceLot.mfgDate || "";
  next.batchNo = sourceLot.batchNo || "";
  next.bbdDate = sourceLot.bbdDate || "";
  return next;
}

/**
 * Rows for a report date: use same-day save if present, else pre-fill from the last updated stock.
 * @param {{ targetReportDate: string, savedRaw: object|null, distributorCode: string, fetchLatestSnapshot?: (code: string, excludeReportDate: string) => Promise<object|null> }} params
 */
export async function resolvePhysicalStockRowsForReportDate({
  targetReportDate,
  savedRaw,
  distributorCode,
  fetchLatestSnapshot,
}) {
  const target = String(targetReportDate || "").slice(0, 10) || localIsoDate();
  const localForTarget = getLocalPhysicalStockSnapshot(distributorCode, target);
  const distSaved = normalizePhysicalStockPayload(savedRaw || {});
  const saved = localForTarget ? normalizePhysicalStockPayload(localForTarget) : distSaved;

  const candidates = [...listLocalPhysicalStockSnapshots(distributorCode)];
  const pushCandidate = (payload) => {
    if (!payload || !rowsHaveCarryForwardSource(payload.rows)) return;
    const d = String(payload.reportDate || "").slice(0, 10);
    if (d === target) return;
    if (candidates.some((c) => String(c.reportDate || "").slice(0, 10) === d)) return;
    candidates.push(payload);
  };
  pushCandidate(distSaved);
  if (saved !== distSaved) pushCandidate(saved);

  if (typeof fetchLatestSnapshot === "function") {
    try {
      const remote = await fetchLatestSnapshot(distributorCode, target);
      if (remote && rowsHaveCarryForwardSource(remote.rows)) {
        pushCandidate(normalizePhysicalStockPayload(remote));
      }
    } catch {
      /* fall through */
    }
  }

  const prior = findLatestPhysicalStockForCarryForward(candidates, target);
  const carriedFrom = prior ? String(prior.reportDate || "").slice(0, 10) || null : null;
  const isSameReportDay = String(saved.reportDate || "").slice(0, 10) === target;

  if (isSameReportDay) {
    if (prior && rowsNeedTraceabilityFill(saved.rows)) {
      if (!rowsHaveUserQuantityEntry(saved.rows) && !rowsHaveAnyStockData(saved.rows)) {
        return {
          rows: buildRowsCarriedFromPreviousDay(prior.rows),
          carriedFromDate: carriedFrom,
        };
      }
      return {
        rows: mergeTraceabilityFromPriorRows(saved.rows, prior.rows),
        carriedFromDate: carriedFrom,
      };
    }
    if (rowsHaveAnyStockData(saved.rows)) {
      return { rows: saved.rows, carriedFromDate: null };
    }
  }

  if (prior) {
    return {
      rows: buildRowsCarriedFromPreviousDay(prior.rows),
      carriedFromDate: carriedFrom,
    };
  }

  if (isSameReportDay) {
    return { rows: saved.rows, carriedFromDate: null };
  }

  return { rows: createEmptyPhysicalStockRows(), carriedFromDate: null };
}
