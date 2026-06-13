import { normalizeForStockMatch } from "./fgStockSkuMatch";

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

/** True when an order SKU matches a physical-stock product line (abbreviated or full name). */
export function orderSkuMatchesPhysicalLine(orderNorm, productSku) {
  const lineNorm = normalizeForStockMatch(productSku);
  if (!orderNorm || !lineNorm) return false;
  if (orderNorm === lineNorm) return true;
  if (orderNorm.includes(lineNorm) || lineNorm.includes(orderNorm)) return true;

  const orderVol = extractVolumeToken(orderNorm);
  const lineVol = extractVolumeToken(lineNorm);
  if (!orderVol || orderVol !== lineVol) return false;

  return physicalLineBrandTokens(productSku).some((brand) => orderNorm.includes(brand));
}

/** True when two physical-stock / order SKU labels refer to the same product line. */
export function physicalStockSkusMatch(skuA, skuB) {
  const a = String(skuA || "").trim();
  const b = String(skuB || "").trim();
  if (!a || !b) return false;
  if (a.toUpperCase() === b.toUpperCase()) return true;
  const normA = normalizeForStockMatch(a);
  const normB = normalizeForStockMatch(b);
  if (normA && normB && normA === normB) return true;
  return orderSkuMatchesPhysicalLine(normA, b) || orderSkuMatchesPhysicalLine(normB, a);
}
