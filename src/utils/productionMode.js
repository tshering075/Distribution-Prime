/** Production builds require Supabase auth — no localStorage demo login fallbacks. */
export function isProductionAuthMode() {
  if (process.env.REACT_APP_REQUIRE_SUPABASE_AUTH === 'true') return true;
  if (process.env.REACT_APP_REQUIRE_SUPABASE_AUTH === 'false') return false;
  return process.env.NODE_ENV === 'production';
}
