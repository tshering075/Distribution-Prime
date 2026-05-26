/** UC = (cases × ucMultiplier) / UC_DIVISOR — divisor is fixed for all products. */
export const UC_DIVISOR = 5.678;

/** Built-in catalogue (display names; keys for saved rates / orders). */
export const DEFAULT_SKUS = [
  { name: "COKE 300 ML", category: "CSD", kgPerCase: 8.28, ucMultiplier: 7.2, rate: 480 },
  { name: "COKE 500 ML", category: "CSD", kgPerCase: 13.16, ucMultiplier: 12, rate: 625 },
  { name: "COKE 1.25 L", category: "CSD", kgPerCase: 15.85, ucMultiplier: 15, rate: 640 },
  { name: "FANTA 300 ML", category: "CSD", kgPerCase: 8.28, ucMultiplier: 7.2, rate: 480 },
  { name: "FANTA 500 ML", category: "CSD", kgPerCase: 13.16, ucMultiplier: 12, rate: 625 },
  { name: "FANTA 1.25 L", category: "CSD", kgPerCase: 15.85, ucMultiplier: 15, rate: 640 },
  { name: "SPRITE 300 ML", category: "CSD", kgPerCase: 8.28, ucMultiplier: 7.2, rate: 480 },
  { name: "SPRITE 500 ML", category: "CSD", kgPerCase: 13.16, ucMultiplier: 12, rate: 625 },
  { name: "SPRITE 1.25 L", category: "CSD", kgPerCase: 15.85, ucMultiplier: 15, rate: 640 },
  { name: "CHARGED 300 ML", category: "CSD", kgPerCase: 8.28, ucMultiplier: 7.2, rate: 480 },
  { name: "CAN 300 ML", category: "CSD", kgPerCase: 8.28, ucMultiplier: null, rate: 750 },
  { name: "KINLEY WATER 200 ML", category: "Water", kgPerCase: 5.4, ucMultiplier: 4.8, rate: 95 },
  { name: "KINLEY WATER 500 ML", category: "Water", kgPerCase: 13.2, ucMultiplier: 12, rate: 135 },
  { name: "KINLEY WATER 1 L", category: "Water", kgPerCase: 12.5, ucMultiplier: 12, rate: 115 },
];

/** UI / FG: treat as can line when name has no "CAN" but product is can-only (e.g. COKE ZERO 300 ML). */
export function skuNameLooksLikeBuiltInCanLine(skuName) {
  const s = String(skuName || "");
  if (/\bCAN\b/i.test(s)) return true;
  if (/^COKE\s+ZERO\b/i.test(s)) return true;
  return false;
}

export const DEFAULT_SKU_NAMES = new Set(DEFAULT_SKUS.map((s) => s.name));

/** Line key for calculator & rates: "Brand" + optional variant e.g. "300 ML". */
export function customProductLineName(name, sku) {
  const n = String(name ?? "").trim();
  const s = String(sku ?? "").trim();
  if (!n && !s) return "";
  if (!s) return n;
  if (!n) return s;
  return `${n} ${s}`;
}
