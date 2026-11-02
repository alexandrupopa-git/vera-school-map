/* Pin panel, school card, compare, saved, help, network lookups, rent/commute/park helpers. */
(function () {
  const D = window.SM_DATA; const { $, $$, esc, fmt, gbp } = window.U; const S = window.STATE; const C = SM.config();
  const X = D.extras;

  // ------------------------------------------------------------------ network (all optional; the page works without)
  const NET = window.NET = {
    online: true,
    async json(url, opts) {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), (opts && opts.timeoutMs) || 9000);
      try { const r = await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {})); clearTimeout(t); if (!r.ok) throw new Error(r.status); NET.online = true; return await r.json(); }
      catch (e) { clearTimeout(t); return null; }
    },
    async postcode(pc) {
      const j = await NET.json('https://api.postcodes.io/postcodes/' + encodeURIComponent(pc));
      if (!j || !j.result) return null; const r = j.result;
      return { postcode: r.postcode, outcode: r.outcode, sector: r.postcode.slice(0, -2).trim(), lat: r.latitude, lon: r.longitude, ward: r.admin_ward, district: r.admin_district, lsoa: r.lsoa };
    },
    async reverse(lat, lon) {
      const j = await NET.json(`https://api.postcodes.io/postcodes?lon=${lon}&lat=${lat}&limit=1&radius=400`);
      if (!j || !j.result || !j.result.length) return null; const r = j.result[0];
      return { postcode: r.postcode, outcode: r.outcode, sector: r.postcode.slice(0, -2).trim(), lat: r.latitude, lon: r.longitude, ward: r.admin_ward, district: r.admin_district, lsoa: r.lsoa, approx_m: Math.round(r.distance) };
    },
    async outcode(oc) {
      const j = await NET.json('https://api.postcodes.io/outcodes/' + encodeURIComponent(oc));
      return j && j.result ? { lat: j.result.latitude, lon: j.result.longitude, outcode: j.result.outcode } : null;
    },
    async geocode(q) {
      // Nominatim: London + Surrey + Herts box; returns [] when nothing, null when offline
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=gb&limit=6&addressdetails=1&viewbox=-0.62,51.20,0.10,51.90&bounded=1`;
      const j = await NET.json(url, { headers: { 'Accept-Language': 'en-GB' } });
      if (!j) return null;
      return j.map(r => { const a = r.address || {}; const road = a.road || a.pedestrian || a.footway || r.name || ''; const town = a.town || a.city || a.village || a.suburb || a.city_district || ''; const pc = a.postcode || '';
        return { lat: parseFloat(r.lat), lon: parseFloat(r.lon), title: (road ? road + (a.house_number ? ' ' + a.house_number : '') : (r.name || r.display_name.split(',')[0])), sub: [a.suburb && a.suburb !== town ? a.suburb : '', town, pc].filter(Boolean).join(', '), zoom: a.house_number ? 17 : (road ? 16 : 14) }; });
    },
    async bulkReverse(points) {
      const j = await NET.json('https://api.postcodes.io/postcodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geolocations: points.map(p => ({ longitude: p[1], latitude: p[0], limit: 1, radius: 400 })) }) });
      if (!j || !j.result) return null;
      return j.result.map(r => (r.result && r.result[0]) ? r.result[0] : null);
    },
    async streets(points) {
      // Nominatim reverse, a few points only (usage policy); returns road names
      const out = new Set();
      for (const p of points.slice(0, 6)) {
        const j = await NET.json(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p[0]}&lon=${p[1]}&zoom=17`);
        if (j && j.address && j.address.road) out.add(j.address.road);
      }
      return Array.from(out);
    },
    async walkTable(lat, lon, schools) {
      // OSRM demo server; try foot profile then driving (road route approximates the walking route)
      if (!schools.length) return null;
      const coords = [[lon, lat]].concat(schools.map(s => [s.lon, s.lat])).map(c => c.join(',')).join(';');
      const dest = schools.map((_, i) => i + 1).join(';');
      for (const prof of ['foot', 'driving']) {
        const j = await NET.json(`https://router.project-osrm.org/table/v1/${prof}/${coords}?sources=0&destinations=${dest}&annotations=distance`);
        if (j && j.distances && j.distances[0]) { const out = {}; schools.forEach((s, i) => { const m = j.distances[0][i]; if (m != null) out[s.id] = m / 1000; }); return { dist: out, profile: prof }; }
      }
      return null;
    }
  };

  // ------------------------------------------------------------------ rent for a point
  const RATE_BY_DISTRICT = [[/^(KT1|KT2|KT5|KT6)$/, 'Kingston'], [/^(TW\d+|SW13|SW14)$/, 'Richmond'], [/^(SW19|SW20)$/, 'Merton'], [/^(SW11|SW8|SW18)$/, 'Wandsworth'], [/^SW4$/, 'Lambeth'], [/^(NW6|NW2|NW3)$/, 'Camden'], [/^(KT17|KT18|KT19|KT4)$/, 'Epsom & Ewell'], [/^AL\d$/, 'St Albans']];
  function rateFor(codes) { for (const c of codes) { const d = c.split(' ')[0]; for (const [re, k] of RATE_BY_DISTRICT) if (re.test(d)) return { k, pct: D.meta.rent_change[k] }; } return null; }
  function median(a) { a = a.filter(x => x != null).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  // live market checks pasted by the user (Rightmove/Zoopla results text), kept in this browser
  const MARKET = (function () { try { return JSON.parse(localStorage.getItem('sm_market') || '{}'); } catch (e) { return {}; } })();
  function marketKey(lat, lon) { return lat.toFixed(3) + ',' + lon.toFixed(3); }
  window.marketCheck = function (lat, lon) { return MARKET[marketKey(lat, lon)] || null; };
  window.saveMarketCheck = function (lat, lon, m) { if (m) MARKET[marketKey(lat, lon)] = m; else delete MARKET[marketKey(lat, lon)]; try { localStorage.setItem('sm_market', JSON.stringify(MARKET)); } catch (e) {} };
  window.parseListings = function (text) {
    // £2,300 pcm / £2300 per month / £530 pw / £530 per week; ignores deposits and tiny or huge numbers
    const re = /£\s?(\d{1,2}[,.]?\d{3}|\d{3,5})\s*(pcm|per\s+calendar\s+month|per\s+month|pw|per\s+week|p\/w|\/\s*month|\/\s*week)?/gi; const pcm = [], pw = [], bare = []; let m;
    while ((m = re.exec(text))) { const v = parseFloat(m[1].replace(/[,.](?=\d{3})/, '')); const unit = (m[2] || '').toLowerCase(); if (!unit) bare.push(v); else if (/w/.test(unit) && !/month/.test(unit)) pw.push(Math.round(v * 52 / 12)); else pcm.push(v); }
    // Rightmove prints each price as both pcm and pw: use the pcm figures, fall back to pw, then to bare £ amounts
    const vals = (pcm.length ? pcm : (pw.length ? pw : bare)).filter(v => v >= 700 && v <= 9000);
    if (!vals.length) return null;
    const s = vals.slice().sort((a, b) => a - b); const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    const q1 = s[Math.floor((s.length - 1) * 0.25)], q3 = s[Math.ceil((s.length - 1) * 0.75)];
    const cnt = text.match(/(\d+)\s+(?:results?|properties)/i);
    return { n: vals.length, results: cnt ? parseInt(cnt[1], 10) : null, min: s[0], q1, med: Math.round(med), q3, max: s[s.length - 1], date: new Date().toISOString().slice(0, 10) };
  };
  window.rentFor = function (lat, lon, pcInfo) {
    let best = null;
    D.rents.zones.forEach(z => { const d = SM.haversine(lat, lon, z.lat, z.lon); if (!best || d < best.d) best = { z, d }; });
    if (!best || best.d > 2.5) return null;
    // prefer a ranked spot's researched headline when it is (almost) as close
    D.rents.zones.forEach(z => { if (z.typical && !best.z.typical) { const d = SM.haversine(lat, lon, z.lat, z.lon); if (d <= best.d + 0.15) best = { z, d }; } });
    const z = best.z; const rows = D.rents.rows; const byId = id => rows[id];
    let pool = (z.sector_rows.length ? z.sector_rows : z.district_rows).map(byId);
    // if we know the pin's own district and it differs, prefer rows for that district
    if (pcInfo && pcInfo.outcode) { const own = rows.filter(r => r.codes.includes(pcInfo.outcode) || (pcInfo.sector && r.codes.includes(pcInfo.sector))); if (own.length) pool = own; }
    const prop = z.property; // '2-bed' | '3-bed'
    const isHutch = r => /Hutch/.test(r.metric) && (prop === '2-bed' ? /2-bed|flat/.test(r.metric) : /3-bed house/.test(r.metric));
    const isListing = r => /(listing sample|Rightmove|Zoopla)/.test(r.metric) && r.typ != null;
    const isCount = r => /count/.test(r.metric) || (/(listing|Rightmove|Zoopla)/.test(r.metric) && r.n && !isNaN(parseFloat(r.n)));
    const hutch = pool.filter(isHutch), listings = pool.filter(isListing);
    const hutchAvg = z.typical || median(hutch.map(r => r.typ));
    const askingRows = listings.filter(r => /available|Rightmove|Zoopla/.test(r.metric) && !/^listing sample \(let agreed/.test(r.metric));
    const asking = median(askingRows.map(r => r.typ)) || median(listings.map(r => r.typ));
    // the headline is what you would see on Rightmove today (asking rents of new lets); averages of existing tenancies run lower
    let typical = asking || hutchAvg;
    const live = window.marketCheck(lat, lon); if (live && live.med) typical = live.med;
    const letAgreed = listings.filter(r => /let agreed/i.test(r.metric) && !/available/.test(r.metric));
    const available = listings.filter(r => /available/.test(r.metric) || (!/let agreed/i.test(r.metric)));
    const lows = listings.map(r => r.low).filter(x => x != null), highs = listings.map(r => r.high).filter(x => x != null && x < 6000);
    const counts = pool.filter(isCount).map(r => ({ n: parseFloat(r.n), label: r.metric, area: r.area, date: r.date }));
    const rate = rateFor(pcInfo && pcInfo.outcode ? [pcInfo.outcode] : z.codes);
    const proj = typical && rate && rate.pct != null ? typical * Math.pow(1 + rate.pct / 100, C.projection_years) : null;
    const dates = Array.from(new Set(pool.map(r => r.date).filter(Boolean)));
    return { zone: z, d: best.d, property: prop, typical, asking, hutchAvg, live, basis: live ? 'live' : (asking ? 'asking' : 'average'), range: lows.length ? [Math.min(...lows), Math.max(...highs)] : null, available_med: median(available.map(r => r.typ)), let_med: median(letAgreed.map(r => r.typ)), rate, proj, counts, hutch, listings, dates, sources: pool.slice(0, 40) };
  };

  // ------------------------------------------------------------------ commute for a point
  window.commuteFor = function (lat, lon, dest) {
    const sts = D.stations.stations; if (!sts.length) return null;
    let cands = sts.map(st => ({ st, d: SM.haversine(lat, lon, st.lat, st.lon) })).sort((a, b) => a.d - b.d).slice(0, 4);
    const options = cands.map(c => {
      const t = c.st.times && c.st.times[dest]; const walkMin = c.d * 1.25 / C.walk_speed_kmh * 60;
      const cycle = c.d > 1.2; const access = cycle ? Math.round(c.d * 1.3 / 15 * 60 + 4) : Math.round(walkMin); // beyond ~15 min on foot assume a bike (15 km/h + 4 min to lock up)
      const total = t && t.min != null ? Math.round(access + C.station_buffer_min + t.min + C.far_end_min) : null;
      return { st: c.st, d: c.d, walk: access, mode: cycle ? 'cycle' : 'walk', train: t ? t.min : null, note: t ? t.note : '', total };
    }).filter(o => o.d <= 3.5);
    const withT = options.filter(o => o.total != null).sort((a, b) => a.total - b.total);
    return { options, best: withT[0] || options[0] || null, total: withT.length ? withT[0].total : null, dest };
  };
  function costFor(lat, lon, station) {
    // monthly ticket from commute_costs.csv by nearest listed area / station
    if (station && station.monthly_season_gbp) return { cost: station.monthly_season_gbp, label: 'monthly season (research)', src: (station.sources || [])[0] };
    const zone = station && station.zone; if (zone && /^\d$/.test(String(zone))) { const row = D.commute_costs.find(r => String(r.fare_zone) === String(zone)); if (row) return { cost: parseFloat(row.monthly_cost_gbp), label: row.ticket, src: row.source }; }
    let best = null;
    D.commute_costs.forEach(r => { const keyName = r.area.split(' (')[0].split(' /')[0].trim(); D.homes.filter(h => h.name.includes(keyName)).forEach(h => { const d = SM.haversine(lat, lon, h.lat, h.lon); if (!best || d < best.d) best = { r, d }; }); });
    return best && best.d < 6 ? { cost: parseFloat(best.r.monthly_cost_gbp), label: best.r.ticket, src: best.r.source } : null;
  }

  // ------------------------------------------------------------------ parks, heathrow
  window.nearestPark = function (lat, lon) {
    if (!D.parks) return null; let best = null;
    D.parks.parks.forEach(p => { const d = SM.haversine(lat, lon, p.lat, p.lon); if (!best || d < best.d) best = { p, d }; });
    if (!best) return null; const edge = Math.max(0, best.d - Math.sqrt((best.p.size_ha || 2) / 100 / Math.PI) * 0.8); // rough distance to the park edge
    return Object.assign(best, { walk_min: Math.round(edge * 1.25 / C.walk_speed_kmh * 60) });
  };
  function pointInPoly(lat, lon, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1]; if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
  window.inHeathrow = function (lat, lon) { return X.heathrow.corridors.filter(c => pointInPoly(lat, lon, c.poly)).map(c => c.name); };

  // ------------------------------------------------------------------ listing links
  function listingLinks(pc, lat, lon, london) {
    const beds = london ? 2 : 3; const term = pc ? (pc.sector || pc.outcode) : null;
    if (!term) return `<p class="small muted">Listing links need the spot's postcode (live lookup unavailable offline). Search the sites for the nearest postcode: <span class="num">${lat.toFixed(4)}, ${lon.toFixed(4)}</span>.</p>`;
    const slug = term.toLowerCase().replace(/\s+/g, '-');
    const build = (site, max, la) => site.url.replace('{pcq}', encodeURIComponent(term)).replace('{pcslug}', slug).replace('{beds}', beds).replace('{max}', max).replace('{radius}', 0.5).replace('{rmtype}', london ? 'flat' : 'detached,semi-detached,terraced')
      .replace('{pets}', site.pets ? site.pets_param : '').replace('{letagreed}', la && site.letagreed ? site.letagreed_param : '');
    return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Site</th><th>≤ £2,500</th><th>≤ £3,000</th><th>incl. let agreed</th><th>Note</th></tr></thead><tbody>${X.listing_sites.map(s => s.landing ? `<tr><td><b>${s.name}</b></td><td colspan="3"><a href="${s.url}" target="_blank" rel="noopener">open Rightmove</a> and paste <span class="num">${esc(term)}</span> <button class="btn btn-sm" data-copy="${esc(term)}" type="button">copy</button></td><td class="tiny muted">${esc(s.note)}</td></tr>` : `<tr><td><b>${s.name}</b>${s.pets ? '<div class="tiny muted">pets filter on</div>' : ''}</td><td><a href="${build(s, 2500, false)}" target="_blank" rel="noopener">open</a></td><td><a href="${build(s, 3000, false)}" target="_blank" rel="noopener">open</a></td><td>${s.letagreed ? `<a href="${build(s, 3000, true)}" target="_blank" rel="noopener">open</a>` : '<span class="tiny muted">tick on site</span>'}</td><td class="tiny muted">${esc(s.note)}</td></tr>`).join('')}</tbody></table></div>
      <p class="tiny muted">${beds} bedrooms, within 0.5 mi of ${esc(term)}. OpenRent opens filtered results; Rightmove's result pages cannot be deep-linked from a postcode, so its link opens the lettings page and you paste the postcode (copy button); Zoopla and OnTheMarket use their standard URL patterns but could not be test-opened when this map was built — check the filters once. Pets: only Zoopla takes a pets flag in the URL; tick it on the other sites. Listings are never copied here: they go stale within days.</p>`;
  }
  // Google encoded polyline (used by Rightmove's "draw a search" and Zoopla's polygon search URLs)
  function encodePolyline(pts) {
    let out = '', plat = 0, plng = 0;
    const enc = v => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
    pts.forEach(([lat, lon]) => { const a = Math.round(lat * 1e5), b = Math.round(lon * 1e5); out += enc(a - plat) + enc(b - plng); plat = a; plng = b; });
    return out;
  }
  function simplifyRing(poly, n) { const step = Math.max(1, Math.floor(poly.length / n)); const out = poly.filter((_, i) => i % step === 0); if (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1]) out.push(out[0]); return out; }
  window.drawnAreaLinks = function (poly, london) {
    const ring = simplifyRing(poly, 30); const enc = encodePolyline(ring); const beds = london ? 2 : 3;
    const rm = max => `https://www.rightmove.co.uk/property-to-rent/map.html?locationIdentifier=${encodeURIComponent('USERDEFINEDAREA^{"polylines":"' + enc + '"}')}&minBedrooms=${beds}&maxBedrooms=${beds}&maxPrice=${max}&includeLetAgreed=true`;
    const zp = max => `https://www.zoopla.co.uk/to-rent/map/property/london/?polyenc=${encodeURIComponent(enc)}&beds_min=${beds}&beds_max=${beds}&price_max=${max}&price_frequency=per_month&include_rented=true`;
    return `<div class="links" style="margin-top:6px"><a href="${rm(2500)}" target="_blank" rel="noopener">Rightmove: this zone drawn on their map, ≤ £2,500</a><a href="${rm(3000)}" target="_blank" rel="noopener">Rightmove, ≤ £3,000</a><a href="${zp(2500)}" target="_blank" rel="noopener">Zoopla: this zone, ≤ £2,500</a><a href="${zp(3000)}" target="_blank" rel="noopener">Zoopla, ≤ £3,000</a></div>
      <div class="tiny muted">The zone outline is passed to the site as a drawn search area (${ring.length - 1} points), so results are only inside it. Both include let-agreed homes to show the real market; tick pets on the site.</div>`;
  };
  function tpl(u, p) { return u.replace('{lat}', p.lat.toFixed(5)).replace('{lon}', p.lon.toFixed(5)).replace('{pc}', encodeURIComponent(p.pc || '')).replace('{pcq}', (p.pc || '').replace(/\s+/g, '+')).replace('{dest}', p.dest || '').replace('{destq}', encodeURIComponent((p.dest || '') + ', London')).replace('{urn}', p.urn || ''); }

  // ------------------------------------------------------------------ school row
  function histBlock(s) { return `<div class="hist">${esc(SM.histLine(s))}</div>`; }
  function qualityLine(s) {
    if (s.phase === 'P') return `${esc(s.phase_detail || 'Primary')} · ${esc(s.type)} · Ofsted <b>${esc(s.ofsted)}</b> · KS2 RWM <b>${s.ks2 != null ? Math.round(s.ks2 * 100) + '%' : 'n/a'}</b>${s.linked_junior && !/^(n\/a|none)/i.test(s.linked_junior) ? ' (via ' + esc(s.linked_junior) + ')' : ''} · PAN ${s.pan ?? '–'}${s.faith_label ? ' · <b>faith</b>' : ''}${s.nursery ? ' · has nursery' : ''}`;
    return `<b>${esc(s.sel_short)}</b> · ${esc(s.gender)}${s.is_faith ? ' · <b>' + esc(s.faith) + '</b>' : ''} · Ofsted <b>${esc(s.ofsted)}</b> · A8 <b>${s.a8 ?? 'n/a'}</b> · 5+ E&M ${s.g5 != null ? s.g5 + '%' : 'n/a'} · P8 ${s.p8 != null ? (s.p8 > 0 ? '+' : '') + s.p8 : 'n/a'} · PAN ${s.pan ?? '–'}`;
  }
  function schoolRow(r, ref) {
    const s = r.school; const q = s.phase === 'P' ? (s.good_now ? '<span class="chip q-good">good primary</span>' : '<span class="chip q-no">below bar</span>') : (s.strong_now ? '<span class="chip q-good">strong</span>' : (s.above_avg ? '<span class="chip q-no">above average</span>' : '<span class="chip q-no">below bar</span>'));
    const counted = r.counts && ((s.phase === 'P' && s.good_now) || (s.phase === 'S' && s.strong_now)) && (r.level === 'high' || r.level === 'medium') && SM.schoolPasses(s, S.F) && !s.faith_decides;
    const refNote = ref && refLevel(ref.chance) !== r.level ? `<div class="tiny" style="color:var(--low)">Workbook rated this <b>${esc(ref.chance.split(' — ')[0])}</b> for the nearby researched spot (${esc(ref.home.split(' — ')[1] || ref.home)}, ${ref.d} km); the difference is the walking-route estimate or a judgement call.</div>` : '';
    return `<div class="school-row ${SM.schoolPasses(s, S.F) ? '' : 'dim'}" data-sid="${s.id}">
      <div class="row between"><span class="name">${esc(s.name)}</span><span>${chip(r.level)}${r.borderline ? ' <span class="chip">borderline</span>' : ''}${counted ? ' <span class="chip" title="counts towards the score">✓ counts</span>' : ''}</span></div>
      <div class="meta">${qualityLine(s)} ${q}</div>
      <div class="meta"><span class="num">${fmt(r.d)} km</span> straight line${r.method === 'route' ? ` · <span class="num">${fmt(r.d_eff)} km</span> by route` : (r.method !== 'straight' ? ` · ≈<span class="num">${fmt(r.d_eff)} km</span> on foot (est.)` : '')} · measured: ${esc(s.dist_method)}</div>
      <div class="reason">${esc(r.reason)}</div>
      ${r.dist_note ? `<div class="tiny muted">${esc(r.dist_note)}</div>` : ''}
      ${histBlock(s)}
      ${r.check ? `<div class="check">${esc(r.check)}</div>` : ''}
      ${refNote}
    </div>`;
  }
  function refLevel(ch) { const c = (ch || '').toLowerCase(); return c.startsWith('high') ? 'high' : c.startsWith('medium') ? 'medium' : c.startsWith('low') ? 'low' : c.startsWith('very low') ? 'verylow' : c.startsWith('test') ? 'test' : 'unknown'; }
  function refFor(pin, s) {
    // workbook rating for the nearest ranked spot within 400 m
    let best = null; D.homes.filter(h => h.rank).forEach(h => { const d = SM.haversine(pin.lat, pin.lon, h.lat, h.lon); if (d < 0.4 && (!best || d < best.d)) best = { h, d }; });
    if (!best) return null; return D.chance_ref.find(r => r.home === best.h.name && r.school.toLowerCase().slice(0, 20) === s.name.toLowerCase().slice(0, 20)) || null;
  }

  // ------------------------------------------------------------------ pin panel
  let renderToken = 0;
  window.renderPin = async function (p) {
    S.selSchool = null; window.G.rings.clearLayers();
    const my = ++renderToken; const el = $('#tab-pin');
    const F = S.F;
    const london = SM.pointContext(p.lat, p.lon).london;
    const sc = SM.score(p.lat, p.lon, F, { postcode: p.postcode, walkDist: p.walkDist });
    const nearHome = (function () { let b = null; D.homes.forEach(h => { const d = SM.haversine(p.lat, p.lon, h.lat, h.lon); if (!b || d < b.d) b = { h, d }; }); return b; })();
    const ranked = nearHome && nearHome.h.rank && nearHome.d < 0.6 ? nearHome.h : null;
    const prim = sc.prim.sort((a, b) => (SM.ORDER[a.level] - SM.ORDER[b.level]) || (a.d - b.d));
    const sec = sc.sec.sort((a, b) => (SM.ORDER[a.level] - SM.ORDER[b.level]) || (a.d - b.d));
    const goodHigh = prim.filter(r => r.level === 'high' && r.counts && r.school.good_now && !r.school.faith_decides && SM.schoolPasses(r.school, F));
    const goodMed = prim.filter(r => r.level === 'medium' && r.counts && r.school.good_now && !r.school.faith_decides && SM.schoolPasses(r.school, F));
    const strongHigh = sec.filter(r => r.level === 'high' && r.counts && r.school.strong_now && !r.school.faith_decides && SM.schoolPasses(r.school, F));
    const strongMed = sec.filter(r => r.level === 'medium' && r.counts && r.school.strong_now && !r.school.faith_decides && SM.schoolPasses(r.school, F));
    const grammars = sec.filter(r => r.level === 'test');
    const rent = window.rentFor(p.lat, p.lon, p.postcode);
    const cm = window.commuteFor(p.lat, p.lon, S.req.dest || 'Waterloo');
    const park = window.nearestPark(p.lat, p.lon);
    const hw = window.inHeathrow(p.lat, p.lon);
    const bestSec = strongHigh[0] || strongMed[0];
    // verdict
    let tone = 'warn', verdict;
    if (ranked) { verdict = ranked.verdict; tone = ranked.rank <= 5 ? 'good' : 'warn'; }
    else {
      const nP = goodHigh.length, nS = strongHigh.length;
      if (nP >= 2 && nS >= 1) { tone = 'good'; verdict = `Works on both phases: ${nP} good primaries and ${nS} strong secondar${nS > 1 ? 'ies' : 'y'} rated High from here${bestSec ? ' (' + bestSec.school.name + ')' : ''}.`; }
      else if (nP >= 1 && (nS >= 1 || strongMed.length)) { verdict = `Possible, with a thinner margin: ${nP} good primar${nP > 1 ? 'ies' : 'y'} High; secondary ${nS ? strongHigh[0].school.name + ' High' : strongMed[0].school.name + ' only Medium'}.`; }
      else if (nP >= 2) { verdict = `Good for Reception (${nP} good primaries High) but no strong secondary is realistically in reach — you would move again or rely on a test route.`; tone = 'warn'; }
      else { verdict = `Not recommended from here: ${nP} good primar${nP === 1 ? 'y' : 'ies'} and ${nS} strong secondar${nS === 1 ? 'y' : 'ies'} rated High.`; tone = 'bad'; }
    }
    const budget = rent && rent.typical ? (rent.typical <= C.budget_preferred ? ['within £2,500', 'good'] : rent.typical <= C.budget_max ? ['within £3,000', 'warn'] : ['over £3,000', 'bad']) : null;
    const total = rent && rent.typical && cm && cm.best ? (function () { const c = costFor(p.lat, p.lon, cm.best.st); return c ? { v: rent.typical + c.cost, c } : null; })() : null;
    const pcLine = p.postcode ? `<span class="num">${esc(p.postcode.postcode)}</span> · ${esc(p.postcode.ward || '')}${p.postcode.district ? ', ' + esc(p.postcode.district) : ''}${p.postcode.approx_m ? ` <span class="muted tiny">(nearest postcode, ${p.postcode.approx_m} m)</span>` : ''}` : `<span class="num">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</span> <span class="muted tiny" id="pcStatus">· looking up postcode…</span>`;
    const inCmp = S.compare.includes(p.id); const inSaved = S.shortlist.some(x => x.pinKey === key(p));

    el.innerHTML = `
      <div class="pin-head">
        <div><h2>${ranked ? `<span class="rankno">${ranked.rank}</span> ` : ''}${esc(p.label || 'Pin')}</h2><div class="small">${pcLine}</div>${nearHome && !ranked ? `<div class="tiny muted">Nearest researched spot: ${esc(nearHome.h.name)} (${fmt(nearHome.d)} km)${nearHome.h.rank ? ', ranked #' + nearHome.h.rank : ''}</div>` : ''}</div>
        <div class="row" style="flex-wrap:nowrap"><button class="btn btn-sm" id="btnCmp">${inCmp ? 'In compare ✓' : '+ Compare'}</button><button class="btn btn-sm" id="btnSave">${inSaved ? 'Saved ✓' : '☆ Save'}</button><button class="btn btn-sm" id="btnDel" title="Remove pin">✕</button></div>
      </div>
      <div class="card tone-${tone}"><div class="verdict">${esc(verdict)}</div>
        ${ranked ? `<div class="small" style="margin-top:6px"><b>Main risk:</b> ${esc(ranked.risk)}</div>` : ''}
        <div class="stats" style="margin-top:8px">
          <div class="stat"><span class="v">${goodHigh.length}<span class="muted" style="font-size:13px">/${goodMed.length}</span></span><span class="l">good primaries High/Med</span></div>
          <div class="stat"><span class="v">${strongHigh.length}<span class="muted" style="font-size:13px">/${strongMed.length}</span></span><span class="l">strong secondaries High/Med</span></div>
          <div class="stat"><span class="v">${rent && rent.typical ? gbp(rent.typical) : '–'}</span><span class="l">${rent && rent.basis === 'live' ? 'your live check' : rent && rent.basis === 'asking' ? 'asking rent' : 'average rent'}, ${rent ? rent.property : ''} ${budget ? '· ' + budget[0] : ''}</span></div>
          <div class="stat"><span class="v">${cm && cm.total != null ? cm.total + '′' : '–'}</span><span class="l">door-to-door to ${esc(S.req.dest || 'Waterloo')}</span></div>
        </div>
        ${sc.grammar_edge ? '<div class="small" style="margin-top:6px">Grammar edge: inside a local-priority area for a grammar school (bonus, never the plan).</div>' : ''}
        ${ranked && (ranked.n_prim_high !== goodHigh.length || ranked.n_sec_high !== strongHigh.length) ? `<div class="tiny muted" style="margin-top:6px">Workbook counted ${ranked.n_prim_high}/${ranked.n_prim_med} good primaries and ${ranked.n_sec_high}/${ranked.n_sec_med} strong secondaries here; the live count differs because of your filters or the walking-route estimate.</div>` : ''}
      </div>
      <div class="row small" style="margin:4px 0 8px"><span class="chip">score ${sc.score.toFixed(1)}</span><span class="chip">primary ${sc.score_p.toFixed(1)}</span><span class="chip">secondary ${sc.score_s.toFixed(1)}</span>${hw.length ? hw.map(n => `<span class="chip" style="border-color:var(--low);color:var(--low)" title="${esc(n)}">Heathrow: ${/approach/.test(n) ? 'under a westerly approach line' : 'easterly departure fan'} (approx.)</span>`).join('') : ''}</div>

      <details class="sec" open><summary>Primary schools in reach (${prim.filter(r => r.d < 2.5).length} within 2.5 km)</summary>
        <div class="schools-list" style="margin-top:6px" id="primList">${prim.filter(r => r.d < 2.5 || r.level === 'high').slice(0, 14).map(r => schoolRow(r, refFor(p, r.school))).join('')}</div>
        <p class="tiny muted">Sorted by chance, then distance. Faith-decided schools are shown but never counted. Infant schools use their junior school's KS2.</p>
      </details>
      <details class="sec" open><summary>Secondary schools in reach — Year 7, 2036 (${sec.filter(r => r.d < 6).length} within 6 km)</summary>
        <div class="schools-list" style="margin-top:6px">${sec.filter(r => r.level === 'high' || r.level === 'medium' || r.d < 4.5 || r.level === 'test').slice(0, 16).map(r => schoolRow(r, refFor(p, r.school))).join('')}</div>
        <p class="tiny muted">Secondary entry is ten years away: cut-offs are history, not promises. Comprehensive / grammar / partially selective and girls / mixed are labelled on every row.</p>
      </details>
      <details class="sec" open><summary>Rent — ${rent ? rent.property : (london ? '2-bed' : '3-bed')}</summary>${renderRent(rent, budget, london, p)}</details>
      <details class="sec" open><summary>Commute & monthly total</summary>${renderCommute(p, cm, total, london)}</details>
      <details class="sec"><summary>Search zone & streets</summary><div id="zoneBox">${renderZoneBox(p, sc)}</div></details>
      <details class="sec" open><summary>Ask about this spot</summary><div id="chatBox"></div></details>
      <details class="sec" open><summary>Rental listings — live searches</summary>${listingLinks(p.postcode, p.lat, p.lon, london)}</details>
      <details class="sec" open><summary>Green space, nature & air</summary>${renderLife(p, park, london)}</details>
      <details class="sec"><summary>Risks to check before signing</summary>${renderRisks(p, hw, london)}</details>
      ${ranked ? `<details class="sec"><summary>Workbook notes for this spot</summary><dl class="kv" style="margin-top:6px"><dt>Primary</dt><dd>${esc(ranked.primary)}</dd><dt>Secondary</dt><dd>${esc(ranked.secondary)}</dd><dt>Grammar route</dt><dd>${esc(ranked.grammar)}</dd><dt>Verdict</dt><dd>${esc(ranked.verdict)}</dd></dl></details>` : ''}
      <p class="tiny muted" style="margin-top:10px">Distances are straight lines from school postcode centres (allow 100–200 m). Chances follow the workbook rules (Help tab). Sources for every school: tap a school row.</p>`;

    // actions
    $('#btnCmp').onclick = () => { if (S.compare.includes(p.id)) S.compare = S.compare.filter(x => x !== p.id); else { S.compare.push(p.id); if (S.compare.length > 3) S.compare.shift(); } window.renderCompare(); window.renderPin(p); window.pushUrl(); };
    $('#btnSave').onclick = () => { saveToShortlist(p, sc, rent, cm); window.renderPin(p); };
    $('#btnDel').onclick = () => window.removePin(p.id);
    const ms = $('#marketSave'); if (ms) ms.onclick = () => { const m = window.parseListings($('#marketPaste').value); if (!m) { window.toast('No "£… pcm" prices found in the pasted text'); return; } window.saveMarketCheck(p.lat, p.lon, m); window.toast(`${m.n} prices read — median ${gbp(m.med)}`); window.renderPin(p); };
    const mc = $('#marketClear'); if (mc) mc.onclick = () => { window.saveMarketCheck(p.lat, p.lon, null); window.renderPin(p); };
    el.querySelectorAll('.school-row').forEach(row => row.addEventListener('click', e => { if (e.target.closest('a')) return; const s = D.byId[row.dataset.sid]; window.selectSchool(s); }));
    el.querySelectorAll('[data-zone-toggle]').forEach(cb => cb.addEventListener('change', () => drawPinZone(p, sc)));
    drawPinZone(p, sc);
    if (window.renderChat) window.renderChat(p);
    if (window.renderNature) window.renderNature(p);

    // async enrichments
    if (!p.postcode) {
      const pc = await NET.reverse(p.lat, p.lon);
      if (my !== renderToken) return;
      if (pc) { p.postcode = pc; if (p.label && p.label.startsWith('Pin ')) p.label = pc.postcode; window.savePins(); window.renderPin(p); return; }
      else { const st = $('#pcStatus'); if (st) st.textContent = '· postcode lookup unavailable (offline?) — listing links and Tiffin area check need it'; }
    }
    if (!p.walkDist) {
      const walkers = sc.prim.concat(sc.sec).filter(r => r.school.walking && r.d < 5).map(r => r.school).slice(0, 24);
      if (walkers.length) {
        const w = await NET.walkTable(p.lat, p.lon, walkers);
        if (my !== renderToken) return;
        if (w) { p.walkDist = w.dist; p.walkProfile = w.profile; window.toast(`Live ${w.profile === 'foot' ? 'walking' : 'road'} distances fetched for ${Object.keys(w.dist).length} walking-route schools`); window.renderPin(p); }
      }
    }
  };
  function key(p) { return p.lat.toFixed(4) + ',' + p.lon.toFixed(4); }

  function renderRent(rent, budget, london, p) {
    const r = rent; const live = p ? window.marketCheck(p.lat, p.lon) : null;
    const budgetChip = budget ? `<span class="chip" style="border-color:var(--${budget[1] === 'good' ? 'high' : budget[1] === 'warn' ? 'medium' : 'verylow'})">${budget[0]}</span>` : '';
    const checkBox = p ? `
      <details class="small" style="margin-top:8px"><summary class="muted">Live market check — paste Rightmove / Zoopla results here</summary>
        <p class="tiny muted" style="margin:6px 0">Open the drawn-zone or postcode search above, press <b>List</b> on Rightmove, select all (Cmd/Ctrl+A), copy, and paste the page text below. The map reads every "£… pcm" / "£… pw" on the page and uses the median as this spot's rent figure. Nothing leaves your browser; the check is dated and kept here.</p>
        <textarea class="note-in" id="marketPaste" placeholder="Paste the results page text…"></textarea>
        <div class="row" style="margin-top:6px"><button class="btn btn-sm" id="marketSave" type="button">Read prices</button>${live ? '<button class="btn btn-sm" id="marketClear" type="button">Remove my check</button>' : ''}</div>
      </details>` : '';
    if (!r && !live) return `<p class="small muted">No researched rent data within 2.5 km of this spot. Use the listing links below to read the live market, then paste the results here to record it.</p>` + checkBox;
    return `<dl class="kv" style="margin-top:6px">
      ${live ? `<dt>Your live check</dt><dd><b class="num">${gbp(live.med)}</b> pcm median ${budgetChip}<div class="small">${live.n} prices read${live.results ? ` (${live.results} results)` : ''}: <span class="num">${gbp(live.min)}–${gbp(live.max)}</span>, middle half <span class="num">${gbp(live.q1)}–${gbp(live.q3)}</span> · ${esc(live.date)}</div><div class="tiny muted">Pasted from a listings page; this figure drives the budget colour and the monthly total.</div></dd>` : ''}
      ${r ? `<dt>${live ? 'Researched asking' : 'Asking now'}</dt><dd>${r.asking ? `<b class="num">${gbp(r.asking)}</b> pcm median of new-let asking prices ${live ? '' : budgetChip}<div class="tiny muted">Rightmove/Zoopla samples, ${esc(((r.listings[0] || {}).date || '').slice(0, 24))} · ${esc(r.zone.name.split(' — ').pop())}${r.d > 0.3 ? `, ${fmt(r.d)} km from the researched point` : ''}</div>` : '<span class="muted">no listing sample in the pack for this patch</span>'}</dd>
      <dt>Listings range</dt><dd>${r.range ? `<span class="num">${gbp(r.range[0])}–${gbp(r.range[1])}</span>` : '–'}${r.let_med ? ` · let-agreed median <span class="num">${gbp(r.let_med)}</span>` : ''}<div class="tiny muted">${r.let_med && r.asking ? (r.let_med < r.asking ? 'Let-agreed prices sit below asking: good ones go at the lower end.' : 'Let-agreed prices at or above asking: a competitive patch.') : ''} Samples are small (5–30 listings) and from ${esc(D.meta.compiled)}; the live check above is the better figure.</div></dd>
      <dt>Average, all tenancies</dt><dd>${r.hutchAvg ? `<span class="num">${gbp(r.hutchAvg)}</span> <span class="tiny muted">Hutch ward/district average of ${r.property} lets${r.zone.typical ? ' (the workbook\'s headline)' : ''} — a blend of existing tenancies and new lets across the whole ward, so it can sit above or below what is on Rightmove today</span>` : '–'}</dd>
      <dt>2028 projection</dt><dd>${r.proj ? `<span class="num">≈ ${gbp(r.proj)}</span> <span class="tiny muted">${r.rate.k} rents ${r.rate.pct >= 0 ? '+' : ''}${r.rate.pct}%/yr (ONS, year to Sep 2026) applied to the headline for ${C.projection_years} years — a projection, not a forecast</span>` : '<span class="muted">no borough rate in the pack</span>'}</dd>
      <dt>Stock</dt><dd>${r.counts.length ? r.counts.slice(0, 3).map(c => `<div class="tiny">${c.n} — ${esc(c.label)} (${esc(c.area)}, ${esc(c.date)})</div>`).join('') : '<span class="tiny muted">no listing counts in the pack for this patch</span>'}</dd>
      <dt>Sources</dt><dd class="src">${r.sources.filter(s => s.url).slice(0, 6).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.metric.slice(0, 40))}</a> (${esc(s.date.slice(0, 22))})`).join(' · ')}</dd>` : ''}
    </dl>` + checkBox;
  }
  function renderCommute(p, cm, total, london) {
    const dest = S.req.dest || 'Waterloo';
    if (!cm || !cm.options.length) return `<p class="small muted">No station within 3 km in the station table.</p>` + commuteLinks(p, dest, london);
    const rows = cm.options.map(o => { const c = costFor(p.lat, p.lon, o.st); return `<tr><td><b>${esc(o.st.name)}</b><div class="tiny muted">${esc(o.st.lines || '')}</div></td><td>${esc(String(o.st.zone))}</td><td class="num">${o.walk}′ ${o.mode === 'cycle' ? '🚲' : '🚶'} (${fmt(o.d)} km)</td>${C.destinations.map(d => { const t = o.st.times && o.st.times[d]; return `<td class="num" title="${esc(t && t.note || '')}">${t && t.min != null ? t.min + '′' : '–'}</td>`; }).join('')}<td class="num">${c ? gbp(c.cost) : '–'}</td></tr>`; }).join('');
    return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Station</th><th>Zone</th><th>Walk</th>${C.destinations.map(d => `<th>${esc(d)}</th>`).join('')}<th>Monthly</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small" style="margin:6px 0">Door-to-door to <b>${esc(dest)}</b>: <b class="num">${cm.total != null ? cm.total + ' min' : 'n/a'}</b> = ${cm.best ? cm.best.mode + ' ' + cm.best.walk : '–'} + ${C.station_buffer_min} wait + train ${cm.best && cm.best.train != null ? cm.best.train : '–'} + ${C.far_end_min} at the other end. ${total ? `<b>Rent + travel ≈ <span class="num">${gbp(total.v)}</span>/month</b> (${esc(total.c.label)}).` : ''}</p>
      <p class="tiny muted">Stations more than about 1.2 km away are reached by bike (15 km/h + 4 min) rather than on foot. Train times are typical fastest weekday-peak timetable times (see sources page, checked ${esc(D.stations.checked || '')}); Irena's daily commute and the 2–3 days a week into town use the same figures. Monthly ticket from TfL March 2026 fares / operator season tickets.</p>` + commuteLinks(p, dest, london);
  }
  function commuteLinks(p, dest, london) {
    return `<div class="links">${X.links.commute.filter(l => !l.london || london).map(l => `<a href="${tpl(l.url, { lat: p.lat, lon: p.lon, dest })}" target="_blank" rel="noopener">${esc(l.name.replace('{dest}', dest))}</a>`).join('')}</div>`;
  }
  function renderLife(p, park, london) {
    const pc = p.postcode && p.postcode.postcode;
    const nurs = D.schools.filter(s => s.phase === 'P' && s.nursery && SM.haversine(p.lat, p.lon, s.lat, s.lon) < 1.5).map(s => `${esc(s.name)} (${fmt(SM.haversine(p.lat, p.lon, s.lat, s.lon))} km)`);
    return `<div id="natureBox" style="margin-top:6px"><span class="muted small">Loading green space, woods, drive times and air quality…</span></div>
    <dl class="kv" style="margin-top:6px">
      <dt>Council dog rules</dt><dd class="tiny">${(D.parks ? D.parks.council_rules.filter(c => park && (park.p.managed_by || '').split(' ')[0] && c.council.includes((park.p.managed_by || '').split(' ')[0])).slice(0, 1).map(c => esc(c.rule)).join('') : '') || '<span class="muted">see the park entry</span>'}</dd>
      <dt>Nursery classes nearby</dt><dd class="small">${nurs.length ? nurs.join(', ') : '<span class="muted">none flagged in the school list</span>'}<div class="tiny muted">State school nursery classes from the school names only; private nurseries and childminders via the Ofsted link.</div></dd>
      <dt>Look around</dt><dd><div class="links">${X.links.life.filter(l => (!l.london || london) && (!l.needs || pc)).map(l => `<a href="${tpl(l.url, { lat: p.lat, lon: p.lon, pc })}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join('')}</div></dd>
    </dl>`;
  }
  function renderRisks(p, hw, london) {
    const pc = p.postcode && p.postcode.postcode;
    return `<div class="note">${hw.length ? `<b>Heathrow:</b> this spot lies under the approximate ${esc(hw.join(' and '))}. ` : (london && p.lon < -0.2 && p.lat > 51.44 ? '<b>Heathrow:</b> not under the drawn approach corridors, but west/south-west London hears aircraft on many days. ' : '')}Flood zones, Defra noise and crime are not drawn on this map; air quality is a model layer (Map tab) and a live reading above. Open the official maps at this spot:</div>
      <div class="links">${X.links.risk.filter(l => (!l.london || london) && (!l.outside || !london)).map(l => `<a href="${tpl(l.url, { lat: p.lat, lon: p.lon, pc })}" target="_blank" rel="noopener" title="${esc(l.note || '')}">${esc(l.name)}${l.needs === 'pc' && !pc ? ' (needs postcode)' : ''}</a>`).join('')}</div>
      ${pc ? `<p class="tiny muted" style="margin-top:6px">Postcode to paste where a tool asks: <span class="num">${esc(pc)}</span> <button class="btn btn-sm" data-copy="${esc(pc)}">copy</button></p>` : ''}
      <p class="tiny muted">${esc(X.heathrow.note)}</p>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) { navigator.clipboard.writeText(b.dataset.copy).then(() => window.toast('Copied')).catch(() => {}); } });

  // zone builder for a pin
  function renderZoneBox(p, sc) {
    const cands = sc.prim.concat(sc.sec).filter(r => (r.level === 'high' || r.level === 'medium') && r.counts && ((r.school.phase === 'P' && r.school.good_now) || (r.school.phase === 'S' && r.school.strong_now)) && !r.school.faith_decides).sort((a, b) => a.school.phase.localeCompare(b.school.phase) || a.d - b.d);
    const def = window.zoneDiscs(p.lat, p.lon, sc).map(d => d.id);
    return `<p class="small">The zone is the set of streets from which every ticked school stays inside its comfort radius. Tick the schools that matter; the shape on the map updates.</p>
      <div class="grid2">${cands.map(r => `<label class="ctl"><input type="checkbox" data-zone-toggle data-sid="${r.school.id}" ${def.includes(r.school.id) ? 'checked' : ''}> <span class="chip phase-${r.school.phase}">${r.school.phase === 'P' ? 'Pri' : 'Sec'}</span> ${esc(r.school.name)} ${chip(r.level)}</label>`).join('') || '<span class="muted small">No High/Medium counting schools here.</span>'}</div>
      <div id="zoneInfo" class="small" style="margin-top:6px"></div>
      <button class="btn btn-sm" id="btnZoneStreets">List postcode sectors & streets in the zone (online)</button>`;
  }
  let pinZoneLayer = null;
  function drawPinZone(p, sc) {
    if (pinZoneLayer) { window.G.zones.removeLayer(pinZoneLayer); pinZoneLayer = null; }
    const ids = $$('[data-zone-toggle]:checked').map(cb => cb.dataset.sid);
    const discs = window.zoneDiscs(p.lat, p.lon, sc, ids);
    const info = $('#zoneInfo'); if (!info) return;
    if (!discs.length) { info.textContent = 'Tick at least one school.'; return; }
    const poly = window.zonePolygon(p.lat, p.lon, discs);
    if (!poly) { info.textContent = 'This pin is outside one of the ticked comfort radii, so there is no zone from here — untick that school or move the pin.'; return; }
    pinZoneLayer = L.polygon(poly, { color: '#e4572e', weight: 2.5, fill: true, fillColor: '#e4572e', fillOpacity: 0.12 });
    window.G.zones.addLayer(pinZoneLayer);
    // area estimate
    let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += (b[1] - a[1]) * (111.32 * Math.cos(a[0] * Math.PI / 180)) * ((a[0] + b[0]) / 2 - p.lat) * 111.32; } area = Math.abs(area);
    const bounds = pinZoneLayer.getBounds(); const w = SM.haversine(bounds.getSouth(), bounds.getWest(), bounds.getSouth(), bounds.getEast()), h = SM.haversine(bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getWest());
    const london = SM.pointContext(p.lat, p.lon).london;
    info.innerHTML = window.drawnAreaLinks(poly, london) + `Zone from <b>${discs.length}</b> schools: about <b class="num">${w.toFixed(1)} × ${h.toFixed(1)} km</b> (≈ ${area.toFixed(2)} km²). Tightest constraint: <b>${esc(discs.sort((a, b) => a.r - b.r)[0].name)}</b> (${fmt(discs[0].r)} km comfort radius).`;
    const btn = $('#btnZoneStreets'); if (btn) btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'Looking up…';
      const sample = []; for (let i = 0; i < poly.length; i += Math.max(1, Math.floor(poly.length / 24))) sample.push(poly[i]); sample.push([p.lat, p.lon]);
      const pcs = await NET.bulkReverse(sample);
      let html = '';
      if (pcs) { const sectors = {}; pcs.filter(Boolean).forEach(r => { const s = r.postcode.slice(0, -2).trim(); sectors[s] = (sectors[s] || 0) + 1; }); html += `<div><b>Postcode sectors:</b> ${Object.keys(sectors).sort().map(s => `<span class="chip">${esc(s)}</span>`).join(' ')}</div>`; }
      else html += '<div class="muted">Postcode lookup unavailable (offline?).</div>';
      const streets = await NET.streets(sample.filter((_, i) => i % 4 === 0));
      if (streets.length) html += `<div style="margin-top:4px"><b>Streets on the zone edge:</b> ${streets.map(esc).join(', ')}</div>`;
      html += '<div class="tiny muted" style="margin-top:4px">Hand these to letting agents and use them as the search area; the zone itself is the shape on the map.</div>';
      info.insertAdjacentHTML('beforeend', html); btn.textContent = 'Done'; };
  }

  // ------------------------------------------------------------------ school card (clicked school)
  window.renderSchoolCard = function (s) {
    const el = $('#tab-pin'); const a = S.pins.find(p => p.id === S.activePin);
    const r = a ? SM.rate(s, SM.pointContext(a.lat, a.lon, { postcode: a.postcode, walkDist: a.walkDist })) : null;
    const src = s.src || {};
    const years = SM.years();
    el.innerHTML = `
      <div class="row between"><button class="btn btn-sm" id="btnBackPin">← back to pin</button><span class="chip phase-${s.phase}">${s.phase === 'P' ? 'Primary' : 'Secondary'}</span></div>
      <h2 style="margin-top:8px">${esc(s.name)}</h2>
      <div class="small">${qualityLine(s)}</div>
      <div class="small muted">${esc(s.la)} · URN ${s.urn} · ${esc(s.type)}</div>
      ${r ? `<div class="card"><div class="row between"><b>From the active pin</b> ${chip(r.level)}</div><div class="small" style="margin-top:4px">${esc(r.reason)}</div>${r.dist_note ? `<div class="tiny muted">${esc(r.dist_note)}</div>` : ''}${r.check ? `<div class="check small" style="margin-top:4px">✓ Check: ${esc(r.check)}</div>` : ''}</div>` : '<p class="small muted">Drop a pin to see the chance from a specific address.</p>'}
      <h4 style="margin-top:10px">Cut-off history (furthest distance offered)</h4>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Year</th><th>km</th><th>${s.phase === 'P' ? 'Status / last criterion' : 'Last criterion'}</th><th>PAN</th><th>Apps</th></tr></thead><tbody>
        ${years.map(y => { const h = s.hist.find(h => h.year === y); if (!h) return `<tr><td>${y}</td><td colspan="4" class="muted">no data</td></tr>`; return `<tr><td>${y}</td><td class="num">${typeof h.km === 'number' ? fmt(h.km) : '–'}</td><td class="small">${esc(h.status || '')}${h.crit != null ? ' · ' + esc(String(h.crit)) : ''}</td><td class="num">${h.pan ?? ''}</td><td class="num">${h.apps ?? ''}</td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="tiny muted">Rings on the map: solid ${C.latest_year}, dashed ${C.latest_year - 2}/${C.latest_year - 1}, dotted older; the tinted disc is the comfort radius (${Math.round((s.phase === 'P' ? C.comfort_primary : C.comfort_secondary) * 100)}% of the tightest recent cut-off${C.stress_pct ? `, stress-tested −${C.stress_pct}%` : ''}). ${s.walking ? '<b>This council measures the walking route</b>, so the straight-line rings understate the real catchment edge.' : 'Measured: ' + esc(s.dist_method) + '.'}</p>
      <h4>How places are decided</h4>
      <p class="small">${esc(s.criteria || s.basis || '')}</p>
      ${s.phase === 'S' && s.basis ? `<p class="small"><b>Basis of the cut-off:</b> ${esc(s.basis)}</p>` : ''}
      ${s.flags ? `<p class="small"><b>Catchment / faith flags:</b> ${esc(s.flags)}</p>` : ''}
      ${s.notes ? `<p class="small muted">${esc(s.notes)}</p>` : ''}
      <h4>Sources</h4>
      <div class="links">${src.ofsted ? src.ofsted.split(';').map(u => `<a href="${esc(u.trim())}" target="_blank" rel="noopener">Ofsted</a>`).join('') : ''}${src.results ? `<a href="${esc(src.results.split(';')[0].trim())}" target="_blank" rel="noopener">DfE results (API)</a>` : ''}${src.admissions ? `<a href="${esc(src.admissions)}" target="_blank" rel="noopener">Admissions</a>` : ''}<a href="${tpl(X.links.schools[0].url, { lat: s.lat, lon: s.lon, urn: s.urn })}" target="_blank" rel="noopener">GIAS</a><a href="${tpl(X.links.schools[1].url, { lat: s.lat, lon: s.lon, urn: s.urn })}" target="_blank" rel="noopener">Performance tables</a>${Object.keys(X.links.admissions_maps).filter(k => s.name.includes(k) || (k === 'Hertfordshire' && s.la === 'Hertfordshire')).map(k => `<a href="${esc(X.links.admissions_maps[k])}" target="_blank" rel="noopener">${esc(k)} area map</a>`).join('')}</div>
      ${s.phase === 'S' ? `<div class="tiny muted" style="margin-top:6px">${s.hist.filter(h => h.source).slice(-2).map(h => `<a href="${esc(h.source)}" target="_blank" rel="noopener">${h.year_label} allocation source</a>`).join(' · ')}</div>` : ''}`;
    $('#btnBackPin').onclick = () => { const a = S.pins.find(p => p.id === S.activePin); S.selSchool = null; window.G.rings.clearLayers(); if (a) window.renderPin(a); else el.innerHTML = '<p class="muted">Tap the map to check a spot.</p>'; };
    window.map.panTo([s.lat, s.lon]);
  };

  // ------------------------------------------------------------------ compare
  window.renderCompare = function () {
    const el = $('#tab-compare'); const pins = S.compare.map(id => S.pins.find(p => p.id === id)).filter(Boolean);
    $('#compareBadge').hidden = !pins.length; $('#compareBadge').textContent = pins.length;
    if (!pins.length) { el.innerHTML = '<p class="muted">Add two or three pins with “+ Compare” on the Pin tab.</p>'; return; }
    const rowsData = pins.map(p => { const sc = SM.score(p.lat, p.lon, S.F, { postcode: p.postcode, walkDist: p.walkDist }); const rent = window.rentFor(p.lat, p.lon, p.postcode); const cm = window.commuteFor(p.lat, p.lon, S.req.dest || 'Waterloo'); const park = window.nearestPark(p.lat, p.lon); const best = sc.sec.filter(r => (r.level === 'high') && r.school.strong_now && r.counts).sort((a, b) => b.school.a8 - a.school.a8)[0]; const bestP = sc.prim.filter(r => r.level === 'high' && r.school.good_now && r.counts).sort((a, b) => (b.school.ks2 || 0) - (a.school.ks2 || 0)).slice(0, 3); const cost = cm && cm.best ? costFor(p.lat, p.lon, cm.best.st) : null; return { p, sc, rent, cm, park, best, bestP, cost, hw: window.inHeathrow(p.lat, p.lon) }; });
    const row = (label, f) => `<tr><th>${label}</th>${rowsData.map(d => `<td>${f(d)}</td>`).join('')}</tr>`;
    el.innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr><th></th>${rowsData.map(d => `<th><b>${esc(d.p.label)}</b><div class="tiny muted">${d.p.postcode ? esc(d.p.postcode.postcode) : ''}</div></th>`).join('')}</tr></thead><tbody>
      ${row('Score', d => `<b class="num">${d.sc.score.toFixed(1)}</b> <span class="tiny muted">(P ${d.sc.score_p.toFixed(1)} / S ${d.sc.score_s.toFixed(1)})</span>`)}
      ${row('Good primaries High / Med', d => `<span class="num">${d.sc.n_prim_high} / ${d.sc.n_prim_med}</span>`)}
      ${row('Best good primaries (High)', d => d.bestP.map(r => esc(r.school.name) + ' (' + Math.round((r.school.ks2 || 0) * 100) + '%)').join('<br>') || '–')}
      ${row('Strong secondaries High / Med', d => `<span class="num">${d.sc.n_sec_high} / ${d.sc.n_sec_med}</span>`)}
      ${row('Best strong secondary (High)', d => d.best ? `${esc(d.best.school.name)}<div class="tiny muted">${esc(d.best.school.sel_short)}, ${esc(d.best.school.gender)}, A8 ${d.best.school.a8}</div>` : '–')}
      ${row('Grammar edge', d => d.sc.grammar_edge ? 'yes' : 'no')}
      ${row('Rent (headline)', d => d.rent && d.rent.typical ? `<span class="num">${gbp(d.rent.typical)}</span> <span class="tiny muted">${d.rent.property} · ${d.rent.basis === 'live' ? 'your live check ' + d.rent.live.date : d.rent.basis === 'asking' ? 'asking, researched' : 'average'}</span>` : '–')}
      ${row('Average, all tenancies', d => d.rent && d.rent.hutchAvg ? `<span class="num">${gbp(d.rent.hutchAvg)}</span>` : '–')}
      ${row('2028 projection', d => d.rent && d.rent.proj ? `<span class="num">≈${gbp(d.rent.proj)}</span>` : '–')}
      ${row('Door-to-door to ' + esc(S.req.dest || 'Waterloo'), d => d.cm && d.cm.total != null ? `<span class="num">${d.cm.total} min</span> <span class="tiny muted">via ${esc(d.cm.best.st.name)}</span>` : '–')}
      ${row('Monthly ticket', d => d.cost ? `<span class="num">${gbp(d.cost.cost)}</span>` : '–')}
      ${row('Rent + travel', d => d.rent && d.rent.typical && d.cost ? `<b class="num">${gbp(d.rent.typical + d.cost.cost)}</b>` : '–')}
      ${row('Off-lead park', d => d.park ? `${esc(d.park.p.name)} <span class="tiny muted">${d.park.walk_min} min</span>` : '–')}
      ${row('Heathrow corridor (approx.)', d => d.hw.length ? 'yes' : 'no')}
      ${row('', d => `<button class="btn btn-sm" data-goto="${d.p.id}">show</button> <button class="btn btn-sm" data-uncmp="${d.p.id}">remove</button>`)}
    </tbody></table></div>`;
    el.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { const p = S.pins.find(x => x.id === +b.dataset.goto); S.activePin = p.id; window.map.panTo([p.lat, p.lon]); window.renderPin(p); window.setTab('pin'); });
    el.querySelectorAll('[data-uncmp]').forEach(b => b.onclick = () => { S.compare = S.compare.filter(x => x !== +b.dataset.uncmp); window.renderCompare(); window.pushUrl(); });
  };

  // ------------------------------------------------------------------ shortlist
  function saveToShortlist(p, sc, rent, cm) {
    const k = key(p); if (S.shortlist.some(x => x.pinKey === k)) { S.shortlist = S.shortlist.filter(x => x.pinKey !== k); }
    else S.shortlist.push({ pinKey: k, lat: p.lat, lon: p.lon, label: p.label, postcode: p.postcode ? p.postcode.postcode : '', note: '', saved: new Date().toISOString().slice(0, 10), summary: `${sc.n_prim_high}/${sc.n_prim_med} good primaries · ${sc.n_sec_high}/${sc.n_sec_med} strong secondaries · rent ${rent && rent.typical ? gbp(rent.typical) : '–'} · ${cm && cm.total != null ? cm.total + ' min' : ''}` });
    persistShortlist(); window.renderSaved();
  }
  function persistShortlist() { try { localStorage.setItem('sm_shortlist', JSON.stringify(S.shortlist)); } catch (e) {} $('#savedBadge').hidden = !S.shortlist.length; $('#savedBadge').textContent = S.shortlist.length; window.pushUrl(); }
  window.renderSaved = function () {
    const el = $('#tab-saved'); $('#savedBadge').hidden = !S.shortlist.length; $('#savedBadge').textContent = S.shortlist.length;
    if (!S.shortlist.length) { el.innerHTML = '<p class="muted">Save pins from the Pin tab. Saved spots and notes stay in this browser; “Share view” puts them in the link too (up to 12).</p>'; return; }
    el.innerHTML = `<p class="small muted">Saved in this browser. Use <b>Share view</b> to send the list to Irena; she can save it in hers.</p>` + S.shortlist.map((x, i) => `<div class="card"><div class="row between"><b>${esc(x.label)}</b><span class="tiny muted">${esc(x.postcode)} · ${esc(x.saved)}</span></div><div class="small">${esc(x.summary || '')}</div><textarea class="note-in" data-i="${i}" placeholder="Notes: viewing date, agent, what to check…">${esc(x.note)}</textarea><div class="row" style="margin-top:6px"><button class="btn btn-sm" data-open="${i}">Open on map</button><button class="btn btn-sm" data-rm="${i}">Remove</button></div></div>`).join('') +
      `<div class="row" style="margin-top:8px"><button class="btn btn-sm" id="btnExportSaved">Copy shortlist as text</button></div>`;
    el.querySelectorAll('textarea').forEach(t => t.addEventListener('change', () => { S.shortlist[+t.dataset.i].note = t.value; persistShortlist(); }));
    el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const x = S.shortlist[+b.dataset.open]; window.map.setView([x.lat, x.lon], 15); window.dropPin(x.lat, x.lon, x.label); });
    el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { S.shortlist.splice(+b.dataset.rm, 1); persistShortlist(); window.renderSaved(); });
    $('#btnExportSaved').onclick = () => { const txt = S.shortlist.map(x => `${x.label} (${x.postcode || x.lat.toFixed(4) + ',' + x.lon.toFixed(4)}) — ${x.summary}${x.note ? '\n  ' + x.note : ''}`).join('\n'); navigator.clipboard.writeText(txt).then(() => window.toast('Shortlist copied')).catch(() => prompt('Copy:', txt)); };
  };

  // ------------------------------------------------------------------ help
  window.renderHelp = function () {
    $('#tab-help').innerHTML = `
      <h2>How to read this map</h2>
      <ol class="small">
        <li><b>Green surface</b> = where to look. Darker hexes have more good primaries and strong secondaries Vera would realistically get into. Grey hexes fail a requirement you set (Map tab). Primary-only / secondary-only views are on the Map tab.</li>
        <li><b>Tap anywhere</b>, or search a postcode / listing address, for that spot's answers: chance at every school, rent, commute, zone, listing links, risks.</li>
        <li><b>Chance</b> follows the workbooks: <span class="chip ch-high">High</span> inside ${Math.round(C.comfort_primary * 100)}% (primary) / ${Math.round(C.comfort_secondary * 100)}% (secondary) of the tightest 2024–26 cut-off, or every applicant offered; <span class="chip ch-medium">Medium</span> inside the tightest cut-off; <span class="chip ch-low">Low</span> inside only the widest; <span class="chip ch-verylow">Very low</span> outside all; <span class="chip ch-test">Test-dependent</span> for grammar/test places. Rule-based schools (nearest school, feeders, lotteries, bands, priority areas) are explained on their own row.</li>
        <li><b>Good primary</b> = Ofsted Good/Outstanding and 2-year KS2 RWM ≥ ${(C.ks2_bar * 100).toFixed(1)}%. <b>Strong secondary</b> = Attainment 8 ≥ ${(C.england_a8 + C.a8_bar_offset).toFixed(1)}. Both adjustable on the Map tab.</li>
        <li><b>Rings</b>: click a school. Solid ${C.latest_year}, dashed the two years before, dotted older, tinted disc = comfort radius. Richmond and Hounslow measure the walking route: rings are straight-line, the panel estimates the route (×${C.walking_factor}, via the nearest bridge across the Thames) and fetches a live route for a pin when online.</li>
        <li><b>Stress test</b>: the slider shrinks every cut-off; watch which spots survive.</li>
        <li><b>Zone</b>: tick schools on the Pin tab to draw the streets where all of them stay comfortably in reach (zones stop at the Thames); list its postcode sectors and streets for agents, or open the zone as a drawn search on Rightmove / Zoopla.</li>
        <li><b>Share view</b> copies a link that reopens the same filters, pins and (small) shortlist.</li>
        <li><b>Search</b> takes a street or address ("Canbury Park Road, Kingston"), a postcode, a postcode district (KT2) or "lat, lon".</li>
        <li><b>Ask about this spot</b> (Pin tab) answers questions from the data on the panel. It needs an Anthropic API key pasted once in its settings; the key stays in your browser.</li>
      </ol>
      <h4>What is not here</h4>
      <p class="small">Flood zones, Defra noise, crime, deprivation and census layers (link-outs instead; air quality is a ~10 km model layer plus live readings, not street-level); travel-time isochrones (walk + timetable estimates instead); Merton, Waldegrave, Stamford Green and Herts priority-area boundaries (flagged per school with the official link). Heathrow corridors are approximate.</p>
      <h4>Uncertainty</h4>
      <p class="small">Cut-offs are history, not promises; secondary entry is in 2036. Distances run from postcode centres (±100–200 m). Rents are late-2026 asking/average rents; 2028 figures are projections from borough ONS trends. Every number's source is one click away: school rows open the school card; rent and commute sections list theirs; <a href="sources.html" target="_blank">sources.html</a> lists everything with dates.</p>
      <p class="tiny muted">Data compiled ${esc(D.meta.compiled)} from the three workbooks and the map data pack. To add 2027/2028 cut-offs: edit source/schools.geojson (or the workbooks → re-export) and run tools/build_data.py; rents in source/rents_all.csv; thresholds in data/config.js.</p>`;
  };
})();
