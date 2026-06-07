/**
 * Runs before `react-scripts build` so Cloudflare logs show whether
 * REACT_APP_* vars are present at build time (CRA bakes them into the bundle).
 */
const fs = require('fs');
const path = require('path');

// Load .env for local builds (CRA does this too; Cloudflare injects vars directly).
const envPath = path.join(__dirname, '..', '.env');
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

const url = (process.env.REACT_APP_SUPABASE_URL || '').trim();
const key = (process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();

const urlSet = Boolean(url);
const keySet = Boolean(key);

console.log('[build-env] REACT_APP_SUPABASE_URL:', urlSet ? `set (${url})` : 'MISSING');
console.log(
  '[build-env] REACT_APP_SUPABASE_ANON_KEY:',
  keySet ? `set (${key.length} chars, starts with ${key.slice(0, 12)}...)` : 'MISSING'
);

if (!urlSet || !keySet) {
  console.error(
    '\n[build-env] Supabase env vars are missing at build time.\n' +
      'Create React App only reads REACT_APP_* variables when `npm run build` runs.\n' +
      'Cloudflare Pages: Settings → Variables and Secrets → add for Production,\n' +
      'then redeploy (Retry deployment or push a new commit).\n' +
      'Names must be exactly: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY\n'
  );
  if (process.env.CI === 'true') {
    process.exit(1);
  }
}
