// node tools/verify.js — compares the engine's ratings with chance_of_place.csv (workbook ratings)
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const window = { SM_DATA: {} };
for (const f of ['config.js', 'rules.js', 'schools.js', 'homes.js', 'chance_ref.js', 'areas.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'), { window });
}
const SM = require(path.join(ROOT, 'engine.js'));
SM.init(window.SM_DATA);
const D = window.SM_DATA;
const norm = s => s.replace(/\s+/g, ' ').replace(/[’']/g, "'").toLowerCase().trim();
const byName = {}; D.schools.forEach(s => byName[norm(s.name)] = s);
function findSchool(name) {
  const n = norm(name); if (byName[n]) return byName[n];
  const cands = D.schools.filter(s => norm(s.name).startsWith(n.slice(0, 18)) || n.startsWith(norm(s.name).slice(0, 18)));
  return cands[0];
}
function refLevel(ch) {
  const c = ch.toLowerCase();
  if (c.startsWith('high')) return 'high';
  if (c.startsWith('medium')) return 'medium';
  if (c.startsWith('low')) return 'low';
  if (c.startsWith('very low')) return 'verylow';
  if (c.startsWith('test')) return 'test';
  if (c.startsWith('unknown')) return 'unknown';
  return c;
}
const only = process.argv[2];
let total = 0, match = 0; const mism = [];
const homes = D.homes.filter(h => h.rank && (!only || String(h.rank) === only));
for (const h of homes) {
  const rows = D.chance_ref.filter(r => r.home === h.name);
  const ctx = SM.pointContext(h.lat, h.lon, { postcode: guessPostcode(h) });
  for (const r of rows) {
    const s = findSchool(r.school);
    if (!s) { mism.push(`${h.rank} ${r.school}: school not found`); continue; }
    const x = SM.rate(s, ctx); total++;
    const exp = refLevel(r.chance);
    if (x.level === exp) match++;
    else mism.push(`#${h.rank} ${r.phase[0]} ${s.name.slice(0, 32).padEnd(32)} expected ${exp.padEnd(8)} got ${x.level.padEnd(8)} d=${SM.fmt(x.d)}${x.method !== 'straight' ? '→' + SM.fmt(x.d_eff) : ''} ref d=${r.d} | ${x.reason.slice(0, 110)}`);
  }
}
function guessPostcode(h) {
  // for verification only: derive outcode/ward from the spot name
  const m = h.name.match(/\(([A-Z]{1,2}\d{1,2})[ \d\/A-Z]*\)/); const outcode = m ? m[1] : null;
  const ward = /Canbury/.test(h.name) ? 'Canbury Gardens' : null;
  return outcode ? { outcode, ward } : null;
}
console.log(`matched ${match}/${total}`);
mism.forEach(m => console.log(m));
