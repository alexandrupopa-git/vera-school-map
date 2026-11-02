/* Vera's School Map — map, state, layers, hex surface, explore tab. Pin/compare/saved/help live in panel.js */
(function () {
  const D = window.SM_DATA; const C0 = D.config;
  SM.init(D);
  const C = SM.config();
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = SM.fmt;
  const gbp = n => n == null ? '–' : '£' + Math.round(n).toLocaleString('en-GB');
  window.U = { $, $$, esc, fmt, gbp };

  // ------------------------------------------------------------------ state
  const S = window.STATE = {
    tab: 'explore',
    F: SM.defaultFilters(),
    cfg: {},                       // config overrides (comfort, stress, weights…)
    layers: { prim: true, sec: true, rings: 'selected', year: SM.config().latest_year, rules: true, homes: true, zones: true, hex: 'combined', parks: true, stations: false, heathrow: false, thames: false, air: false, airMetric: 'no2' },
    req: { min_prim_high: 0, min_sec_high: 0, rent_max: 0, dest: 'Waterloo', max_min: 0, park_min: 0, hide_heathrow: false },
    pins: [], activePin: null, compare: [], shortlist: [], selSchool: null, nextPinId: 1,
    walkingFactorOn: true
  };
  try { const sl = JSON.parse(localStorage.getItem('sm_shortlist') || '[]'); if (Array.isArray(sl)) S.shortlist = sl; } catch (e) {}
  try { const ps = JSON.parse(localStorage.getItem('sm_pins') || 'null'); if (ps && Array.isArray(ps.pins)) { S.pins = ps.pins; S.nextPinId = ps.next || (S.pins.length + 1); S.activePin = ps.active; } } catch (e) {}

  function applyCfg() { SM.setConfig(Object.assign({}, C0, S.cfg)); }

  // ------------------------------------------------------------------ URL state
  function encodeState() {
    const o = { F: S.F, cfg: S.cfg, L: S.layers, R: S.req, pins: S.pins.map(p => ({ id: p.id, lat: +p.lat.toFixed(5), lon: +p.lon.toFixed(5), label: p.label })), a: S.activePin, cmp: S.compare, tab: S.tab,
      v: [+map.getCenter().lat.toFixed(5), +map.getCenter().lng.toFixed(5), map.getZoom()], sl: S.shortlist.length <= 12 ? S.shortlist : undefined };
    return '#s=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(o)))));
  }
  function decodeState() {
    const m = location.hash.match(/#s=(.+)$/); if (!m) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))); } catch (e) { return null; }
  }
  let urlTimer = null;
  function pushUrl() { clearTimeout(urlTimer); urlTimer = setTimeout(() => { try { history.replaceState(null, '', encodeState()); } catch (e) {} }, 400); }
  window.pushUrl = pushUrl;

  // ------------------------------------------------------------------ map
  const map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([51.46, -0.28], 11);
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  // Base maps. OSM's own tile servers refuse requests with no referrer (a double-clicked file), and CARTO now
  // needs an API key, so the local copy defaults to Esri's keyless World Street Map; the hosted copy to OSM.
  const osmAttr = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const BASES = {
    'OpenStreetMap standard (hosted copy)': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: osmAttr }),
    'Esri World Street Map (works from a local file)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri — Esri, HERE, Garmin, OpenStreetMap contributors' }),
    'Esri World Topo': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri — Esri, HERE, Garmin, OpenStreetMap contributors' })
  };
  const isFile = location.protocol === 'file:';
  let baseName = isFile ? 'Esri World Street Map (works from a local file)' : 'OpenStreetMap standard (hosted copy)';
  try { const saved = localStorage.getItem('sm_base'); if (saved && BASES[saved] && !(isFile && /OpenStreetMap/.test(saved))) baseName = saved; } catch (e) {}
  BASES[baseName].addTo(map);
  L.control.layers(BASES, null, { position: 'bottomleft', collapsed: true }).addTo(map);
  map.on('baselayerchange', e => { try { localStorage.setItem('sm_base', e.name); } catch (x) {} });
  if ('serviceWorker' in navigator && !isFile) { try { navigator.serviceWorker.register('sw.js'); } catch (e) {} }
  window.map = map;
  map.createPane('hexPane'); map.getPane('hexPane').style.zIndex = 350;
  const canvas = L.canvas({ padding: 0.3 });
  const hexCanvas = L.canvas({ padding: 0.3, pane: 'hexPane' });
  const G = {
    hex: L.layerGroup().addTo(map), zones: L.layerGroup().addTo(map), rules: L.layerGroup().addTo(map), heathrow: L.layerGroup(), thames: L.layerGroup(),
    rings: L.layerGroup().addTo(map), parks: L.layerGroup().addTo(map), stations: L.layerGroup(), schools: L.layerGroup().addTo(map), homes: L.layerGroup().addTo(map), pins: L.layerGroup().addTo(map)
  };
  window.G = G;

  // ------------------------------------------------------------------ helpers
  const LEVEL_COLORS = { high: 'var(--high)', medium: 'var(--medium)', low: 'var(--low)', verylow: 'var(--verylow)', test: 'var(--test)', unknown: 'var(--unknown)', faith: 'var(--faith)', far: 'var(--far)' };
  const HEX_COLORS = { high: '#1e8e4e', medium: '#d99a1b', low: '#e0702c', verylow: '#c0392b', test: '#7a3fb0', unknown: '#8a94a0', faith: '#a98bd0', far: '#5f9aa3' };
  window.LEVEL_COLORS = LEVEL_COLORS;
  function schoolColor(s) {
    if (s.phase === 'P') return s.good_now ? '#1f8a5b' : '#9bb3a6';
    return s.strong_now ? '#2d55c9' : (s.above_avg ? '#6f87d6' : '#9aaedd');
  }
  function schoolLabel(s) {
    if (s.phase === 'P') return `${s.phase_detail || 'Primary'} · ${s.ofsted} · KS2 ${s.ks2 != null ? Math.round(s.ks2 * 100) + '%' : 'n/a'}${s.faith_label ? ' · faith' : ''}`;
    return `${s.sel_short} · ${s.gender}${s.is_faith ? ' · ' + s.faith : ''} · A8 ${s.a8 ?? 'n/a'} · ${s.ofsted}`;
  }
  window.schoolLabel = schoolLabel; window.schoolColor = schoolColor;
  function chip(level) { return `<span class="chip ch-${level}">${SM.LEVELS[level]}</span>`; }
  window.chip = chip;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 2600); }
  window.toast = toast;

  // ------------------------------------------------------------------ schools layer
  function drawSchools() {
    G.schools.clearLayers();
    const yearSel = S.layers.year;
    D.schools.forEach(s => {
      if (s.phase === 'P' && !S.layers.prim) return;
      if (s.phase === 'S' && !S.layers.sec) return;
      if (!SM.schoolPasses(s, S.F) && S.F.hide_filtered) return;
      const pan = s.pan || 30; const zs = Math.max(0.8, Math.min(1.8, 1 + (map.getZoom() - 13) * 0.25)); const r = (s.phase === 'P' ? Math.max(4, Math.min(9, 3 + pan / 20)) : Math.max(6, Math.min(12, 4 + pan / 60))) * zs;
      const col = schoolColor(s);
      const dim = !SM.schoolPasses(s, S.F);
      const opts = { renderer: canvas, radius: r, color: s.phase === 'S' && s.sel_short === 'grammar' ? '#d4a017' : (s.faith_decides || s.faith_label || s.is_faith ? '#5d4a7a' : '#ffffff'), weight: s.phase === 'S' && s.sel_short === 'grammar' ? 3 : 1.5, dashArray: (s.faith_decides || s.faith_label || s.is_faith) ? '3,2' : null, fillColor: col, fillOpacity: dim ? 0.25 : 0.9, opacity: dim ? 0.4 : 1 };
      let m;
      if (s.phase === 'S') {
        // square marker via polygon of 4 points (metres->deg approx)
        const dlat = r * 0.0000112 * 1.1, dlon = dlat / Math.cos(s.lat * Math.PI / 180);
        const z = map.getZoom(); const k = Math.pow(2, 13 - z) * zs;
        m = L.rectangle([[s.lat - dlat * k, s.lon - dlon * k], [s.lat + dlat * k, s.lon + dlon * k]], Object.assign({ renderer: canvas }, opts));
      } else m = L.circleMarker([s.lat, s.lon], opts);
      m.bindTooltip(`<b>${esc(s.name)}</b><br>${esc(schoolLabel(s))}`, { className: 'sm-tip', direction: 'top', offset: [0, -6] });
      m.on('click', e => { L.DomEvent.stopPropagation(e); selectSchool(s); });
      m._school = s; G.schools.addLayer(m);
    });
  }
  map.on('zoomend', () => { drawSchools(); });

  // ------------------------------------------------------------------ rings
  function yearStyle(y) { const k = C.latest_year - y; return k <= 0 ? { dash: null, w: 2 } : k === 1 ? { dash: '8,4', w: 1.6 } : k === 2 ? { dash: '4,5', w: 1.4 } : { dash: '2,6', w: 1.2 }; }
  function ringsFor(s, emphasiseYear) {
    const out = [];
    const col = s.phase === 'P' ? '#1f8a5b' : '#2d55c9';
    s.hist.forEach(h => {
      if (!h.year || typeof h.km !== 'number' || h.km > C.max_real_cutoff_km) return;
      const st = yearStyle(h.year);
      const op = emphasiseYear ? (h.year === emphasiseYear ? 0.95 : 0.3) : 0.8;
      const c = L.polygon(SM.circle(s.lat, s.lon, h.km), { renderer: canvas, color: col, weight: st.w, dashArray: st.dash, fill: false, opacity: op, interactive: false });
      c.bindTooltip(`${esc(s.name)} — ${h.year}: ${fmt(h.km)} km${s.walking ? ' (walking route; ring drawn as straight line)' : ''}`, { sticky: true, className: 'sm-tip' });
      out.push(c);
    });
    if (s.mode === 'cutoff' && s.tight) {
      const cf = s.phase === 'P' ? C.comfort_primary : C.comfort_secondary;
      const r = s.tight * cf * (1 - (C.stress_pct || 0) / 100);
      out.push(L.polygon(SM.circle(s.lat, s.lon, r), { renderer: canvas, color: col, weight: 1, fill: true, fillColor: col, fillOpacity: 0.12, opacity: 0.6, interactive: false }));
    } else if (s.mode === 'open') {
      const cap = s.phase === 'S' ? C.sec_open_reach_km : C.walk_cap_london_km;
      out.push(L.polygon(SM.circle(s.lat, s.lon, cap), { renderer: canvas, color: col, weight: 1, dashArray: '1,4', fill: false, opacity: 0.5, interactive: false }));
    }
    return out;
  }
  function drawRings() {
    G.rings.clearLayers();
    if (S.layers.rings === 'selected') { if (S.selSchool) ringsFor(S.selSchool, S.layers.year).forEach(l => G.rings.addLayer(l)); }
    else if (S.layers.rings === 'all') {
      const b = map.getBounds().pad(0.2); const y = S.layers.year;
      D.schools.forEach(s => {
        if (!b.contains([s.lat, s.lon])) return; if ((s.phase === 'P' && !S.layers.prim) || (s.phase === 'S' && !S.layers.sec)) return;
        const h = s.hist.find(h => h.year === y && typeof h.km === 'number' && h.km <= C.max_real_cutoff_km); if (!h) return;
        const col = s.phase === 'P' ? '#1f8a5b' : '#2d55c9';
        const c = L.polygon(SM.circle(s.lat, s.lon, h.km), { renderer: canvas, color: col, weight: 1.2, fill: false, opacity: 0.6, interactive: false });
        G.rings.addLayer(c);
      });
    }
    if (S.selSchool && S.selSchool.rule_def && S.selSchool.rule_def.circle_km) {
      G.rings.addLayer(L.polygon(SM.circle(S.selSchool.lat, S.selSchool.lon, S.selSchool.rule_def.circle_km), { renderer: canvas, color: '#7a3fb0', weight: 2, fill: false, dashArray: '6,4', interactive: false }));
    }
  }
  function selectSchool(s) {
    S.selSchool = s; drawRings();
    window.renderSchoolCard && window.renderSchoolCard(s);
    setTab('pin');
  }
  window.selectSchool = selectSchool;

  // ------------------------------------------------------------------ rule areas, heathrow, thames
  function drawRules() {
    G.rules.clearLayers(); if (!S.layers.rules) return;
    D.areas.forEach(a => {
      if (!a.polygon) return;
      const p = L.polygon(a.polygon, { renderer: canvas, color: '#7a3fb0', weight: 1.5, dashArray: '6,4', fill: true, fillOpacity: 0.03, interactive: true });
      p.bindTooltip(`<b>${esc(a.name)}</b><br>${esc(a.rule)}<br><i>${esc(a.quality)}</i>`, { sticky: true, className: 'sm-tip' });
      G.rules.addLayer(p);
    });
  }
  function drawHeathrow() {
    G.heathrow.clearLayers(); if (!S.layers.heathrow) { map.removeLayer(G.heathrow); return; }
    D.extras.heathrow.corridors.forEach(c => {
      const p = L.polygon(c.poly, { renderer: canvas, color: c.kind === 'approach' ? '#b23a48' : '#c97b2a', weight: 1, fill: true, fillOpacity: 0.10, dashArray: '4,4' });
      p.bindTooltip(`<b>${esc(c.name)}</b><br>Approximate, Claude-drawn. Not a noise contour — check WebTrak and Heathrow's noise maps.`, { sticky: true, className: 'sm-tip' });
      G.heathrow.addLayer(p);
    });
    G.heathrow.addTo(map);
  }
  function drawThames() {
    G.thames.clearLayers(); if (!S.layers.thames) { map.removeLayer(G.thames); return; }
    G.thames.addLayer(L.polyline(SM.THAMES, { color: '#2a7fb5', weight: 3, opacity: 0.6, dashArray: '2,6' }).bindTooltip('Simplified Thames line used to detect river crossings (approximate)', { sticky: true, className: 'sm-tip' }));
    SM.BRIDGES.forEach(b => G.thames.addLayer(L.circleMarker(b.p, { radius: 4, color: '#2a7fb5', fillColor: '#fff', fillOpacity: 1 }).bindTooltip(b.n, { className: 'sm-tip' })));
    G.thames.addTo(map);
  }

  // ------------------------------------------------------------------ homes & zones
  function drawHomes() {
    G.homes.clearLayers(); if (!S.layers.homes) return;
    D.homes.forEach(h => {
      const ranked = !!h.rank;
      const icon = L.divIcon({ className: '', html: `<div class="home-marker ${ranked ? '' : 'minor'}">${ranked ? h.rank : ''}</div>`, iconSize: ranked ? [24, 24] : [10, 10], iconAnchor: ranked ? [12, 12] : [5, 5] });
      const m = L.marker([h.lat, h.lon], { icon, zIndexOffset: ranked ? 500 : 0 });
      m.bindTooltip(`${ranked ? '#' + h.rank + ' ' : ''}${esc(h.name)}${ranked ? '<br>' + esc(h.verdict) : '<br><i>researched spot</i>'}`, { className: 'sm-tip', direction: 'top', offset: [0, -10] });
      m.on('click', e => { L.DomEvent.stopPropagation(e); window.dropPin(h.lat, h.lon, h.name, { home: h }); });
      G.homes.addLayer(m);
    });
  }
  // zone = intersection of the comfort discs of the chosen schools; drawn as a ray-cast polygon from the point
  function zonePolygon(lat, lon, discs) {
    if (!discs.length) return null;
    const pts = [];
    for (let i = 0; i < 90; i++) {
      const brg = i * 4; let lo = 0, hi = 6;
      const ok = km => { const p = SM.dest(lat, lon, brg, km); return !SM.crossesThames(lat, lon, p[0], p[1]) && discs.every(d => SM.haversine(p[0], p[1], d.lat, d.lon) * (d.factor || 1) <= d.r); };
      if (!ok(0)) return null;
      for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
      pts.push(SM.dest(lat, lon, brg, lo));
    }
    return pts;
  }
  window.zonePolygon = zonePolygon;
  // discs for a point: every counting school that is High there (good primary / strong secondary) — plus optional chosen ids
  function zoneDiscs(lat, lon, sc, chosenIds) {
    const discs = [];
    const all = sc.prim.concat(sc.sec);
    all.forEach(r => {
      const s = r.school; const want = chosenIds ? chosenIds.includes(s.id) : (r.level === 'high' && r.counts && ((s.phase === 'P' && s.good_now) || (s.phase === 'S' && s.strong_now)) && SM.schoolPasses(s, S.F) && !s.faith_decides);
      if (!want) return;
      const cf = s.phase === 'P' ? C.comfort_primary : C.comfort_secondary;
      let radius;
      if (s.mode === 'cutoff' && !(s.rule_def && s.rule_def.type !== 'banded')) radius = s.tight * cf * (1 - (C.stress_pct || 0) / 100);
      else if (s.mode === 'open') radius = s.phase === 'S' ? C.sec_open_reach_km : (sc.ctx.london ? C.walk_cap_london_km : C.walk_cap_outside_km);
      else if (s.rule_def && s.rule_def.type === 'herts-nearest' && (s.rule_def.hist_tight || s.tight)) radius = (s.rule_def.hist_tight || s.tight) * cf;
      else if (s.rule_def && s.rule_def.type === 'distance-unpublished') radius = C.unpublished_high_km;
      else return;
      discs.push({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, r: radius, factor: (s.walking && s.mode !== 'open') ? C.walking_factor : 1 });
    });
    return discs;
  }
  window.zoneDiscs = zoneDiscs;
  function drawZones() {
    G.zones.clearLayers(); if (!S.layers.zones) return;
    D.homes.filter(h => h.rank).forEach(h => {
      const sc = SM.score(h.lat, h.lon, S.F);
      const discs = zoneDiscs(h.lat, h.lon, sc);
      const poly = zonePolygon(h.lat, h.lon, discs);
      if (!poly) return;
      const p = L.polygon(poly, { renderer: canvas, color: '#0f6f8c', weight: 2, fill: true, fillColor: '#0f6f8c', fillOpacity: 0.10, interactive: true });
      p.bindTooltip(`<b>Search zone #${h.rank}</b> — ${esc(h.name)}<br>Streets where all ${discs.length} High-rated key schools stay comfortably in reach:<br>${discs.map(d => esc(d.name)).join(', ')}`, { sticky: true, className: 'sm-tip' });
      p.on('click', e => { L.DomEvent.stopPropagation(e); window.dropPin(h.lat, h.lon, h.name, { home: h }); });
      G.zones.addLayer(p);
    });
  }
  window.drawZones = drawZones;

  // ------------------------------------------------------------------ parks & stations
  function drawParks() {
    G.parks.clearLayers(); if (!S.layers.parks || !D.parks) return;
    D.parks.parks.forEach(p => {
      const m = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: '<div class="park-marker"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }) });
      m.bindTooltip(`<b>${esc(p.name)}</b> (${esc(p.area)})<br>Off lead: ${esc(p.off_lead)}${p.notes ? '<br>' + esc(p.notes) : ''}`, { className: 'sm-tip', direction: 'top' });
      G.parks.addLayer(m);
    });
  }
  function drawStations() {
    G.stations.clearLayers(); if (!S.layers.stations || !D.stations.stations.length) { map.removeLayer(G.stations); return; }
    D.stations.stations.forEach(st => {
      const m = L.marker([st.lat, st.lon], { icon: L.divIcon({ className: '', html: '<div class="station-marker"></div>', iconSize: [10, 10], iconAnchor: [5, 5] }) });
      const t = st.times || {}; const parts = Object.keys(t).filter(k => t[k] && t[k].min != null).map(k => `${k} ${t[k].min} min`);
      m.bindTooltip(`<b>${esc(st.name)}</b> · zone ${esc(st.zone)}<br>${esc(st.lines || '')}<br>${parts.join(' · ')}`, { className: 'sm-tip', direction: 'top' });
      G.stations.addLayer(m);
    });
    G.stations.addTo(map);
  }

  // ------------------------------------------------------------------ hex surface
  const REGION_BOXES = (function () {
    // bounding boxes from the researched spots, padded 2.5 km
    const groups = {};
    D.homes.forEach(h => { const k = h.region === 'London' ? (h.lat > 51.5 ? 'NW' : (h.lon > -0.19 ? 'Clapham' : (h.lat < 51.43 && h.lon < -0.26 ? 'Kingston' : (h.lon < -0.23 ? 'Richmond' : 'Wimbledon')))) : h.region; (groups[k] = groups[k] || []).push(h); });
    return Object.values(groups).map(arr => {
      const lats = arr.map(h => h.lat), lons = arr.map(h => h.lon); const dl = 2.5 / 111, dn = 2.5 / (111 * Math.cos(51.45 * Math.PI / 180));
      return [Math.min(...lats) - dl, Math.min(...lons) - dn, Math.max(...lats) + dl, Math.max(...lons) + dn];
    });
  })();
  let hexCache = { key: null, cells: [] };
  function cellPasses(sc, cell) {
    const R = S.req;
    if (R.min_prim_high && sc.n_prim_high < R.min_prim_high) return false;
    if (R.min_sec_high && (R.comp_req ? sc.n_sec_comp_high : sc.n_sec_high) < R.min_sec_high) return false;
    if (R.rent_max) { const rz = window.rentFor && window.rentFor(cell.lat, cell.lon); if (rz && rz.typical && rz.typical > R.rent_max) return false; }
    if (R.max_min) { const cm = window.commuteFor && window.commuteFor(cell.lat, cell.lon, R.dest); if (cm && cm.total != null && cm.total > R.max_min) return false; }
    if (R.park_min) { const pk = window.nearestPark && window.nearestPark(cell.lat, cell.lon); if (!pk || pk.walk_min > R.park_min) return false; }
    if (R.hide_heathrow && window.inHeathrow && window.inHeathrow(cell.lat, cell.lon)) return false;
    return true;
  }
  function drawHex() {
    G.hex.clearLayers(); if (S.layers.hex === 'off') return;
    const z = map.getZoom(); if (z < 10) return;
    const spacing = (z >= 15 ? C.hex_m_fine / 2 : z >= C.hex_zoom_fine ? C.hex_m_fine : C.hex_m_coarse) / 1000; // km
    const b = map.getBounds().pad(0.05);
    const dlat = spacing / 111.32, dlon = spacing / (111.32 * Math.cos(51.45 * Math.PI / 180));
    const cells = [];
    REGION_BOXES.forEach(box => {
      const lat0 = Math.max(box[0], b.getSouth()), lat1 = Math.min(box[2], b.getNorth()), lon0 = Math.max(box[1], b.getWest()), lon1 = Math.min(box[3], b.getEast());
      if (lat0 >= lat1 || lon0 >= lon1) return;
      const rowH = dlat * 0.866; let row = 0;
      for (let lat = Math.floor(lat0 / rowH) * rowH; lat <= lat1; lat += rowH, row++) {
        const off = (Math.round(lat / rowH) % 2) ? dlon / 2 : 0;
        for (let lon = Math.floor(lon0 / dlon) * dlon + off; lon <= lon1; lon += dlon) cells.push({ lat, lon });
      }
    });
    if (cells.length > 6000) { cells.length = 6000; }
    let maxScore = 0.0001;
    cells.forEach(c => {
      const sc = SM.score(c.lat, c.lon, S.F);
      c.sc = sc; c.pass = cellPasses(sc, c);
      c.val = S.layers.hex === 'primary' ? sc.score_p : (S.layers.hex === 'secondary' ? sc.score_s : sc.score);
      if (c.pass && c.val > maxScore) maxScore = c.val;
    });
    const ramp = ['#f3f7ea', '#d5e8c3', '#a9d08e', '#6fb66c', '#2f8f5a', '#13613f'];
    cells.forEach(c => {
      if (c.val <= 0 && !c.pass) return;
      if (c.val <= 0) return;
      const t = Math.min(1, c.val / maxScore); const col = ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
      const r = spacing / 2 * 1.02;
      const pts = []; for (let i = 0; i < 6; i++) pts.push(SM.dest(c.lat, c.lon, i * 60, r / 0.866));
      const p = L.polygon(pts, { renderer: hexCanvas, pane: 'hexPane', stroke: false, fill: true, fillColor: c.pass ? col : '#9a9a9a', fillOpacity: c.pass ? (z >= 15 ? 0.4 : 0.55) : 0.18, interactive: true });
      const sc = c.sc;
      p.bindTooltip(`Score ${c.val.toFixed(1)}${c.pass ? '' : ' — fails a requirement'}<br>Good primaries: ${sc.n_prim_high} High, ${sc.n_prim_med} Medium<br>Strong secondaries: ${sc.n_sec_high} High, ${sc.n_sec_med} Medium${sc.grammar_edge ? '<br>Grammar edge' : ''}<br><i>tap to check this spot</i>`, { className: 'sm-tip', sticky: true });
      G.hex.addLayer(p);
    });
    hexCache = { max: maxScore, n: cells.length, spacing };
    renderLegend();
  }
  let hexTimer = null;
  function scheduleHex() { clearTimeout(hexTimer); hexTimer = setTimeout(drawHex, 120); }
  map.on('moveend', () => { scheduleHex(); if (S.layers.rings === 'all') drawRings(); pushUrl(); });

  // ------------------------------------------------------------------ legend
  function renderLegend() {
    const L_ = $('#legend');
    const hexOn = S.layers.hex !== 'off';
    const wasMin = L_.classList.contains('min');
    L_.innerHTML = `<button class="ltoggle" type="button">${wasMin ? 'Legend ▸' : 'Legend ▾'}</button><div class="lbody">
      <div class="lrow"><span class="sw" style="background:#1f8a5b"></span>Good primary <span class="sw" style="background:#9bb3a6;margin-left:6px"></span>other primary</div>
      <div class="lrow"><span class="sw sq" style="background:#2d55c9"></span>Strong secondary <span class="sw sq" style="background:#9aaedd;margin-left:6px"></span>other</div>
      <div class="lrow"><span class="sw" style="background:#fff;border:3px solid #d4a017"></span>grammar <span class="sw" style="background:#fff;border:2px dashed #5d4a7a;margin-left:6px"></span>faith</div>
      ${hexOn ? `<div class="lrow" style="margin-top:4px">Sweet-spot score (${S.layers.hex}) — darker = more good schools realistically in reach</div><div class="scale"><span style="background:#f3f7ea"></span><span style="background:#d5e8c3"></span><span style="background:#a9d08e"></span><span style="background:#6fb66c"></span><span style="background:#2f8f5a"></span><span style="background:#13613f"></span></div><div class="lrow tiny muted">0 → ${(hexCache.max || 0).toFixed(1)} · grey = fails a requirement · ${hexCache.spacing ? Math.round(hexCache.spacing * 1000) + ' m cells' : ''}</div>` : ''}
      <div class="lrow tiny muted" style="margin-top:4px">Rings: solid ${C.latest_year} · dashed ${C.latest_year - 2}/${C.latest_year - 1} · dotted older · tinted = comfort radius. Straight-line rings; walking-route councils flagged.</div></div>`;
    L_.querySelector('.ltoggle').onclick = () => { L_.classList.toggle('min'); renderLegend(); };
  }
  if (window.innerWidth <= 820) $('#legend').classList.add('min');

  // ------------------------------------------------------------------ pins
  function pinIcon(active) { return L.divIcon({ className: '', html: `<div class="pin-marker ${active ? 'active' : ''}"></div>`, iconSize: [22, 22], iconAnchor: [4, 22] }); }
  function drawPins() {
    G.pins.clearLayers();
    S.pins.forEach(p => {
      const m = L.marker([p.lat, p.lon], { icon: pinIcon(p.id === S.activePin), draggable: true, zIndexOffset: 1000 });
      m.bindTooltip(esc(p.label || 'Pin'), { className: 'sm-tip', direction: 'top', offset: [6, -20] });
      m.on('click', e => { L.DomEvent.stopPropagation(e); S.activePin = p.id; drawPins(); window.renderPin(p); setTab('pin'); });
      m.on('dragend', e => { const ll = e.target.getLatLng(); p.lat = ll.lat; p.lon = ll.lng; p.postcode = null; p.walkDist = null; p.label = p.label && p.label.startsWith('Pin') ? p.label : p.label + ' (moved)'; S.activePin = p.id; window.renderPin(p); drawPins(); savePins(); });
      G.pins.addLayer(m);
    });
    $('#pinBadge').hidden = !S.pins.length; $('#pinBadge').textContent = S.pins.length;
  }
  function savePins() { try { localStorage.setItem('sm_pins', JSON.stringify({ pins: S.pins.map(p => ({ id: p.id, lat: p.lat, lon: p.lon, label: p.label, postcode: p.postcode })), next: S.nextPinId, active: S.activePin })); } catch (e) {} pushUrl(); }
  window.savePins = savePins;
  function dropPin(lat, lon, label, opts) {
    opts = opts || {};
    const p = { id: S.nextPinId++, lat, lon, label: label || `Pin ${S.nextPinId - 1}`, postcode: opts.postcode || null, walkDist: null, home: opts.home || null };
    S.pins.push(p); if (S.pins.length > 8) S.pins.shift();
    S.activePin = p.id; drawPins(); savePins();
    window.renderPin(p); setTab('pin');
    if (opts.pan !== false) map.panTo([lat, lon]);
    return p;
  }
  window.dropPin = dropPin;
  window.removePin = function (id) { S.pins = S.pins.filter(p => p.id !== id); S.compare = S.compare.filter(x => x !== id); if (S.activePin === id) S.activePin = S.pins.length ? S.pins[S.pins.length - 1].id : null; drawPins(); savePins(); window.renderCompare(); const a = S.pins.find(p => p.id === S.activePin); if (a) window.renderPin(a); else $('#tab-pin').innerHTML = '<p class="muted">Tap the map, or search a postcode, to check a spot.</p>'; };
  map.on('click', e => { dropPin(e.latlng.lat, e.latlng.lng, null, { pan: false }); });

  // ------------------------------------------------------------------ tabs
  function setTab(name) {
    S.tab = name;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('.tabpane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
    const panel = $('#panel'); panel.classList.remove('collapsed'); if (name === 'pin' && window.innerWidth <= 820) panel.classList.add('tall'); else panel.classList.remove('tall');
    pushUrl();
  }
  window.setTab = setTab;
  $$('.tab').forEach(t => t.addEventListener('click', () => { if (S.tab === t.dataset.tab && window.innerWidth <= 820) { const p = $('#panel'); p.classList.toggle('tall'); } else setTab(t.dataset.tab); }));
  $('#btnPanel').addEventListener('click', () => { const p = $('#panel'); p.classList.toggle('collapsed'); p.classList.remove('tall'); setTimeout(() => map.invalidateSize(), 250); });

  // ------------------------------------------------------------------ explore tab (layers + filters)
  function renderExplore() {
    const F = S.F, Lr = S.layers, R = S.req, cfg = Object.assign({}, C0, S.cfg);
    const sel = (name, val, opts) => `<select data-k="${name}">${opts.map(o => `<option value="${o[0]}" ${String(val) === String(o[0]) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
    const ck = (k, v, label, title) => `<label class="ctl" ${title ? `title="${esc(title)}"` : ''}><input type="checkbox" data-k="${k}" ${v ? 'checked' : ''}> ${label}</label>`;
    const rng = (k, v, min, max, step, label, fmtv) => `<div class="ctl-block"><div class="lab"><span>${label}</span><span class="num" id="v-${k.replace(/\./g, '-')}">${fmtv(v)}</span></div><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v}"></div>`;
    $('#tab-explore').innerHTML = `
      <div class="card tone-good" style="margin-top:0">
        <div class="row between"><h2>Where should we look?</h2><span class="small muted">${D.schools.length} schools · ${D.homes.length} spots · data to ${D.meta.latest_year} entry</span></div>
        <p class="small" style="margin:6px 0 0">The green surface scores every point on how many <b>good primaries</b> and <b>strong secondaries</b> Vera would realistically get into from there. Tap any spot for the full answer. Numbered pins are the workbook's ranked spots; outlined shapes are their search zones.</p>
      </div>
      <details class="sec" open><summary>Sweet-spot surface</summary>
        <div class="row" style="margin:6px 0">${sel('L.hex', Lr.hex, [['combined', 'Combined'], ['primary', 'Primary only'], ['secondary', 'Secondary only'], ['off', 'Off']])}
        </div>
        <div class="grid2">
          ${rng('cfg.w_prim_high', cfg.w_prim_high, 0, 5, 0.5, 'Good primary, High', v => v)}
          ${rng('cfg.w_prim_med', cfg.w_prim_med, 0, 5, 0.5, 'Good primary, Medium', v => v)}
          ${rng('cfg.w_sec_high', cfg.w_sec_high, 0, 6, 0.5, 'Strong secondary, High', v => v)}
          ${rng('cfg.w_sec_med', cfg.w_sec_med, 0, 6, 0.5, 'Strong secondary, Medium', v => v)}
          ${rng('cfg.w_grammar', cfg.w_grammar, 0, 3, 0.5, 'Grammar edge (bonus)', v => v)}
        </div>
        <h4 style="margin-top:8px">Requirements (grey out what fails)</h4>
        <div class="reqs">
          <label class="ctl">Good primaries High ≥ ${sel('R.min_prim_high', R.min_prim_high, [[0, 'any'], [1, '1'], [2, '2'], [3, '3']])}</label>
          <label class="ctl">Strong secondaries High ≥ ${sel('R.min_sec_high', R.min_sec_high, [[0, 'any'], [1, '1'], [2, '2']])}</label>
          ${ck('R.comp_req', R.comp_req, 'count comprehensives only for that', 'Grammar/partially selective do not satisfy the secondary requirement')}
          <label class="ctl">Rent ≤ ${sel('R.rent_max', R.rent_max, [[0, 'any'], [2500, '£2,500'], [3000, '£3,000'], [2250, '£2,250'], [2750, '£2,750']])}</label>
          <label class="ctl"><span>Peak door-to-door to ${sel('R.dest', R.dest, C.destinations.map(d => [d, d]))}</span> ${sel('R.max_min', R.max_min, [[0, 'any'], [30, '≤ 30 min'], [40, '≤ 40 min'], [50, '≤ 50 min'], [60, '≤ 60 min']])}</label>
          <label class="ctl">Off-lead park within ${sel('R.park_min', R.park_min, [[0, 'any'], [5, '5 min walk'], [10, '10 min'], [15, '15 min']])}</label>
          ${ck('R.hide_heathrow', R.hide_heathrow, 'hide Heathrow approach corridors (approx.)')}
        </div>
      </details>
      <details class="sec" open><summary>School filters (AND)</summary>
        <div class="grid2" style="margin-top:6px">
          ${ck('F.girls', F.girls, "girls' schools count")}
          ${ck('F.faith_schools', F.faith_schools, 'show faith schools', 'Faith schools whose places are decided by faith never count; this hides them entirely')}
          ${ck('F.comp_only', F.comp_only, 'comprehensives only (secondary)')}
          ${ck('F.grammar_bonus', F.grammar_bonus, 'grammar route as bonus')}
          <label class="ctl">Ofsted ${sel('F.min_ofsted', F.min_ofsted, [['any', 'any'], ['good', 'Good+'], ['outstanding', 'Outstanding']])}</label>
          ${ck('F.hide_filtered', F.hide_filtered, 'hide filtered-out schools on map')}
        </div>
        ${rng('F.min_ks2', F.min_ks2, 0, 95, 1, 'Min KS2 RWM % (primary)', v => v ? v + '%' : 'any')}
        ${rng('F.min_a8', F.min_a8, 0, 80, 1, 'Min Attainment 8 (secondary)', v => v ? v : 'any')}
      </details>
      <details class="sec"><summary>Chance rules & stress test</summary>
        ${rng('cfg.comfort_primary', cfg.comfort_primary, 0.5, 1, 0.05, 'Primary comfort factor (High = inside this × tightest cut-off)', v => Math.round(v * 100) + '%')}
        ${rng('cfg.comfort_secondary', cfg.comfort_secondary, 0.5, 1, 0.05, 'Secondary comfort factor', v => Math.round(v * 100) + '%')}
        ${rng('cfg.stress_pct', cfg.stress_pct, 0, 40, 5, 'Stress test: shrink every cut-off by', v => '−' + v + '%')}
        ${rng('cfg.ks2_bar', cfg.ks2_bar, 0.5, 0.9, 0.005, 'Good primary: KS2 RWM at least', v => (v * 100).toFixed(1) + '%')}
        ${rng('cfg.a8_bar_offset', cfg.a8_bar_offset, 0, 20, 1, 'Strong secondary: A8 at least England (46.2) +', v => '+' + v)}
        ${rng('cfg.walking_factor', cfg.walking_factor, 1, 1.6, 0.05, 'Walking-route councils: straight line ×', v => '×' + v)}
        <p class="tiny muted">Richmond and Hounslow measure the walking route. The map estimates it as straight line × factor, routed via the nearest bridge where the line crosses the Thames; a dropped pin fetches a live route when online. The workbooks used the straight line with a warning, so a few ratings there differ by one step — the pin panel shows both.</p>
        <button class="btn btn-sm" id="btnResetCfg">Reset rules to workbook defaults</button>
      </details>
      <details class="sec"><summary>Layers</summary>
        <div class="grid2" style="margin-top:6px">
          ${ck('L.prim', Lr.prim, 'primary schools')} ${ck('L.sec', Lr.sec, 'secondary schools')}
          ${ck('L.homes', Lr.homes, 'researched spots')} ${ck('L.zones', Lr.zones, 'search zones (ranked spots)')}
          ${ck('L.rules', Lr.rules, 'rule circles (Nonsuch, Wallington, WLFS)')} ${ck('L.parks', Lr.parks, 'off-lead parks')}
          ${ck('L.stations', Lr.stations, 'stations')} ${ck('L.heathrow', Lr.heathrow, 'Heathrow corridors (approx.)')}
          ${ck('L.thames', Lr.thames, 'Thames line & bridges used for routing')}
          ${ck('L.air', Lr.air, 'air quality (CAMS model, live, 7-day mean)')} <label class="ctl">${sel('L.airMetric', Lr.airMetric || 'no2', [['no2', 'NO₂'], ['pm2_5', 'PM2.5']])}</label>
        </div>
        <div class="ctl-block"><div class="lab"><span>Admission rings</span></div>${sel('L.rings', Lr.rings, [['selected', 'for the selected school (all years)'], ['all', 'all schools in view, one year'], ['none', 'none']])}</div>
        ${rng('L.year', Lr.year, C.latest_year - 3, C.latest_year, 1, 'Ring year (slider)', v => v)}
      </details>
      <details class="sec"><summary>The ranking, as a table</summary><div class="tblwrap" style="margin-top:6px">${rankingTable()}</div></details>
      <details class="sec"><summary>Data notes & flags</summary>
        <ul class="small">${D.meta.issues.map(i => `<li>${esc(i)}</li>`).join('')}
          <li>Richmond primary offer-day tables for 2024 and 2025 are missing; rings and trends show the gap.</li>
          <li>Kingston Academy: no 2026 figure; measuring point moved to the Richmond Road boundary from 2026.</li>
          <li>Herts does not publish Sandringham's last distance; its rating is marked "(likely)".</li>
          <li>Data compiled ${esc(D.meta.compiled)}, built ${esc(D.meta.built || '')}; cut-off window ${D.meta.latest_year - (D.meta.window_years || 3) + 1}–${D.meta.latest_year}. Rents are asking/average rents at the compile date; 2028 figures are projections.</li>
          ${(D.meta.changelog || []).map(c => `<li class="muted">${esc(c)}</li>`).join('')}
        </ul>
      </details>`;
    $('#tab-explore').addEventListener('input', onExploreInput);
    $('#tab-explore').addEventListener('change', onExploreInput);
    $('#btnResetCfg').addEventListener('click', () => { S.cfg = {}; applyCfg(); renderExplore(); refreshAll(); });
    $('#tab-explore').addEventListener('click', e => { const h = e.target.closest('[data-home]'); if (h) { const home = D.homes.find(x => x.name === h.dataset.home); if (home) { map.setView([home.lat, home.lon], 14); dropPin(home.lat, home.lon, home.name, { home }); } } });
  }
  function rankingTable() {
    const rows = D.homes.filter(h => h.rank).sort((a, b) => a.rank - b.rank);
    return `<table class="tbl"><thead><tr><th>#</th><th>Spot</th><th>Good prim. High/Med</th><th>Strong sec. High/Med</th><th>Rent now</th><th>+ travel</th></tr></thead><tbody>${rows.map(h => `<tr><td>${h.rank}</td><td><a href="#" data-home="${esc(h.name)}">${esc(h.name.split(' — ')[1] || h.name)}</a><div class="tiny muted">${esc(h.region)} · ${esc(h.property)}</div></td><td class="num">${h.n_prim_high}/${h.n_prim_med}</td><td class="num">${h.n_sec_high}/${h.n_sec_med}</td><td class="num">${gbp(h.rent)}</td><td class="num">${gbp(h.total)}</td></tr>`).join('')}</tbody></table>
    <p class="tiny muted">Workbook figures (1 Nov 2026). The surface and the pin panel recompute them live under your current filters — compare the counts.</p>`;
  }
  function onExploreInput(e) {
    const el = e.target; const k = el.dataset.k; if (!k) return;
    let v = el.type === 'checkbox' ? el.checked : (el.type === 'range' ? parseFloat(el.value) : (isNaN(parseFloat(el.value)) || /dest|hex|rings|min_ofsted|airMetric/.test(k) ? el.value : parseFloat(el.value)));
    const [grp, key] = k.split('.');
    if (grp === 'F') S.F[key] = v; else if (grp === 'R') S.req[key] = v; else if (grp === 'L') S.layers[key] = v; else if (grp === 'cfg') { S.cfg[key] = v; applyCfg(); }
    const lab = $('#v-' + k.replace(/\./g, '-')); if (lab && el.type === 'range') lab.textContent = el.type === 'range' ? formatRange(key, v) : v;
    if (e.type === 'input' && el.type === 'range' && ['comfort_primary', 'comfort_secondary', 'stress_pct', 'ks2_bar', 'a8_bar_offset', 'walking_factor', 'min_ks2', 'min_a8'].includes(key)) { if (key === 'year') drawRings(); return; } // heavy: wait for change
    refreshAll(grp === 'L' && key !== 'hex' && key !== 'year');
  }
  function formatRange(key, v) {
    if (/comfort/.test(key)) return Math.round(v * 100) + '%'; if (key === 'stress_pct') return '−' + v + '%'; if (key === 'ks2_bar') return (v * 100).toFixed(1) + '%'; if (key === 'a8_bar_offset') return '+' + v; if (key === 'walking_factor') return '×' + v; if (key === 'min_ks2') return v ? v + '%' : 'any'; if (key === 'min_a8') return v ? v : 'any'; return v;
  }
  function refreshAll(layersOnly) {
    drawSchools(); drawRings(); drawRules(); drawHomes(); drawParks(); drawStations(); drawHeathrow(); drawThames(); if (window.drawAirLayer) window.drawAirLayer(S.layers.air, S.layers.airMetric);
    if (!layersOnly) { drawZones(); scheduleHex(); const a = S.pins.find(p => p.id === S.activePin); if (a && S.tab === 'pin' && !S.selSchool) window.renderPin(a); window.renderCompare && window.renderCompare(); }
    else { drawZones(); scheduleHex(); }
    renderLegend(); pushUrl();
  }
  window.refreshAll = refreshAll;

  // ------------------------------------------------------------------ search, locate, share
  // Search: "lat, lon" · full postcode (postcodes.io) · postcode district/sector (postcodes.io outcode centroid)
  // · anything else = street / address / place via Nominatim (OpenStreetMap), limited to the London–Surrey–Herts box
  const resultsBox = document.createElement('div'); resultsBox.id = 'searchResults'; resultsBox.className = 'search-results'; resultsBox.hidden = true; $('#searchForm').appendChild(resultsBox);
  function showResults(items) {
    if (!items.length) { resultsBox.hidden = true; return; }
    resultsBox.innerHTML = items.map((r, i) => `<button type="button" data-i="${i}"><b>${esc(r.title)}</b><span class="muted small"> ${esc(r.sub || '')}</span></button>`).join('') + '<div class="tiny muted" style="padding:4px 8px">Street search: © OpenStreetMap contributors (Nominatim)</div>';
    resultsBox.hidden = false;
    resultsBox.querySelectorAll('button').forEach(b => b.onclick = () => { const r = items[+b.dataset.i]; resultsBox.hidden = true; dropPin(r.lat, r.lon, r.title, { postcode: r.postcode || null }); map.setView([r.lat, r.lon], r.zoom || 16); });
  }
  document.addEventListener('click', e => { if (!e.target.closest('#searchForm')) resultsBox.hidden = true; });
  $('#searchForm').addEventListener('submit', async e => {
    e.preventDefault(); const q = $('#searchBox').value.trim(); if (!q) return;
    const m = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (m) { dropPin(parseFloat(m[1]), parseFloat(m[2]), q); map.setView([parseFloat(m[1]), parseFloat(m[2])], 15); return; }
    const up = q.toUpperCase().trim();
    const fullPc = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(up), outcode = /^[A-Z]{1,2}\d[A-Z\d]?$/.test(up), sector = /^[A-Z]{1,2}\d[A-Z\d]?\s+\d$/.test(up);
    toast('Looking up ' + q + '…');
    if (fullPc) {
      const r = await window.NET.postcode(up.replace(/\s+/g, ''));
      if (r) { dropPin(r.lat, r.lon, r.postcode, { postcode: r }); map.setView([r.lat, r.lon], 16); return; }
      toast('Postcode not found (offline, or not a real postcode). Try a street name instead.'); return;
    }
    if (outcode || sector) {
      const r = await window.NET.outcode(up.split(/\s+/)[0]);
      if (r) { toast(`${up} — centre of the postcode district; move the pin to the street you mean`); dropPin(r.lat, r.lon, up + ' (district centre)'); map.setView([r.lat, r.lon], sector ? 14 : 13); return; }
    }
    const items = await window.NET.geocode(q);
    if (items === null) { toast('Address search needs the internet (Nominatim).'); return; }
    if (!items.length) { toast('Nothing found for "' + q + '" in the London / Surrey / Herts area. Add the town, e.g. "Park Road, Kingston".'); return; }
    if (items.length === 1) { const r = items[0]; dropPin(r.lat, r.lon, r.title); map.setView([r.lat, r.lon], 16); return; }
    showResults(items);
  });
  $('#btnLocate').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Location not available in this browser.');
    toast('Finding you…');
    navigator.geolocation.getCurrentPosition(pos => { dropPin(pos.coords.latitude, pos.coords.longitude, 'My location'); map.setView([pos.coords.latitude, pos.coords.longitude], 15); }, () => toast('Location was refused or unavailable. Open the map over https for GPS.'), { enableHighAccuracy: true, timeout: 10000 });
  });
  $('#btnShare').addEventListener('click', async () => {
    const url = location.origin.startsWith('http') ? location.href.split('#')[0] + encodeState() : encodeState();
    try { await navigator.clipboard.writeText(url); toast('Link copied — it reopens this view, filters and pins.'); }
    catch (e) { prompt('Copy this link:', url); }
  });

  // ------------------------------------------------------------------ boot (after panel.js has loaded)
  function boot() {
  const st = decodeState();
  if (st) {
    try {
      Object.assign(S.F, st.F || {}); S.cfg = st.cfg || {}; Object.assign(S.layers, st.L || {}); Object.assign(S.req, st.R || {});
      if (st.pins && st.pins.length) { S.pins = st.pins.map(p => ({ id: p.id, lat: p.lat, lon: p.lon, label: p.label })); S.nextPinId = Math.max(...S.pins.map(p => p.id)) + 1; S.activePin = st.a; S.compare = st.cmp || []; }
      if (st.sl && !S.shortlist.length) S.shortlist = st.sl;
      if (st.v) map.setView([st.v[0], st.v[1]], st.v[2]);
    } catch (e) {}
  }
  if (!st || !st.v) { const r = D.homes.filter(h => h.rank); map.fitBounds(L.latLngBounds(r.map(h => [h.lat, h.lon])).pad(0.08)); }
  applyCfg();
  renderExplore();
  refreshAll();
  drawPins();
  window.renderSaved && window.renderSaved(); window.renderCompare && window.renderCompare(); window.renderHelp && window.renderHelp();
  if (S.pins.length && S.activePin) { const a = S.pins.find(p => p.id === S.activePin); if (a) window.renderPin(a); }
  else $('#tab-pin').innerHTML = '<p class="muted">Tap the map, or search a postcode, to check a spot.</p>';
  if (st && st.tab) setTab(st.tab);
  setTimeout(() => $('#hint').hidden = true, 9000);
  window.addEventListener('resize', () => map.invalidateSize());
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
