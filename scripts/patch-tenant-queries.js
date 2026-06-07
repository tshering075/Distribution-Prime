const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/services/supabaseService.js');
let s = fs.readFileSync(file, 'utf8');

const tables = [
  'distributors',
  'admins',
  'orders',
  'targets',
  'schemes',
  'sales_data',
  'app_config',
  'distributor_physical_stock_snapshots',
];

for (const t of tables) {
  s = s.replace(
    new RegExp(`await supabase\\s*\\n\\s*\\.from\\('${t}'\\)`, 'g'),
    `await fromTenant('${t}')`
  );
  s = s.replace(
    new RegExp(`await supabase\\.from\\('${t}'\\)`, 'g'),
    `await fromTenant('${t}')`
  );
  s = s.replace(
    new RegExp(`let q = supabase\\s*\\n\\s*\\.from\\('${t}'\\)`, 'g'),
    `let q = fromTenant('${t}')`
  );
  s = s.replace(
    new RegExp(`let q = supabase\\.from\\('${t}'\\)`, 'g'),
    `let q = fromTenant('${t}')`
  );
  s = s.replace(
    new RegExp(`supabase\\s*\\n\\s*\\.from\\('${t}'\\)`, 'g'),
    `fromTenant('${t}')`
  );
}

fs.writeFileSync(file, s);
const remaining = [...s.matchAll(/supabase\s*\n\s*\.from\('/g)];
console.log('remaining chained supabase.from:', remaining.length);
