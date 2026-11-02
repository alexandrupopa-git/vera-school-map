/* Chance engine — pure functions, no DOM. Loaded by index.html and by tools/verify.js (node).
   Everything here reads window.SM_DATA (browser) or the object passed to SM.init (node). */
(function (root) {
  const SM = {};
  const R = 6371.0088;
  const toRad = d => d * Math.PI / 180;
  SM.haversine = function (lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  // destination point given bearing (deg) and distance (km)
  SM.dest = function (lat, lon, brg, km) {
    const d = km / R, b = toRad(brg), la1 = toRad(lat), lo1 = toRad(lon);
    const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
    const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
    return [la2 * 180 / Math.PI, lo2 * 180 / Math.PI];
  };
  SM.circle = function (lat, lon, km, n) {
    n = n || 72; const pts = [];
    for (let i = 0; i < n; i++) pts.push(SM.dest(lat, lon, i * 360 / n, km));
    return pts;
  };

  let D = null, C = null;
  function applyMeta(c, data) {
    // the data files are the record: latest year and England averages come from data/meta.js when present
    if (data.meta) {
      if (data.meta.latest_year) c.latest_year = Math.max(c.latest_year || 0, data.meta.latest_year);
      if (data.meta.england) { if (data.meta.england.a8 != null) c.england_a8 = data.meta.england.a8; if (data.meta.england.g5 != null) c.england_g5 = data.meta.england.g5; if (data.meta.england.p8 != null) c.england_p8 = data.meta.england.p8; }
    }
    return c;
  }
  SM.init = function (data) {
    D = data; C = applyMeta(Object.assign({}, data.config), data);
    D.schools.forEach(s => { s.rule_def = D.rules[s.id] || null; });
    D.byId = {}; D.schools.forEach(s => D.byId[s.id] = s);
    SM.recomputeQuality();
    return SM;
  };
  SM.config = function () { return C; };
  SM.setConfig = function (patch) { Object.assign(C, patch); applyMeta(C, D); SM.recomputeQuality(); };
  SM.data = function () { return D; };

  // quality flags under the current bars (so the thresholds are adjustable, as asked)
  SM.recomputeQuality = function () {
    D.schools.forEach(s => {
      if (s.phase === 'P') {
        const ofOK = s.ofsted === 'Good' || s.ofsted === 'Outstanding' || s.ofsted === 'Ungraded';
        s.good_now = ofOK && s.ks2 != null && s.ks2 >= C.ks2_bar;
        s.good_note = s.ks2 == null ? 'no KS2 data' : '';
      } else {
        const weak = s.ofsted === 'Requires improvement' || s.ofsted === 'Inadequate';
        s.strong_now = s.a8 != null && s.a8 >= C.england_a8 + C.a8_bar_offset && !weak;
        s.above_avg = s.a8 != null && s.a8 > C.england_a8 && !s.strong_now;
      }
    });
  };

  const LEVELS = { high: 'High', medium: 'Medium', low: 'Low', verylow: 'Very low', test: 'Test-dependent', unknown: 'Unknown', faith: 'Faith decides', far: 'Likely but far' };
  SM.LEVELS = LEVELS;
  const ORDER = { high: 0, medium: 1, low: 2, verylow: 3, test: 4, far: 5, unknown: 6, faith: 7 };
  SM.ORDER = ORDER;

  function fmt(km) { return km == null ? '–' : (Math.round(km * 100) / 100).toFixed(2); }
  SM.fmt = fmt;

  function trendText(s) {
    const pts = s.hist.filter(h => h.year && h.year >= C.latest_year - C.recent_window_years && typeof h.km === 'number' && h.km <= C.max_real_cutoff_km);
    if (pts.length < 2) return pts.length === 1 ? `only ${pts[0].year} published` : '';
    const first = pts[0].km, last = pts[pts.length - 1].km;
    if (last < first * 0.95) return 'tightening';
    if (last > first * 1.05) return 'widening';
    return 'steady';
  }
  SM.years = function () { const L = C.latest_year; return [L - 3, L - 2, L - 1, L]; };
  SM.histLine = function (s) {
    // "2023 1.30 · 2024 — · 2025 1.20 · 2026 1.11"
    const years = SM.years();
    return years.map(y => {
      const h = s.hist.find(h => h.year === y);
      if (!h) return `${y}: no data`;
      if (typeof h.km === 'number') return `${y}: ${fmt(h.km)} km`;
      if (s.phase === 'P') return `${y}: ${h.status === 'No data' ? 'no data' : (h.status || 'no distance').replace('Not oversubscribed – all applicants offered', 'all offered').replace('Spare places', 'spare places').replace('Oversubscribed – no distance published', 'full, no distance')}`;
      return `${y}: ${h.crit ? 'rule: ' + h.crit.slice(0, 28) : (h.oversub === 'yes' ? 'full, no distance' : 'no data')}`;
    }).join(' · ');
  };

  function applyStress(km) { return km == null ? null : km * (1 - (C.stress_pct || 0) / 100); }

  // distance rating against tight/wide cut-offs
  function rateDistance(d, tight, wide, cf) {
    tight = applyStress(tight); wide = applyStress(wide);
    const hi = cf * tight;
    let level, next, margin;
    if (d <= hi) { level = 'high'; next = hi; }
    else if (d <= tight) { level = 'medium'; next = tight; }
    else if (d <= wide) { level = 'low'; next = wide; }
    else { level = 'verylow'; next = wide; }
    margin = (next - d) / next; // + inside, - outside
    const borderline = Math.abs(margin) < 0.08;
    return { level, borderline, hi, tight, wide };
  }

  // ---- context for a point: nearest Herts schools etc. (computed once per point) ----
  SM.pointContext = function (lat, lon, opts) {
    opts = opts || {};
    const ctx = { lat, lon, walkDist: opts.walkDist || {}, postcode: opts.postcode || null, useWalkingFactor: opts.useWalkingFactor !== false };
    // nearest Herts co-ed / girls-eligible secondary (nearest-school rules)
    const herts = D.schools.filter(s => s.phase === 'S' && s.la === 'Hertfordshire' && !s.is_faith && s.sel_short !== 'partially selective');
    let bestCo = null, bestG = null;
    herts.forEach(s => {
      const d = SM.haversine(lat, lon, s.lat, s.lon);
      if (!s.girls && (!bestCo || d < bestCo.d)) bestCo = { s, d };
      if ((!bestG || d < bestG.d)) bestG = { s, d };   // schools admitting girls = all (co-ed + girls)
    });
    ctx.nearestHertsCoed = bestCo; ctx.nearestHertsGirlsEligible = bestG;
    // nearest Herts primary (Rule 5)
    let bp = null;
    D.schools.filter(s => s.phase === 'P' && s.la === 'Hertfordshire').forEach(s => {
      const d = SM.haversine(lat, lon, s.lat, s.lon); if (!bp || d < bp.d) bp = { s, d };
    });
    ctx.nearestHertsPrimary = bp;
    // St Albans PA7 approximation: within 6 km of the city centre (51.7527, -0.3394)
    ctx.inStAlbansArea = SM.haversine(lat, lon, 51.7527, -0.3394) <= 6;
    ctx.london = !(SM.haversine(lat, lon, 51.7527, -0.3394) < 12 || SM.haversine(lat, lon, 51.3350, -0.2680) < 7); // not St Albans, not Epsom
    return ctx;
  };

  // effective distance: walking factor / live walking distance for walking-route councils
  // Simplified Thames centreline (Hampton Court to Battersea) and its crossings, for detecting when a
  // walking route must use a bridge. Approximate coordinates from public maps; only used to flag crossings.
  SM.THAMES = [[51.4035,-0.3435],[51.3985,-0.3330],[51.4040,-0.3150],[51.4120,-0.3090],[51.4180,-0.3050],[51.4297,-0.3195],[51.4380,-0.3230],[51.4460,-0.3270],[51.4490,-0.3180],[51.4540,-0.3120],[51.4580,-0.3082],[51.4622,-0.3148],[51.4635,-0.3178],[51.4690,-0.3230],[51.4770,-0.3120],[51.4875,-0.2875],[51.4800,-0.2740],[51.4718,-0.2676],[51.4728,-0.2535],[51.4830,-0.2430],[51.4877,-0.2297],[51.4790,-0.2170],[51.4669,-0.2110],[51.4648,-0.1877],[51.4790,-0.1720]];
  SM.BRIDGES = [{n:'Hampton Court Bridge',p:[51.4035,-0.3435]},{n:'Kingston Bridge',p:[51.4120,-0.3090]},{n:'Teddington Lock footbridge',p:[51.4297,-0.3195]},{n:'Richmond Bridge',p:[51.4580,-0.3082]},{n:'Twickenham Bridge',p:[51.4622,-0.3148]},{n:'Richmond Lock footbridge',p:[51.4635,-0.3178]},{n:'Kew Bridge',p:[51.4875,-0.2875]},{n:'Chiswick Bridge',p:[51.4718,-0.2676]},{n:'Barnes Bridge',p:[51.4728,-0.2535]},{n:'Hammersmith Bridge',p:[51.4877,-0.2297]},{n:'Putney Bridge',p:[51.4669,-0.2110]},{n:'Wandsworth Bridge',p:[51.4648,-0.1877]}];
  function segIntersect(a, b, c, d) {
    const ccw = (p, q, r) => (r[1] - p[1]) * (q[0] - p[0]) > (q[1] - p[1]) * (r[0] - p[0]);
    return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
  }
  SM.crossesThames = function (lat1, lon1, lat2, lon2) {
    const a = [lat1, lon1], b = [lat2, lon2]; let n = 0;
    for (let i = 0; i < SM.THAMES.length - 1; i++) if (segIntersect(a, b, SM.THAMES[i], SM.THAMES[i + 1])) n++;
    return n % 2 === 1;
  };
  function effDistance(s, ctx, d) {
    if (!s.walking) return { d, note: '', method: 'straight' };
    if (ctx.walkDist && ctx.walkDist[s.id] != null) return { d: ctx.walkDist[s.id], note: `walking route ${fmt(ctx.walkDist[s.id])} km (live route) vs ${fmt(d)} km straight`, method: 'route' };
    if (ctx.useWalkingFactor === false) return { d, note: `council measures the walking route — the straight line understates it`, method: 'straight' };
    let base = d, via = '';
    if (SM.crossesThames(ctx.lat, ctx.lon, s.lat, s.lon)) {
      let best = null;
      SM.BRIDGES.forEach(b => { const t = SM.haversine(ctx.lat, ctx.lon, b.p[0], b.p[1]) + SM.haversine(b.p[0], b.p[1], s.lat, s.lon); if (!best || t < best.t) best = { t, b }; });
      if (best && best.t > d) { base = best.t; via = ` via ${best.b.n} (river crossing)`; }
    }
    const w = base * C.walking_factor;
    return { d: w, note: `council measures the walking route: ${fmt(d)} km straight ≈ ${fmt(w)} km on foot (×${C.walking_factor}${via})`, method: via ? 'bridge' : 'factor' };
  }

  SM.tiffinArea = function (ctx) {
    const pc = ctx.postcode; const T = D.tiffin;
    if (!pc) return 'unknown';
    if (pc.ward && T.inner_wards.some(w => w.toLowerCase() === (pc.ward || '').toLowerCase())) return 'inner';
    if (pc.outcode && T.designated_districts.includes(pc.outcode)) return 'designated';
    return T.designated_complete ? 'outside' : 'outside?';
  };

  // ---------------- main rating ----------------
  SM.rate = function (s, ctx) {
    const dStraight = SM.haversine(ctx.lat, ctx.lon, s.lat, s.lon);
    const eff = effDistance(s, ctx, dStraight);
    const d = eff.d;
    const r = { school: s, d: dStraight, d_eff: d, dist_note: eff.note, method: eff.method, level: 'unknown', reason: '', check: '', borderline: false, counts: false, badges: [] };
    const cf = s.phase === 'P' ? C.comfort_primary : C.comfort_secondary;
    const rule = s.rule_def;
    const trend = trendText(s);
    const hiRange = (t, w) => (t === w || w == null) ? `${fmt(t)} km` : `${fmt(t)}–${fmt(w)} km`;

    // ---- faith-decided schools ----
    if (s.faith_decides && !(rule && rule.type !== 'faith')) {
      r.level = 'faith'; r.reason = (rule && rule.text) || `Faith criteria decided places in a full year — places go to practising ${s.phase === 'S' ? s.faith : 'church'} families first. ${fmt(d)} km away.`;
      r.counts = false; return r;
    }
    if (rule) {
      switch (rule.type) {
        case 'test': {
          r.level = 'test'; r.badges.push('grammar');
          if (rule.circle_km) { r.inside = d <= rule.circle_km; r.reason = (r.inside ? rule.inside : rule.outside) + ` (${fmt(dStraight)} km from the school)`; r.grammar_edge = r.inside; }
          else if (rule.area === 'tiffin') {
            const a = SM.tiffinArea(ctx); r.tiffin = a;
            if (a === 'inner') { r.reason = rule.inner; r.grammar_edge = true; }
            else if (a === 'designated') { r.reason = rule.designated; r.grammar_edge = false; }
            else if (a === 'outside') { r.level = 'verylow'; r.reason = rule.outside; }
            else if (a === 'outside?') { r.reason = `Probably outside the Designated Area (district ${ctx.postcode.outcode} is not in the list held here, which is incomplete) — then Very low: every 2024–26 place went to Designated/Inner Area residents.`; }
            else r.reason = rule.unknown;
            r.reason += ` ${fmt(dStraight)} km from the school.`; r.check = rule.check;
          }
          return r;
        }
        case 'test-partial': r.level = 'test'; r.badges.push('partially selective'); r.reason = rule.text + ` ${fmt(dStraight)} km away.`; return r;
        case 'herts-nearest': {
          const near = ctx.nearestHertsCoed; const isNearest = near && near.s.id === s.id;
          r.herts_nearest = isNearest;
          if (isNearest) {
            if (rule.if_nearest === 'high') { r.level = 'high'; r.reason = `High — ${rule.nearest_note}`; }
            else {
              const t = rule.hist_tight || s.tight, w = rule.hist_wide || s.wide;
              const x = rateDistance(d, t, w, cf); r.level = x.level; r.borderline = x.borderline;
              r.reason = `${LEVELS[x.level]} — your nearest co-ed school; ${fmt(d)} km vs ${hiRange(t, w)} for nearest-school applicants. ${rule.nearest_note}`;
            }
          } else {
            if (rule.not_nearest_mode === 'cutoff') {
              const x = rateDistance(d, rule.hist_tight, rule.hist_wide, cf); r.level = x.level; r.borderline = x.borderline;
              r.reason = `${LEVELS[x.level]} — not your nearest school (that is ${near.s.name}, ${fmt(near.d)} km); ${fmt(d)} km vs ${hiRange(rule.hist_tight, rule.hist_wide)} reached for 'not nearest' applicants. ${rule.not_nearest}`;
            } else { r.level = rule.not_nearest.startsWith('Low') ? 'low' : 'verylow'; r.reason = rule.not_nearest + ` Your nearest co-ed school here is ${near.s.name} (${fmt(near.d)} km).`; }
          }
          r.check = rule.check; r.counts = ['high', 'medium', 'low'].includes(r.level); return r;
        }
        case 'distance-unpublished': {
          if (d <= C.unpublished_high_km) { r.level = 'high'; r.reason = `High (likely) — ${fmt(d)} km from a distance-only school; Herts doesn't publish the last km, so confirm in the HCC allocation summary.`; }
          else if (d <= C.unpublished_medium_km) { r.level = 'medium'; r.reason = `Medium (likely) — ${fmt(d)} km from a distance-only school; last km not published.`; }
          else { r.level = 'unknown'; r.reason = `Unknown — ${fmt(d)} km from a distance-only school; last distance not published.`; }
          r.likely = true; r.reason += ' ' + rule.note; r.check = rule.check; r.counts = r.level !== 'unknown'; return r;
        }
        case 'stags': {
          const ng = ctx.nearestHertsGirlsEligible; const isNearest = ng && ng.s.id === s.id;
          if (isNearest) { r.level = 'high'; r.reason = rule.nearest; }
          else if (ctx.inStAlbansArea) { r.level = 'medium'; r.lottery = true; r.reason = rule.lottery + ` (Your nearest eligible school here is ${ng.s.name}, ${fmt(ng.d)} km.)`; }
          else { r.level = 'verylow'; r.reason = rule.outside; }
          r.check = rule.check; r.counts = r.level !== 'verylow'; return r;
        }
        case 'priority-unknown': r.level = 'unknown'; r.reason = rule.text + ` ${fmt(d)} km away.`; r.check = rule.check; return r;
        case 'nodal': {
          const dn0 = SM.haversine(ctx.lat, ctx.lon, rule.lat, rule.lon); const dn = s.walking ? dn0 * (ctx.walkDist && ctx.walkDist[s.id + ':nodal'] != null ? 1 : C.walking_factor) : dn0;
          const t = Math.min(...s.recent_pub), w = Math.max(...s.recent_pub);
          const x = rateDistance(dn, t, w, cf); r.level = x.level; r.borderline = x.borderline;
          r.reason = `${LEVELS[x.level]} — ${fmt(dn)} km on foot (est.) from the nodal point vs ${hiRange(t, w)} (2024–26), ${trend}. ${rule.text}`; r.check = rule.check; r.counts = true; r.approx = true; return r;
        }
        case 'ballot': {
          if (dStraight <= rule.radius_km) { r.level = 'medium'; r.lottery = true; r.reason = rule.inside; } else { r.level = 'verylow'; r.reason = rule.outside; }
          r.reason += ` (${fmt(dStraight)} km.)`; r.check = rule.check; r.counts = r.level === 'medium'; return r;
        }
        case 'feeder': {
          let best = null;
          rule.feeders.forEach(fid => { const f = D.byId[fid]; if (!f) return; const fr = SM.rate(f, ctx); if (!best || ORDER[fr.level] < ORDER[best.level]) best = fr; });
          if (best && (best.level === 'high' || best.level === 'medium')) { r.level = best.level; r.via = best.school.name; r.reason = `${rule.with_feeder} Here ${best.school.name} is ${LEVELS[best.level]}.`; r.counts = true; }
          else { r.level = 'low'; r.reason = rule.without + (best ? ` Nearest feeder here: ${best.school.name} (${LEVELS[best.level]}).` : ''); r.counts = false; }
          r.check = rule.check; return r;
        }
        case 'banded': {
          const t = rule.hist_tight || (s.recent_pub.length ? Math.min(...s.recent_pub) : null), w = rule.hist_wide || (s.recent_pub.length ? Math.max(...s.recent_pub) : null);
          if (t != null) {
            const x = rateDistance(d, t, w, cf); r.level = x.level === 'high' ? 'medium' : x.level; r.borderline = x.borderline;
            r.reason = `${LEVELS[r.level]} — ability-banded: you compete only within Vera's band, by distance. ${fmt(d)} km vs ${hiRange(t, w)} reached in the published bands; other bands may have stopped closer. Banded intakes are rated Medium at best (workbook rule).`;
          } else if (d <= C.banded_medium_km) { r.level = 'medium'; r.reason = `Medium — ability-banded: you compete only within Vera's band, by distance; band cut-offs not published. ${fmt(d)} km away (within the ${C.banded_medium_km} km used here for banded schools).`; }
          else if (d <= C.banded_low_km) { r.level = 'low'; r.reason = `Low — ability-banded, distance within band; ${fmt(d)} km is further than banded intakes usually reach (band cut-offs not published).`; }
          else { r.level = 'verylow'; r.reason = `Very low — ${fmt(d)} km from an ability-banded school.`; }
          if (rule.text) r.reason += ' ' + rule.text; r.judgement = true; r.counts = r.level !== 'verylow'; return r;
        }
        case 'faith': r.level = 'faith'; r.reason = rule.text; return r;
        case 'unknown': r.level = 'unknown'; r.reason = rule.text + ` ${fmt(d)} km away.`; return r;
      }
    }
    // ---- generic engine ----
    if (s.mode === 'cutoff') {
      const x = rateDistance(d, s.tight, s.wide, cf); r.level = x.level; r.borderline = x.borderline;
      const yrs = s.hist.filter(h => h.year && h.year >= C.latest_year - C.recent_window_years && typeof h.km === 'number' && h.km <= C.max_real_cutoff_km).map(h => h.year);
      const yr = yrs.length ? (yrs.length > 1 ? `${Math.min(...yrs)}–${String(Math.max(...yrs)).slice(2)}` : `${yrs[0]}`) : '';
      r.reason = `${fmt(d)} km vs ${hiRange(x.tight, x.wide)} cut-off${yr ? ' (' + yr + ')' : ''}${trend ? ', ' + trend : ''}${C.stress_pct ? ` — stress-tested −${C.stress_pct}%` : ''}.`;
      if (x.level === 'high') r.reason = `${fmt(d)} km is inside ${Math.round(cf * 100)}% of the tightest cut-off: ` + r.reason;
      if (s.phase === 'S' && s.sel_short === 'partially selective') { r.badges.push('partially selective'); r.reason += ' Rating is for the non-test places; a share of places goes by test from a wide area.'; }
      r.counts = true;
    } else if (s.mode === 'open') {
      const cap = s.phase === 'S' ? C.sec_open_reach_km : (ctx.london ? C.walk_cap_london_km : C.walk_cap_outside_km);
      // the reach cap is a straight-line heuristic in the workbooks, so it uses dStraight
      if (dStraight <= cap) { r.level = 'high'; r.reason = `High — every applicant was offered a place in recent years; ${fmt(dStraight)} km away (within the ${cap} km reach used for such schools).`; r.counts = true; r.open = true; }
      else { r.level = 'far'; r.reason = `Every applicant was offered a place recently, but ${fmt(dStraight)} km is beyond the ${cap} km reach the workbooks count for such schools.`; r.counts = false; r.open = true; }
    } else {
      r.level = 'unknown'; r.reason = `Unknown — no usable recent allocation data. ${fmt(d)} km away.`;
    }
    // Herts Rule 5 (nearest school) note for primaries
    if (s.phase === 'P' && s.herts_nearest && ctx.nearestHertsPrimary) {
      const isN = ctx.nearestHertsPrimary.s.id === s.id;
      const last = s.hist.filter(h => h.year === C.latest_year)[0];
      if (!isN && last && last.crit === 5 && r.level !== 'verylow') {
        r.level = 'verylow'; r.counts = false;
        r.reason += ` Herts Rule 5: in ${C.latest_year} the school filled under 'nearest school', and from here your nearest school is ${ctx.nearestHertsPrimary.s.name} — so distance alone would not have got a place.`;
        r.herts_trap = true;
      } else r.reason += isN ? ' This is your nearest Herts primary (Rule 5 priority).' : ` Not your nearest Herts primary (that is ${ctx.nearestHertsPrimary.s.name}).`;
    }
    if (s.priority_area) r.check = `Confirm the address is inside ${s.name.replace(/ (Primary|Infant|Junior).*$/, '')}'s priority area / catchment (official map linked in sources).`;
    if (s.borderline === undefined && r.borderline) r.reason += ' Borderline: within 8% of the next threshold.';
    return r;
  };

  // ---- filters applied to counting ----
  SM.defaultFilters = function () {
    return { girls: true, faith_schools: true, comp_only: false, min_ofsted: 'any', min_ks2: 0, min_a8: 0, min_chance: 'low', grammar_bonus: true };
  };
  SM.schoolPasses = function (s, F) {
    if (s.phase === 'S') {
      if (s.girls && !(F.girls && C.count_girls_schools)) return false;
      if (s.is_faith && !F.faith_schools) return false;
      if (F.comp_only && s.sel_short !== 'comprehensive' && !s.sel_short.startsWith('comprehensive')) return false;
      if (F.min_a8 && (s.a8 == null || s.a8 < F.min_a8)) return false;
    } else {
      if (F.min_ks2 && (s.ks2 == null || s.ks2 * 100 < F.min_ks2)) return false;
      if (s.faith_label && !F.faith_schools) return false;
    }
    if (F.min_ofsted === 'outstanding' && s.ofsted !== 'Outstanding') return false;
    if (F.min_ofsted === 'good' && !(s.ofsted === 'Good' || s.ofsted === 'Outstanding')) return false;
    return true;
  };

  // ---- score a point: counts + weighted score ----
  SM.score = function (lat, lon, F, opts) {
    const ctx = SM.pointContext(lat, lon, opts);
    const out = { prim: [], sec: [], n_prim_high: 0, n_prim_med: 0, n_sec_high: 0, n_sec_med: 0, n_sec_comp_high: 0, grammar_edge: false, score_p: 0, score_s: 0 };
    const maxP = 3.2, maxS = 7.5; // bounding boxes to skip far schools
    for (const s of D.schools) {
      const dd = SM.haversine(lat, lon, s.lat, s.lon);
      if (s.phase === 'P' ? dd > maxP : dd > maxS) continue;
      const r = SM.rate(s, ctx);
      if (s.phase === 'P') {
        out.prim.push(r);
        if (s.good_now && r.counts && SM.schoolPasses(s, F) && (C.count_faith || !s.faith_decides)) {
          if (r.level === 'high') { out.n_prim_high++; out.score_p += C.w_prim_high; }
          else if (r.level === 'medium') { out.n_prim_med++; out.score_p += C.w_prim_med; }
        }
      } else {
        out.sec.push(r);
        if (r.level === 'test' && r.grammar_edge && F.grammar_bonus) { out.grammar_edge = true; }
        if (s.strong_now && r.counts && SM.schoolPasses(s, F) && (C.count_faith || !s.faith_decides) && (C.count_partially_selective || s.sel_short !== 'partially selective')) {
          if (r.level === 'high') { out.n_sec_high++; out.score_s += C.w_sec_high; if (s.sel_short.startsWith('comprehensive')) out.n_sec_comp_high++; }
          else if (r.level === 'medium') { out.n_sec_med++; out.score_s += C.w_sec_med; }
        }
      }
    }
    if (out.grammar_edge) out.score_s += C.w_grammar;
    out.score = out.score_p + out.score_s;
    out.ctx = ctx;
    return out;
  };

  if (typeof module !== 'undefined') module.exports = SM; else root.SM = SM;
})(typeof window !== 'undefined' ? window : globalThis);
