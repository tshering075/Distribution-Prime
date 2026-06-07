/**
 * Runs before `react-scripts build` so Cloudflare logs show whether
 * REACT_APP_* vars are present at build time (CRA bakes them into the bundle).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function parseWranglerVars(tomlPath) {
  if (!fs.existsSync(tomlPath)) return {};
  const vars = {};
  let inVars = false;
  for (const line of fs.readFileSync(tomlPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed === '[vars]') {
      inVars = true;
      continue;
    }
    if (trimmed.startsWith('[')) {
      inVars = false;
      continue;
    }
    if (!inVars) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

// 1) Cloudflare dashboard (often ignored when wrangler.toml has pages_build_output_dir)
// 2) wrangler.toml [vars] — reliable for Pages Git builds
// 3) local .env — dev fallback
const wranglerVars = parseWranglerVars(path.join(root, 'wrangler.toml'));
for (const [key, value] of Object.entries(wranglerVars)) {
  if (!(key in process.env) || !String(process.env[key] || '').trim()) {
    process.env[key] = value;
  }
}
loadDotEnv(path.join(root, '.env'));

const reactAppKeys = Object.keys(process.env)
  .filter((k) => k.startsWith('REACT_APP_'))
  .sort();
console.log(
  '[build-env] REACT_APP_* keys in process.env:',
  reactAppKeys.length ? reactAppKeys.join(', ') : '(none)'
);
console.log('[build-env] CF_PAGES:', process.env.CF_PAGES || 'not set', '| CI:', process.env.CI || 'not set');
if (Object.keys(wranglerVars).length) {
  console.log('[build-env] wrangler.toml [vars] keys:', Object.keys(wranglerVars).join(', '));
}

const url = (process.env.REACT_APP_SUPABASE_URL || '').trim();
const key = (process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();

const urlSet = Boolean(url);
const keySet = Boolean(key);

console.log('[build-env] REACT_APP_SUPABASE_URL:', urlSet ? `set (${url})` : 'MISSING');
console.log(
  '[build-env] REACT_APP_SUPABASE_ANON_KEY:',
  keySet ? `set (${key.length} chars, starts with ${key.slice(0, 12)}...)` : 'MISSING'
);

if (urlSet && keySet) {
  const productionLocal = path.join(root, '.env.production.local');
  fs.writeFileSync(
    productionLocal,
    `REACT_APP_SUPABASE_URL=${url}\nREACT_APP_SUPABASE_ANON_KEY=${key}\n`
  );
  console.log('[build-env] Wrote .env.production.local for react-scripts build');
}

if (!urlSet || !keySet) {
  console.error(
    '\n[build-env] Supabase env vars are missing at build time.\n' +
      'With wrangler.toml (pages_build_output_dir), Cloudflare ignores dashboard variables.\n' +
      'Add them under [vars] in wrangler.toml, or in local .env for development.\n'
  );
  if (process.env.CI === 'true' || process.env.CF_PAGES === '1') {
    process.exit(1);
  }
}
