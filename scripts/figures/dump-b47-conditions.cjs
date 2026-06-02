// ETAPA 52 — dump enunțurilor b47 în JSON (plain node, fără tsx). node scripts/figures/dump-b47-conditions.cjs
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key, { auth: { persistSession: false } });
(async () => {
  const { data, error } = await sb.from('figura_autor').select('slug, condition').like('slug', 'b47-%');
  if (error) { console.error(error.message); process.exit(1); }
  const out = {};
  for (const r of data.sort((a, b) => a.slug.localeCompare(b.slug))) out[r.slug] = r.condition;
  fs.writeFileSync('scripts/figures/b47-conditions.json', JSON.stringify(out, null, 2) + '\n');
  console.log('scris ' + Object.keys(out).length + ' enunțuri în scripts/figures/b47-conditions.json');
  process.exit(0);
})();
