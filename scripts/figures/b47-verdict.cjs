// ETAPA 47 — applier FIABIL (plain node, fără tsx). node scripts/figures/b47-verdict.cjs <verdicts.json>
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key, { auth: { persistSession: false } });
const items = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
(async () => {
  let ok = 0;
  for (const it of items) {
    const status = it.verdict === 'accept' ? 'auto-acceptat' : 'marcat-uman';
    const { data } = await sb.from('figura_autor').select('gates').eq('slug', it.slug).single();
    const gates = (data && data.gates) || {};
    gates.visual_human = { verdict: it.verdict, reason: it.reason || '' };
    const { error } = await sb.from('figura_autor').update({ status, gates, updated_at: new Date().toISOString() }).eq('slug', it.slug);
    if (error) console.error('ERR', it.slug, error.message); else ok++;
  }
  console.log('updated ' + ok + '/' + items.length);
  process.exit(0);
})();
