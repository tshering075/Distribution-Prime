/**
 * PostgREST helpers — avoid ".single()" when 0 or 2+ rows can be returned.
 */

export function isSingleRowCoerceError(error) {
  if (!error) return false;
  const msg = String(error.message || '');
  return (
    error.code === 'PGRST116' ||
    msg.includes('single JSON') ||
    msg.includes('Cannot coerce the result to a single JSON object')
  );
}

/** @returns {object|null} */
export function firstRow(data) {
  if (data == null) return null;
  if (Array.isArray(data)) return data.length ? data[0] : null;
  return data;
}
