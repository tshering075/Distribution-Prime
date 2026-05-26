import { skuNameLooksLikeBuiltInCanLine } from "../constants/productSkus";

/**
 * Read description text from an FG row (admin / Supabase may use different keys).
 */
export function fgRowDescription(r) {
  if (!r || typeof r !== "object") return "";
  const raw =
    r.description ??
    r.Description ??
    r.DESC ??
    r.itemDescription ??
    r.ItemDescription ??
    r.materialDescription ??
    r.MaterialDescription ??
    r.material_description ??
    r.productDescription ??
    r.ProductDescription;
  return String(raw ?? "").trim();
}

/**
 * Read quantity from an FG row (tolerant key names and string numbers).
 */
export function fgRowQuantity(r) {
  if (!r || typeof r !== "object") return NaN;
  const raw = r.quantity ?? r.Quantity ?? r.qty ?? r.Qty ?? r.QTY ?? r.qnty;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const q = parseFloat(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(q) ? q : NaN;
}

function scrubStockLabel(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[''`´]/g, "")
    .replace(/\u00a0/g, " ");
}

/**
 * Normalize labels from Excel (e.g. "COKE 500 ML") and calculator SKUs ("COKE 300 ML") for matching.
 */
export function normalizeForStockMatch(s) {
  let x = scrubStockLabel(s)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  x = x.replace(/[\u2013\u2014\u2212]+/g, " ");
  x = x.replace(/[_-]+/g, " ");
  // "CHARGE300ML" / "KINLEY500ML" — \bCHARGE\b fails (E and 3 are both "word" chars). Split before volumes.
  x = x.replace(/([A-Z])(?=(\d+(?:\.\d+)?)\s*(?:ML|L)\b)/gi, "$1 ");
  x = x.replace(/\b(\d+(?:\.\d+)?)\s*LTR\b/gi, (_, n) => `${n}L`);
  x = x.replace(/\b(\d+(?:\.\d+)?)\s*LT\b/gi, (_, n) => `${n}L`);
  x = x.replace(/\b(\d+(?:\.\d+)?)\s*(?:LITRE|LITER|LTRS?)\b/gi, (_, n) => `${n}L`);
  x = x.replace(/\b(\d+)\s*CL\b/gi, (_, n) => {
    const ml = parseInt(n, 10) * 10;
    return `${ml}ML`;
  });
  x = x.replace(/\b(\d+(?:\.\d+)?)\s*(ML|L)\b/gi, (_, n, u) => `${n}${String(u).toUpperCase()}`);
  x = x.replace(/\b1\.25\s*L\b/gi, "1.25L");
  x = x.replace(/\b1\s*L\b/gi, "1L");
  x = x.replace(/\bML\b/g, "ML");
  // Drop stray periods (not between digits, so 1.25L / 0.5L stay intact)
  x = x.replace(/(?<!\d)\.(?!\d)/g, "");
  x = x.replace(/\bCOCO\s+COLA\b/gi, "COCA COLA");
  x = x.replace(/\bCC\b/g, "COCA COLA");
  x = x.replace(/\bCOKE\b/g, "COCA COLA");
  x = x.replace(/\bCOCA\s*COLA\b/g, "COCA COLA");
  x = x.replace(/\bDIET\b/g, "DIET");
  x = x.replace(/\bZERO\b/g, "ZERO");
  // Thums / Charge — compound phrases before lone THUMSUP or TU (avoids "TU CHARGE" never collapsing)
  x = x.replace(/\bTHUMS\s+UP\s+CHARGE\b/gi, "CHARGE");
  x = x.replace(/\bTHUMS\s+CHARGE\b/gi, "CHARGE");
  x = x.replace(/\bTU\s+CHARGE\b/gi, "CHARGE");
  x = x.replace(/\bTHUMSUP\s*CHARGE\b/gi, "CHARGE");
  x = x.replace(/\bTHUMSUPCHARGE\b/gi, "CHARGE");
  x = x.replace(/\bTHUMSUP\b/gi, "THUMS UP");
  x = x.replace(/\bTU\b/g, "THUMS UP");
  x = x.replace(/\bTHUMS\s*UP\b/g, "THUMS UP");
  x = x.replace(/\bCHRG\b/g, "CHARGE");
  x = x.replace(/\bCHARGED\b/g, "CHARGE");
  x = x.replace(/\bLIMCA\b/gi, "LIMCA");
  x = x.replace(/\bSCHWEPPES\b/gi, "SCHWEPPES");
  // Kinley / PDW labels common in bottler FG extracts
  x = x.replace(/\bCPDW\b/g, "KINLEY");
  x = x.replace(/\bPDW\b/g, "KINLEY");
  x = x.replace(/\bKW\b/g, "KINLEY");
  x = x.replace(/\bKLY\b/g, "KINLEY");
  x = x.replace(/\bKNLY\b/g, "KINLEY");
  x = x.replace(/\bSLK\b/gi, "SLEEK");
  return x.trim();
}

/** Stable key: same logical product text in the FG table sums here (all batches with same description). */
export function stockMatchFingerprint(s) {
  return normalizeForStockMatch(s).replace(/\s+/g, "");
}

/** Calculator SKU is a CAN line — must not use PET/RB FG rows (and vice versa). */
export function calculatorSkuIsCanFormat(skuName) {
  return skuNameLooksLikeBuiltInCanLine(skuName);
}

/** Normalized FG description is a can / tin / sleek pack (not PET-only). */
export function excelNormIndicatesCanPackaging(excelNorm) {
  if (!excelNorm) return false;
  const s = ` ${String(excelNorm)} `;
  if (/\bCAN\b/.test(s)) return true;
  if (/\bTIN\b/.test(s)) return true;
  if (/\bSLEEK\b/i.test(excelNorm)) return true;
  if (/\bALU(MINIUM)?\s+CAN\b/i.test(excelNorm)) return true;
  return false;
}

/** True when CAN/TIN/SLEEK clearly refers to the product pack (not "CAN plant", "Mexican", etc.). */
function excelExplicitCanProductPack(excelNorm) {
  if (!excelNorm) return false;
  if (/\bSLEEK\b|\bTIN\b/i.test(excelNorm)) return true;
  if (/\bALU(MINIUM)?\s+CAN\b/i.test(excelNorm)) return true;
  if (/\b\d+(?:\.\d+)?\s*(?:ML|L)\b.*\bCAN\b|\bCAN\b.*\b\d+(?:\.\d+)?\s*(?:ML|L)\b/i.test(excelNorm)) return true;
  return false;
}

/** Minimal Charge / Thums signal for packaging (see excelHintsCharge). */
function excelHintsChargeLoose(excelNorm) {
  if (!excelNorm) return false;
  if (/DISCHARGE|SUPERCHARGE|RECHARGE/i.test(excelNorm)) return false;
  return /\bCHARGE\b|\bCHRG\b/i.test(excelNorm) || /THUMS|THUMSUP|TU\b/i.test(excelNorm);
}

/**
 * PET SKUs ignore can-only FG rows; CAN SKUs only use can-marked FG rows.
 * Kinley / Charge PET lines often include the letters "CAN" in plant or location text — do not treat that as a tin pack.
 */
export function packagingMatchesSkuToExcel(skuName, excelNorm) {
  const skuCan = calculatorSkuIsCanFormat(skuName);
  const exCan = excelNormIndicatesCanPackaging(excelNorm);
  const skuStr = String(skuName || "");
  const exStr = String(excelNorm || "");

  if (skuCan) return exCan;

  if (/KINLEY/i.test(skuStr) && /\bKINLEY\b/i.test(exStr)) {
    if (!exCan) return true;
    if (!excelExplicitCanProductPack(exStr)) return true;
    return false;
  }

  if (/\bCHARGE\b|\bCHRG\b/i.test(normalizeForStockMatch(skuStr)) && excelHintsChargeLoose(exStr)) {
    if (!exCan) return true;
    if (!excelExplicitCanProductPack(exStr)) return true;
    return false;
  }

  return !exCan;
}

/** e.g. "500ML", "1.25L" — avoid matching 300ml SKU to 500ml stock */
export function extractSizeToken(normalized) {
  const n = String(normalized || "");
  const m = n.match(/\b(\d+(?:\.\d+)?)(ML|L)\b/);
  return m ? `${m[1]}${m[2]}` : null;
}

/** Millilitres for one volume in a normalized label (1L ↔ 1000ML, 0.5L ↔ 500ML). */
export function parseSizeToMl(normalized) {
  const m = String(normalized || "").match(/\b(\d+(?:\.\d+)?)\s*(ML|L)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const u = String(m[2]).toUpperCase();
  if (u === "L") return Math.round(n * 1000);
  return Math.round(n);
}

/** True when both sides carry a volume and those volumes differ (after canonical ml). */
function sizesRejectPair(skuNorm, excelNorm) {
  const sm = parseSizeToMl(skuNorm);
  const em = parseSizeToMl(excelNorm);
  if (sm != null && em != null) return sm !== em;
  const st = extractSizeToken(skuNorm);
  const et = extractSizeToken(excelNorm);
  if (st && et && (sm == null || em == null) && st !== et) return true;
  return false;
}

function tokens(s) {
  return normalizeForStockMatch(s)
    .split(" ")
    .filter((t) => t.length > 1);
}

export function tokenOverlapScore(skuNorm, excelNorm) {
  const A = new Set(tokens(skuNorm));
  const B = new Set(tokens(excelNorm));
  if (A.size === 0 || B.size === 0) return 0;
  let n = 0;
  for (const t of A) {
    if (B.has(t)) n += 1;
  }
  return n;
}

/**
 * Sum quantity per normalized description (same description string → one bucket; matches FG table grouping).
 */
export function aggregateQuantitiesByNormalizedDescription(rows) {
  const map = new Map();
  for (const r of rows) {
    const desc = fgRowDescription(r);
    if (!desc) continue;
    const k = normalizeForStockMatch(desc);
    if (!k) continue;
    const q = fgRowQuantity(r);
    if (!Number.isFinite(q) || q < 0) continue;
    map.set(k, (map.get(k) || 0) + q);
  }
  return map;
}

/**
 * Same totals as summing the admin FG table: all rows whose description normalizes the same way share one bucket.
 */
export function aggregateQuantitiesByFingerprint(rows) {
  const map = new Map();
  for (const r of rows) {
    const desc = fgRowDescription(r);
    if (!desc) continue;
    const fp = stockMatchFingerprint(desc);
    if (!fp) continue;
    const q = fgRowQuantity(r);
    if (!Number.isFinite(q) || q < 0) continue;
    map.set(fp, (map.get(fp) || 0) + q);
  }
  return map;
}

function linesMatchForSku(skuNorm, excelK, skuName) {
  if (!packagingMatchesSkuToExcel(skuName, excelK)) return false;
  if (skuNorm === excelK) return true;
  if (sizesRejectPair(skuNorm, excelK)) return false;

  if (tokenOverlapScore(skuNorm, excelK) >= 2) return true;

  if (skuNorm.includes(excelK) || excelK.includes(skuNorm)) {
    return Math.min(skuNorm.length, excelK.length) >= 6;
  }
  return false;
}

/** Word-ish match: works after "CHARGE300ML" → "CHARGE 300ML" and for spaced tokens. */
function hasToken(norm, re) {
  return re.test(String(norm || ""));
}

/** Kinley / Charge etc. when Excel uses longer descriptions (e.g. “Kinley mineral water 500 ml”). */
function sharedCoreBrand(skuNorm, excelNorm) {
  if (hasToken(skuNorm, /\bKINLEY\b/i) && hasToken(excelNorm, /\bKINLEY\b/i)) return true;
  if (hasToken(skuNorm, /\bCHARGE\b|\bCHRG\b/i)) {
    if (hasToken(excelNorm, /\bCHARGE\b|\bCHRG\b/i)) return true;
    if (hasToken(excelNorm, /\bTHUMS\b/i) && hasToken(excelNorm, /\bCHARGE\b|\bCHRG\b/i)) return true;
    if (hasToken(excelNorm, /\bTHUMS\b/i) && hasToken(excelNorm, /\bUP\b/i) && /CHARGE|CHRG/i.test(excelNorm)) return true;
  }
  return false;
}

/** FG row reads as packaged / mineral water (Kinley) but omits the word KINLEY. */
function excelKinleyWaterHint(excelNorm) {
  if (hasToken(excelNorm, /\bKINLEY\b/i)) return true;
  if (hasToken(excelNorm, /\bPDW\b|\bCPDW\b/i)) return true;
  if (hasToken(excelNorm, /\bMINERAL\b/i) && hasToken(excelNorm, /\bWATER\b/i)) return true;
  if (hasToken(excelNorm, /\bPACKAGED\b/i) && hasToken(excelNorm, /\bDRINKING\b/i)) return true;
  return false;
}

/** Excel line is clearly Thums Charge / Charge even if spacing collapsed. */
function excelHintsCharge(excelNorm) {
  if (!excelNorm) return false;
  if (/DISCHARGE|SUPERCHARGE|RECHARGE/i.test(excelNorm)) return false;
  if (/\bCHARGE\b|\bCHRG\b/i.test(excelNorm)) return true;
  if (/CHARGE|CHRG/i.test(excelNorm) && /THUMS|THUMSUP|TU\b/i.test(excelNorm)) return true;
  if (/\bTHUMS\b.*\bCHARGE\b|\bCHARGE\b.*\bTHUMS\b/i.test(excelNorm)) return true;
  if (/THUMSUP.*CHARGE|CHARGE.*THUMSUP/i.test(excelNorm.replace(/\s+/g, " "))) return true;
  return false;
}

/** Every ML volume literal in text (handles multi-volume SAP strings; ignores tiny noise). */
function allPackMlInText(norm) {
  const out = [];
  const re = /\b(\d+(?:\.\d+)?)\s*(ML|L)\b/gi;
  let m;
  while ((m = re.exec(norm)) !== null) {
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n)) continue;
    const u = String(m[2]).toUpperCase();
    const ml = u === "L" ? Math.round(n * 1000) : Math.round(n);
    if (ml >= 50 && ml <= 6000) out.push(ml);
  }
  return out;
}

/**
 * True if FG text refers to the same pack size as the SKU (many files omit "ML" or use CL/LT).
 */
function volumeMatchesPack(excelNorm, skuMl) {
  if (skuMl == null || !Number.isFinite(skuMl)) return false;
  const mentions = allPackMlInText(excelNorm);
  if (mentions.includes(skuMl)) return true;
  const primary = parseSizeToMl(excelNorm);
  if (primary != null) return primary === skuMl;
  const re = new RegExp(`\\b${skuMl}\\b`);
  if (re.test(excelNorm)) return true;
  if (skuMl === 1000 && /\b1000\b/.test(excelNorm)) return true;
  return false;
}

function sumNormMapWhere(normMap, test) {
  let sum = 0;
  for (const [excelK, qty] of normMap) {
    if (!Number.isFinite(qty) || qty < 0) continue;
    if (test(excelK, qty)) sum += qty;
  }
  return sum;
}

function sumRowsWhere(rows, test) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  let sum = 0;
  for (const r of rows) {
    const q = fgRowQuantity(r);
    if (!Number.isFinite(q) || q < 0) continue;
    const desc = fgRowDescription(r);
    if (!desc) continue;
    const ex = normalizeForStockMatch(desc);
    if (!ex) continue;
    if (test(ex, q)) sum += q;
  }
  return sum;
}

/**
 * Fingerprints to try for file lookup.
 * CAN calculator SKUs must NOT strip CAN — otherwise they share PET/RB stock (same fingerprint as COKE 300 ML).
 * PET SKUs may try a CAN-stripped variant only to match FG that forgot the word CAN (legacy); packaging filter still blocks can-only rows.
 */
function skuFingerprintsForFileLookup(skuName) {
  const n = normalizeForStockMatch(skuName);
  const out = [];
  const push = (s) => {
    const fp = stockMatchFingerprint(s);
    if (fp && !out.includes(fp)) out.push(fp);
  };
  push(n);
  if (!calculatorSkuIsCanFormat(skuName)) {
    const stripped = n.replace(/\bCAN\b/g, " ").replace(/\s+/g, " ").trim();
    if (stripped && stripped !== n) push(stripped);
  }
  return out;
}

/** Sum FG quantities for rows whose fingerprint equals `fp` and packaging matches the calculator SKU. */
function sumQtyForFingerprintAndPackaging(skuName, rows, fp) {
  if (!fp || !Array.isArray(rows)) return { matched: false, sum: 0 };
  let sum = 0;
  let matched = false;
  for (const r of rows) {
    const desc = fgRowDescription(r);
    if (!desc) continue;
    if (stockMatchFingerprint(desc) !== fp) continue;
    const ex = normalizeForStockMatch(desc);
    if (!packagingMatchesSkuToExcel(skuName, ex)) continue;
    matched = true;
    const q = fgRowQuantity(r);
    if (Number.isFinite(q) && q >= 0) sum += q;
  }
  return { matched, sum };
}

/**
 * Opening cases for one calculator SKU: exact fingerprint match to aggregated file rows first (aligned with admin totals),
 * else a single best fuzzy bucket (no summing multiple buckets — avoids double-count).
 */
export function resolveOpeningQtyForSku(skuName, fpMap, normMap, rows) {
  if (!skuName || !fpMap || !normMap) return null;
  const rowList = Array.isArray(rows) ? rows : [];

  for (const fp of skuFingerprintsForFileLookup(skuName)) {
    const { matched, sum } = sumQtyForFingerprintAndPackaging(skuName, rowList, fp);
    if (matched) return Math.round(sum);
  }

  const skuN = normalizeForStockMatch(skuName);
  const skuNFuzzy = skuN.replace(/\bCAN\b/g, " ").replace(/\s+/g, " ").trim();
  const skuTries = calculatorSkuIsCanFormat(skuName)
    ? [skuN]
    : [skuN, skuNFuzzy].filter((s, i, a) => s && a.indexOf(s) === i);

  let bestQty = null;
  let bestSc = -1;
  for (const skuTry of skuTries) {
    for (const [excelK, qty] of normMap) {
      if (!linesMatchForSku(skuTry, excelK, skuName)) continue;
      const sc = tokenOverlapScore(skuTry, excelK);
      if (sc > bestSc) {
        bestSc = sc;
        bestQty = qty;
      }
    }
  }
  if (bestSc >= 2 && bestQty != null) return Math.round(bestQty);

  const skuMl = parseSizeToMl(skuN) ?? parseSizeToMl(skuNFuzzy);

  if (skuMl != null && hasToken(skuN, /\bCHARGE\b|\bCHRG\b/i)) {
    let s = sumNormMapWhere(
      normMap,
      (excelK) =>
        packagingMatchesSkuToExcel(skuName, excelK) &&
        volumeMatchesPack(excelK, skuMl) &&
        excelHintsCharge(excelK)
    );
    if (s <= 0) {
      s = sumRowsWhere(
        rowList,
        (ex) =>
          packagingMatchesSkuToExcel(skuName, ex) &&
          volumeMatchesPack(ex, skuMl) &&
          excelHintsCharge(ex)
      );
    }
    if (s > 0) return Math.round(s);
  }

  if (skuMl != null && hasToken(skuN, /\bKINLEY\b/i)) {
    let s = sumNormMapWhere(
      normMap,
      (excelK) =>
        packagingMatchesSkuToExcel(skuName, excelK) &&
        volumeMatchesPack(excelK, skuMl) &&
        (hasToken(excelK, /\bKINLEY\b/i) || excelKinleyWaterHint(excelK))
    );
    if (s <= 0) {
      s = sumRowsWhere(
        rowList,
        (ex) =>
          packagingMatchesSkuToExcel(skuName, ex) &&
          volumeMatchesPack(ex, skuMl) &&
          (hasToken(ex, /\bKINLEY\b/i) || excelKinleyWaterHint(ex))
      );
    }
    if (s > 0) return Math.round(s);
  }

  for (const skuTry of skuTries) {
    const tryMl = parseSizeToMl(skuTry);
    if (tryMl == null) continue;
    for (const [excelK, qty] of normMap) {
      if (!packagingMatchesSkuToExcel(skuName, excelK)) continue;
      const exMl = parseSizeToMl(excelK);
      if (exMl == null || exMl !== tryMl) continue;
      if (!sharedCoreBrand(skuTry, excelK)) continue;
      return Math.round(qty);
    }
  }

  return null;
}

/**
 * Sparse map: only SKUs that matched the FG file (non-zero opening or matched row).
 * @param {string[]} skuNames
 * @param {Array<{ description: string, quantity: * }>} rows
 * @returns {Record<string, number>}
 */
export function buildFgStockMapForSkus(skuNames, rows) {
  const fpMap = aggregateQuantitiesByFingerprint(rows);
  const normMap = aggregateQuantitiesByNormalizedDescription(rows);
  const out = {};
  const names = Array.isArray(skuNames) ? skuNames : [];
  for (const name of names) {
    const q = resolveOpeningQtyForSku(name, fpMap, normMap, rows);
    if (q != null && Number.isFinite(q)) out[name] = Math.round(q);
  }
  return out;
}

/**
 * Every calculator SKU → opening cases from file (0 if no row matches). Use for UI hints on all lines.
 * @param {string[]} skuNames
 * @param {Array<{ description: string, quantity: * }>} rows
 */
export function buildFgStockOpeningAllSkus(skuNames, rows) {
  const names = Array.isArray(skuNames) ? skuNames : [];
  const out = {};
  if (!Array.isArray(rows) || rows.length === 0) {
    for (const name of names) out[name] = 0;
    return out;
  }
  const fpMap = aggregateQuantitiesByFingerprint(rows);
  const normMap = aggregateQuantitiesByNormalizedDescription(rows);
  for (const name of names) {
    const q = resolveOpeningQtyForSku(name, fpMap, normMap, rows);
    out[name] = q != null && Number.isFinite(q) ? Math.round(q) : 0;
  }
  return out;
}
