/**
 * Stable key so two Excel rows for the same outlet merge even when punctuation differs
 * (e.g. "...,P/GYTSHEL (EASTERN)" vs "... P/GYTSHEL (EASTERN)" — comma vs space before P/).
 * Used for Excel achievement aggregation and for matching those totals to master distributors.
 */
export function partyNameAggregationKey(partyName) {
  if (partyName == null || partyName === "") return "";
  const s = String(partyName)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/[/-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match Excel "Party Name / Address" to a master distributor record.
 * Used for sales upload and performance aggregation so the same rules apply everywhere.
 *
 * Order: unique canonical (prefix before comma) → exact normalized full name →
 *        loose match (commas removed, normalized) among canonical ties → same loose globally if unique.
 */
export function findDistributorForPartyName(distributors, partyName) {
  if (!partyName || !Array.isArray(distributors) || distributors.length === 0) {
    return null;
  }

  const stripInvisible = (s) =>
    String(s || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

  const normalizeDistributorName = (s) =>
    stripInvisible(s)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const normalizeCanonical = (s) =>
    normalizeDistributorName(s)
      .replace(/\(.*?\)/g, " ")
      .split(",")[0]
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  /** Same party line with or without commas (e.g. "A, B" vs "A B") */
  const normalizeLoose = (s) => normalizeDistributorName(String(s || "").replace(/,/g, " "));

  const raw = stripInvisible(partyName);
  if (!raw) return null;

  const saleNorm = normalizeDistributorName(raw);
  const saleLoose = normalizeLoose(raw);
  const saleCanonical = normalizeCanonical(raw);

  const exactCanonical = distributors.filter((d) => {
    const c = normalizeCanonical(d?.name || "");
    return Boolean(c) && Boolean(saleCanonical) && c === saleCanonical;
  });

  if (exactCanonical.length === 1) {
    return exactCanonical[0];
  }

  const exactName = distributors.filter(
    (d) => normalizeDistributorName(d?.name || "") === saleNorm
  );
  if (exactName.length === 1) {
    return exactName[0];
  }

  if (exactCanonical.length > 1) {
    const looseInCanonical = exactCanonical.filter(
      (d) => normalizeLoose(d?.name || "") === saleLoose
    );
    if (looseInCanonical.length === 1) {
      return looseInCanonical[0];
    }
  }

  const looseAll = distributors.filter(
    (d) => normalizeLoose(d?.name || "") === saleLoose
  );
  if (looseAll.length === 1) {
    return looseAll[0];
  }

  const saleFp = partyNameAggregationKey(raw);
  if (saleFp) {
    const fpMatches = distributors.filter(
      (d) => partyNameAggregationKey(d?.name || "") === saleFp
    );
    if (fpMatches.length === 1) {
      return fpMatches[0];
    }
  }

  return null;
}
