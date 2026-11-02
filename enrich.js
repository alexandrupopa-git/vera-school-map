/* Live enrichments for a pin: green space & woods near by (OpenStreetMap via Overpass), drive times to
   forest-like areas (OSRM), nearest busy road (OSM), and air quality (Open-Meteo / CAMS model).
   All optional: offline the panel shows the hand-compiled fallbacks and says so. */
(function () {
  const D = window.SM_DATA; const { $, esc, fmt } = window.U; const S = window.STATE; const NET = window.NET; const C = SM.config();
  const cache = {}; // per pin id

  // ---------------- OSM via Overpass ----------------
  async function overpass(lat, lon) {
    const q = `[out:json][timeout:25];(
      way["leisure"~"^(park|garden|recreation_ground|common|nature_reserve|dog_park)$"](around:1500,${lat},${lon});
      way["landuse"~"^(forest|village_green)$"](around:1500,${lat},${lon});
      way["natural"~"^(wood|heath)$"](around:4000,${lat},${lon});
      way["landuse"="forest"](around:4000,${lat},${lon});
      way["highway"~"^(motorway|trunk|primary)$"](around:600,${lat},${lon});
    );out center tags;`;
    const j = await NET.json('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeoutMs: 30000 });
    if (!j || !j.elements) return null;
    const greens = [], woods = [], roads = [];
    j.elements.forEach(e => {
      const c = e.center || (e.lat != null ? { lat: e.lat, lon: e.lon } : null); if (!c) return;
      const t = e.tags || {}; const d = SM.haversine(lat, lon, c.lat, c.lon);
      if (t.highway) { roads.push({ name: t.ref ? `${t.ref}${t.name ? ' ' + t.name : ''}` : (t.name || t.highway), kind: t.highway, d }); return; }
      const isWood = t.natural === 'wood' || t.landuse === 'forest' || t.natural === 'heath' || t.leisure === 'nature_reserve';
      const item = { name: t.name || (isWood ? (t.natural === 'heath' ? 'unnamed heath' : 'unnamed wood') : 'unnamed green space'), kind: t.leisure || t.landuse || t.natural, d, named: !!t.name };
      if (isWood) woods.push(item); if (!isWood || t.leisure === 'nature_reserve') greens.push(item);
    });
    const byD = (a, b) => a.d - b.d;
    // de-duplicate by name, nearest first
    const dedupe = arr => { const seen = new Set(); return arr.sort(byD).filter(x => { const k = x.name; if (seen.has(k) && x.named) return false; seen.add(k); return true; }); };
    return { greens: dedupe(greens).slice(0, 6), woods: dedupe(woods).slice(0, 5), roads: roads.sort(byD).slice(0, 3) };
  }
  // ---------------- drive times to nature (OSRM driving table; fallback estimate) ----------------
  async function driveTable(lat, lon, dests) {
    const coords = [[lon, lat]].concat(dests.map(d => [d.lon, d.lat])).map(c => c.join(',')).join(';');
    const destIdx = dests.map((_, i) => i + 1).join(';');
    const j = await NET.json(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&destinations=${destIdx}&annotations=duration,distance`);
    if (!j || !j.durations || !j.durations[0]) return null;
    const est = driveEstimate(lat, lon, dests);
    return dests.map((d, i) => {
      const km = j.distances && j.distances[0][i] != null ? j.distances[0][i] / 1000 : null; const straight = SM.haversine(lat, lon, d.lat, d.lon);
      if (km == null || km < straight * 0.8) return est[i]; // snapped to the wrong place (park interiors have no roads)
      return { dest: d, min: Math.round(j.durations[0][i] / 60), km: +km.toFixed(1), live: true };
    });
  }
  function driveEstimate(lat, lon, dests) {
    return dests.map(d => { const s = SM.haversine(lat, lon, d.lat, d.lon); const km = s * 1.3; const speed = km < 8 ? 24 : (km < 25 ? 35 : 55); return { dest: d, min: Math.round(km / speed * 60 + 3), km: +km.toFixed(1), live: false }; });
  }
  // ---------------- air quality (Open-Meteo, CAMS European model) ----------------
  const WHO = { pm2_5: 5, pm10: 15, nitrogen_dioxide: 10 }, UKLIMIT = { pm2_5: 20, pm10: 40, nitrogen_dioxide: 40 }; // annual-mean guideline (WHO 2021) and UK legal limits, µg/m³
  const mean = a => { a = a.filter(x => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  async function air(lat, lon) {
    const j = await NET.json(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=pm2_5,pm10,nitrogen_dioxide,ozone&current=pm2_5,pm10,nitrogen_dioxide,ozone,european_aqi&past_days=7&forecast_days=1&timezone=Europe%2FLondon`);
    if (!j || !j.hourly) return null;
    const h = j.hourly; const n = h.time.length; const idx7 = h.time.map((_, i) => i).filter(i => i < n - 24);
    const m7 = k => mean(idx7.map(i => h[k][i]));
    return { current: j.current, mean7: { pm2_5: m7('pm2_5'), pm10: m7('pm10'), nitrogen_dioxide: m7('nitrogen_dioxide'), ozone: m7('ozone') }, time: j.current && j.current.time };
  }
  async function airGrid(points) {
    const lats = points.map(p => p[0].toFixed(3)).join(','), lons = points.map(p => p[1].toFixed(3)).join(',');
    const j = await NET.json(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&hourly=pm2_5,nitrogen_dioxide&past_days=7&forecast_days=1&timezone=Europe%2FLondon`);
    if (!j) return null; const arr = Array.isArray(j) ? j : [j];
    return arr.map((r, i) => { const h = r.hourly; const n = h.time.length; const idx = h.time.map((_, k) => k).filter(k => k < n - 24); return { lat: points[i][0], lon: points[i][1], pm2_5: mean(idx.map(k => h.pm2_5[k])), no2: mean(idx.map(k => h.nitrogen_dioxide[k])) }; });
  }
  function airWord(k, v) { if (v == null) return ''; if (v <= WHO[k]) return 'within WHO guideline'; if (v <= WHO[k] * 2) return 'up to 2× WHO guideline'; if (v <= UKLIMIT[k]) return 'above 2× WHO, within UK limit'; return 'above the UK legal limit'; }
  function airColor(k, v) { if (v == null) return '#999'; const r = v / (k === 'no2' ? 10 : 5); return r <= 1 ? '#2b9348' : r <= 1.6 ? '#80b918' : r <= 2.2 ? '#ffd166' : r <= 3 ? '#f8961e' : '#d62828'; }

  // ---------------- panel block ----------------
  window.renderNature = async function (p) {
    const el = $('#natureBox'); if (!el) return;
    const k = p.id + ':' + p.lat.toFixed(4) + ',' + p.lon.toFixed(4);
    const park = window.nearestPark(p.lat, p.lon);
    const nature = D.nature.map(d => Object.assign({}, d, { s: SM.haversine(p.lat, p.lon, d.lat, d.lon) })).sort((a, b) => a.s - b.s).slice(0, 7);
    const render = (osm, drives, aq, status) => {
      const woodsLive = osm && osm.woods.length ? osm.woods[0] : null;
      const greenLive = osm && osm.greens.length ? osm.greens[0] : null;
      const walk = km => Math.round(km * 1.25 / C.walk_speed_kmh * 60);
      el.innerHTML = `
        <dl class="kv">
          <dt>Nearest green space</dt><dd>${greenLive ? `<b>${esc(greenLive.name)}</b> (${esc(greenLive.kind)}) — about ${walk(greenLive.d)} min walk, ${fmt(greenLive.d)} km to its centre<div class="tiny muted">OpenStreetMap, live${osm.greens.length > 1 ? ' · also: ' + osm.greens.slice(1, 4).map(g => esc(g.name) + ' ' + fmt(g.d) + ' km').join(', ') : ''}</div>` : (park ? `<b>${esc(park.p.name)}</b> — about ${park.walk_min} min walk <span class="tiny muted">(hand-compiled list; ${status})</span>` : '–')}</dd>
          <dt>Off-lead park</dt><dd>${park ? `<b>${esc(park.p.name)}</b> — about ${park.walk_min} min walk (${fmt(park.d)} km to centre)<div class="tiny">${esc(park.p.off_lead)}</div><div class="tiny muted">${esc(park.p.notes || '')} <a href="${esc(park.p.source)}" target="_blank" rel="noopener">source</a></div>` : '–'}</dd>
          <dt>Nearest wood / heath</dt><dd>${woodsLive ? `<b>${esc(woodsLive.name)}</b> — ${fmt(woodsLive.d)} km (about ${walk(woodsLive.d)} min on foot)<div class="tiny muted">OpenStreetMap, live${osm.woods.length > 1 ? ' · also: ' + osm.woods.slice(1, 3).map(g => esc(g.name) + ' ' + fmt(g.d) + ' km').join(', ') : ''}</div>` : `<span class="muted small">${status}</span>`}</dd>
          <dt>Forest-like areas by car</dt><dd>
            <table class="tbl"><tbody>${(drives || []).slice(0, 5).map(x => `<tr><td><b>${esc(x.dest.name)}</b><div class="tiny muted">${esc(x.dest.kind)} · ${esc(x.dest.dogs)}</div></td><td class="num" style="white-space:nowrap">${x.live ? '' : '≈'}${x.min != null ? x.min + ' min' : '–'}<div class="tiny muted">${x.km != null ? x.km + ' km' : ''}</div></td></tr>`).join('')}</tbody></table>
            <div class="tiny muted">${drives && drives.some(x => x.live) ? 'Driving times from OSRM (free-flow, no traffic); add 30–60% at a weekend peak. Entries marked ≈ are distance-based estimates.' : 'Estimated from straight-line distance (×1.3 at 24–55 km/h); live routing was not available. Approximate destination coordinates.'}</div></dd>
          <dt>Nearest busy road</dt><dd>${osm ? (osm.roads.length ? `<b>${esc(osm.roads[0].name)}</b> (${esc(osm.roads[0].kind)} road) at about ${Math.round(osm.roads[0].d * 1000)} m${osm.roads[0].d < 0.15 ? ' — close enough to matter for NO₂ and noise' : osm.roads[0].d < 0.3 ? ' — within the typical roadside pollution band' : ''}<div class="tiny muted">A-roads, trunk roads and motorways within 600 m (OpenStreetMap, live)</div>` : 'No A-road, trunk road or motorway within 600 m <span class="tiny muted">(OpenStreetMap, live)</span>') : `<span class="muted small">${status}</span>`}</dd>
          <dt>Air quality</dt><dd>${aq ? `
            <table class="tbl"><thead><tr><th></th><th>7-day mean</th><th>now</th><th>vs guideline</th></tr></thead><tbody>
              ${[['PM2.5', 'pm2_5'], ['NO₂', 'nitrogen_dioxide'], ['PM10', 'pm10']].map(([lab, key]) => `<tr><td>${lab}</td><td class="num">${aq.mean7[key] != null ? aq.mean7[key].toFixed(1) : '–'} µg/m³</td><td class="num">${aq.current && aq.current[key] != null ? aq.current[key].toFixed(1) : '–'}</td><td><span class="chip" style="border-color:${airColor(key === 'nitrogen_dioxide' ? 'no2' : 'pm', aq.mean7[key])}">${airWord(key, aq.mean7[key])}</span></td></tr>`).join('')}
            </tbody></table>
            <div class="tiny muted">Open-Meteo / Copernicus CAMS European model (~10 km grid, updated hourly, ${esc((aq.time || '').replace('T', ' '))}). Area-level, not street-level: roadside NO₂ can be 1.5–2× higher within 50–100 m of a busy road. WHO 2021 annual guidelines: PM2.5 5, NO₂ 10, PM10 15 µg/m³; UK legal limits 20 / 40 / 40. For long-term street-level maps open London Air / LAEI under Risks.</div>` : `<span class="muted small">${status}</span>`}</dd>
        </dl>`;
    };
    if (cache[k]) { render(cache[k].osm, cache[k].drives, cache[k].aq, 'offline'); return; }
    render(null, driveEstimate(p.lat, p.lon, nature), null, 'looking up…');
    const [osm, drives, aq] = await Promise.all([overpass(p.lat, p.lon), driveTable(p.lat, p.lon, nature), air(p.lat, p.lon)]);
    const dr = (drives || driveEstimate(p.lat, p.lon, nature)).sort((a, b) => (a.min ?? 1e9) - (b.min ?? 1e9));
    cache[k] = { osm, drives: dr, aq };
    if ($('#natureBox')) render(osm, dr, aq, 'not available (offline, or the service is busy)');
  };

  // ---------------- air-quality layer ----------------
  const layer = L.layerGroup(); let airData = null, airKey = 'no2';
  window.drawAirLayer = async function (on, metric) {
    airKey = metric || airKey; layer.clearLayers();
    if (!on) { window.map.removeLayer(layer); return; }
    layer.addTo(window.map);
    if (!airData) {
      window.toast('Fetching air-quality model values…');
      const pts = [];
      D.homes.forEach(h => { pts.push([h.lat, h.lon]); });
      // thin to ~4 km spacing
      const kept = []; pts.forEach(p => { if (!kept.some(q => SM.haversine(p[0], p[1], q[0], q[1]) < 3.5)) kept.push(p); });
      // add a coarse grid over the whole box so the layer is continuous
      for (let la = 51.30; la <= 51.82; la += 0.045) for (let lo = -0.50; lo <= -0.05; lo += 0.07) if (!kept.some(q => SM.haversine(la, lo, q[0], q[1]) < 3.5)) kept.push([la, lo]);
      airData = await airGrid(kept.slice(0, 120));
      if (!airData) { window.toast('Air-quality service not reachable (offline?)'); return; }
    }
    airData.forEach(d => {
      const v = airKey === 'no2' ? d.no2 : d.pm2_5;
      const c = L.circle([d.lat, d.lon], { radius: 2600, stroke: false, fillColor: airColor(airKey === 'no2' ? 'no2' : 'pm', v), fillOpacity: 0.28, interactive: true, pane: 'hexPane' });
      c.bindTooltip(`${airKey === 'no2' ? 'NO₂' : 'PM2.5'} 7-day mean ${v != null ? v.toFixed(1) : '–'} µg/m³ · PM2.5 ${d.pm2_5 != null ? d.pm2_5.toFixed(1) : '–'} · NO₂ ${d.no2 != null ? d.no2.toFixed(1) : '–'}<br><i>CAMS model, ~10 km grid — area level</i>`, { sticky: true, className: 'sm-tip' });
      layer.addLayer(c);
    });
  };
})();
