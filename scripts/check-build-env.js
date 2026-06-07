/**
 * Runs before `react-scripts build` so Cloudflare logs show whether
 * REACT_APP_* vars are present at build time (CRA bakes them into the bundle).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

// Load .env for local builds (CRA does this too; Cloudflare injects vars directly).
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

const reactAppKeys = Object.keys(process.env)
  .filter((k) => k.startsWith('REACT_APP_'))
  .sort();
console.log(
  '[build-env] REACT_APP_* keys in process.env:',
  reactAppKeys.length ? reactAppKeys.join(', ') : '(none)'
);
console.log('[build-env] CF_PAGES:', process.env.CF_PAGES || 'not set', '| CI:', process.env.CI || 'not set');

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
  // Belt-and-suspenders: CRA always reads .env.production.local during build.
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
      'Cloudflare Pages → your project → Settings → Variables and Secrets:\n' +
      '  • Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY\n' +
      '  • Scope: Production (and Preview if needed)\n' +
      '  • Type: Plain text (not runtime-only)\n' +
      '  • Then push a new commit or Retry deployment\n'
  );
  if (process.env.CI === 'true' || process.env.CF_PAGES === '1') {
    process.exit(1);
  }
}
