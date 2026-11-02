/* "Ask about this spot": a small assistant that answers only from the data computed for the active pin.
   Calls the Anthropic API directly from the browser with a key you paste once (kept in this browser's
   localStorage, never in the files). Swap NET_CALL for a server endpoint (e.g. a Firebase function) to
   keep the key off the client. */
(function () {
  const D = window.SM_DATA; const { $, esc, fmt, gbp } = window.U; const S = window.STATE;
  S.chat = S.chat || {};
  const MODELS = [['claude-sonnet-5-5', 'Sonnet 5.5 (default)'], ['claude-haiku-5-5', 'Haiku 5.5 (fast, cheap)'], ['claude-opus-5-5', 'Opus 5.5 (thorough)']];
  const getKey = () => { try { return localStorage.getItem('sm_api_key') || ''; } catch (e) { return ''; } };
  const getModel = () => { try { return localStorage.getItem('sm_model') || MODELS[0][0]; } catch (e) { return MODELS[0][0]; } };

  // ---------- context for the model: everything the panel shows, as compact JSON ----------
  function rowCtx(r) {
    const s = r.school; const o = { name: s.name, chance: SM.LEVELS[r.level], reason: r.reason, distance_km_straight: +fmt(r.d), distance_km_used: +fmt(r.d_eff), distance_method: s.dist_method, ofsted: s.ofsted, ofsted_latest: s.ofsted_latest, type: s.type, counts_towards_score: !!r.counts && ((s.phase === 'P' && s.good_now) || (s.phase === 'S' && s.strong_now)) && (r.level === 'high' || r.level === 'medium') && !s.faith_decides, cutoff_history: SM.histLine(s), pan: s.pan };
    if (s.phase === 'P') Object.assign(o, { phase: s.phase_detail || 'Primary', ks2_rwm_2yr_pct: s.ks2 != null ? Math.round(s.ks2 * 100) : null, good_primary: s.good_now, faith: s.faith_label || 'none', faith_decides_places: s.faith_decides, admission_criteria: s.criteria, catchment_or_faith_flags: s.flags, nursery_class: s.nursery, tightest_recent_cutoff_km: s.tight, widest_recent_cutoff_km: s.wide, applications_latest: s.apps });
    else Object.assign(o, { phase: 'Secondary', selection: s.sel_short, selection_detail: s.selection, gender: s.gender, faith: s.faith, attainment8_2026: s.a8, pct_grade5_eng_maths_2026: s.g5, progress8_2024: s.p8, strong_secondary: s.strong_now, cutoff_basis: s.basis, admission_criteria: s.criteria, main_route_cutoff_km: s.tight, widest_recent_km: s.wide, rule: s.rule });
    if (r.check) o.check_before_signing = r.check; if (r.dist_note) o.distance_note = r.dist_note; if (r.borderline) o.borderline = true;
    return o;
  }
  function buildContext(p) {
    const C = SM.config(); const F = S.F;
    const sc = SM.score(p.lat, p.lon, F, { postcode: p.postcode, walkDist: p.walkDist });
    const rent = window.rentFor(p.lat, p.lon, p.postcode); const cm = window.commuteFor(p.lat, p.lon, S.req.dest || 'Waterloo'); const park = window.nearestPark(p.lat, p.lon);
    let near = null; D.homes.forEach(h => { const d = SM.haversine(p.lat, p.lon, h.lat, h.lon); if (!near || d < near.d) near = { h, d }; });
    const ranked = near && near.h.rank && near.d < 0.6 ? near.h : null;
    const ctx = {
      pin: { label: p.label, lat: +p.lat.toFixed(5), lon: +p.lon.toFixed(5), postcode: p.postcode ? { postcode: p.postcode.postcode, ward: p.postcode.ward, district: p.postcode.district } : 'not looked up (offline)', nearest_researched_spot: near ? { name: near.h.name, km: +fmt(near.d), rank: near.h.rank || null } : null },
      counts: { good_primaries_high: sc.n_prim_high, good_primaries_medium: sc.n_prim_med, strong_secondaries_high: sc.n_sec_high, strong_secondaries_medium: sc.n_sec_med, strong_comprehensives_high: sc.n_sec_comp_high, grammar_edge: sc.grammar_edge, score: +sc.score.toFixed(1), score_primary: +sc.score_p.toFixed(1), score_secondary: +sc.score_s.toFixed(1) },
      primary_schools: sc.prim.filter(r => r.d < 2.5 || r.level === 'high').sort((a, b) => a.d - b.d).map(rowCtx),
      secondary_schools: sc.sec.filter(r => r.d < 6 || r.level === 'high' || r.level === 'test').sort((a, b) => a.d - b.d).map(rowCtx),
      rent: rent ? { property_type: rent.property, typical_now_pcm: rent.typical, headline_source: rent.zone.typical ? 'workbook headline (Hutch average) for this researched spot' : 'median of Hutch ward/district averages', researched_zone: rent.zone.name, zone_distance_km: +fmt(rent.d), listings_range_pcm: rent.range, available_median_pcm: rent.available_med, let_agreed_median_pcm: rent.let_med, projection_2028_pcm: rent.proj ? Math.round(rent.proj) : null, projection_basis: rent.rate ? `${rent.rate.k} ONS annual change ${rent.rate.pct}% (year to Sep 2026) compounded ${C.projection_years} years` : null, budget_preferred: C.budget_preferred, budget_max: C.budget_max, stock_counts: rent.counts, data_points: rent.sources.map(s => ({ metric: s.metric, area: s.area, low: s.low, typical: s.typ, high: s.high, n: s.n, date: s.date })) } : 'no researched rent data within 2.5 km',
      commute: cm && cm.options.length ? { destination: cm.dest, door_to_door_min: cm.total, method: `${cm.best ? cm.best.mode + ' ' + cm.best.walk + ' min to ' + cm.best.st.name : ''} + ${C.station_buffer_min} min wait + train + ${C.far_end_min} min at the other end; train times are TfL Journey Planner fastest peak (arrive by 08:45, Mon 3 Nov 2026, checked ${D.stations.checked})`, stations: cm.options.map(o => ({ name: o.st.name, zone: o.st.zone, lines: o.st.lines, access_min: o.walk, access_mode: o.mode, km: +fmt(o.d), times_min: o.st.times, monthly_season_gbp: o.st.monthly_season_gbp })), ticket_costs_csv: D.commute_costs } : 'no station within 3.5 km in the station table',
      daily_life: { nearest_off_lead_park: park ? { name: park.p.name, walk_min: park.walk_min, km_to_centre: +fmt(park.d), off_lead_rule: park.p.off_lead, notes: park.p.notes, managed_by: park.p.managed_by, source: park.p.source } : null, heathrow_corridors_approximate: window.inHeathrow(p.lat, p.lon), heathrow_note: D.extras.heathrow.note },
      workbook_notes_for_this_spot: ranked ? { rank: ranked.rank, primary: ranked.primary, secondary: ranked.secondary, grammar_route: ranked.grammar, rent_now: ranked.rent, travel_pcm: ranked.travel, main_risk: ranked.risk, verdict: ranked.verdict, counts_in_workbook: { good_primaries_high: ranked.n_prim_high, good_primaries_medium: ranked.n_prim_med, strong_secondaries_high: ranked.n_sec_high, strong_secondaries_medium: ranked.n_sec_med } } : null,
      long_term_ranking: D.homes.filter(h => h.rank).sort((a, b) => a.rank - b.rank).map(h => ({ rank: h.rank, spot: h.name, verdict: h.verdict, rent: h.rent, total_with_travel: h.total })),
      rules_in_force: { chance: `High = inside ${Math.round(C.comfort_primary * 100)}% (primary) / ${Math.round(C.comfort_secondary * 100)}% (secondary) of the tightest 2024–26 cut-off, or every applicant offered; Medium = inside the tightest cut-off; Low = inside only the widest; Very low = outside all; Test-dependent = grammar/test places; schools where faith criteria decide places never count. Stress test currently −${C.stress_pct || 0}%.`, good_primary: `Ofsted Good/Outstanding and 2-yr KS2 RWM ≥ ${(C.ks2_bar * 100).toFixed(1)}%`, strong_secondary: `Attainment 8 ≥ ${(C.england_a8 + C.a8_bar_offset).toFixed(1)} (England ${C.england_a8} + ${C.a8_bar_offset})`, spare_place_schools: `count within ${C.walk_cap_london_km} km (London) / ${C.walk_cap_outside_km} km (outside) for primaries and ${C.sec_open_reach_km} km for secondaries`, walking_route_councils: `Richmond and Hounslow measure the walking route; the map estimates it as straight line × ${C.walking_factor}, via the nearest Thames bridge when the line crosses the river, or uses a live route when fetched${p.walkDist ? ' (live route distances WERE fetched for this pin)' : ' (NOT fetched for this pin)'}`, filters: F, applications_note: 'A school\'s "applications" figure counts every preference named on parents\' forms (up to 6 in London), not first choices; places are decided by the criteria and the last distance offered.' },
      data_caveats: ['Distances from school postcode centres, ±100–200 m.', 'Cut-offs are history, not promises; secondary entry is 2036.', 'Richmond primary 2024 and 2025 offer-day data missing.', 'Kingston Academy: no 2026 figure; measuring point moved to the Richmond Road boundary from 2026.', 'Herts does not publish Sandringham\'s last distance.', 'Rents are late-2026 asking/average rents; 2028 figures are projections.', 'KT18 is not in Tiffin Girls\' Designated Area (KT17 and KT19 are).'].concat(D.meta.issues || [])
    };
    return ctx;
  }
  const SYSTEM = `You are the assistant inside "Vera's School Map", a tool a family uses to choose where to rent in the UK from autumn 2028 so that one home works for state Reception (September 2029) and Year 7 (September 2036). You answer questions about ONE map pin using only the JSON context provided in the first user message, which contains everything the map computed for that spot.

Rules:
- Use only the context. Never invent, average or extrapolate a cut-off distance, result, rent or journey time. If the context does not contain what is asked, say so plainly and name where the family could check (the school's row and sources on the map, the council's offer-day table, the sources page).
- Quote the figures you rely on (e.g. "0.6 km vs 1.11–1.24 km cut-off, 2024–26"). Units: km, £ per month, minutes. British English.
- Chances are history, not promises: say so when relevant, especially for secondary (2036). Label comprehensive / grammar / partially selective and girls / mixed / faith whenever you name a secondary school.
- Explain "applications" correctly: it counts all preferences, not a queue for places; what decides a place is the criteria order and the last distance offered.
- Be concise: short paragraphs, no headers, bullet points only for lists of schools. If the question is really about a different spot, say the person should drop a pin there.
- Where the map's rating is a judgement call (walking-route estimate, "(likely)" ratings, banded intakes) say so, and mention the "workbook rated" note if present in the data.`;

  // ---------- UI ----------
  window.renderChat = function (p) {
    const box = $('#chatBox'); if (!box) return;
    const hist = S.chat[p.id] = S.chat[p.id] || [];
    const key = getKey();
    box.innerHTML = `
      <div class="chat-msgs" id="chatMsgs">${hist.length ? hist.map(m => `<div class="msg ${m.role}">${m.role === 'user' ? esc(m.content) : mdLite(m.content)}</div>`).join('') : `<div class="small muted">Ask anything about this spot, e.g. "Why is Belleville High when it had 512 applications?", "What would change if cut-offs shrank 20%?", "Which of these secondaries are mixed comprehensives?", "Is the rent figure asking or achieved?". Answers use only the data shown on this panel.</div>`}</div>
      <form id="chatForm" class="row" style="margin-top:6px;flex-wrap:nowrap"><input id="chatIn" type="text" placeholder="${key ? 'Ask about this spot…' : 'Paste an API key in settings below first'}" ${key ? '' : 'disabled'} style="flex:1;min-width:0"><button class="btn btn-primary btn-sm" type="submit" ${key ? '' : 'disabled'}>Ask</button></form>
      <details class="small" style="margin-top:6px"><summary class="muted">Assistant settings (API key, model)</summary>
        <div class="row" style="margin-top:6px"><input id="apiKey" type="password" placeholder="sk-ant-… (Anthropic API key)" value="${esc(key)}" style="flex:1;min-width:0" autocomplete="off"><select id="modelSel">${MODELS.map(m => `<option value="${m[0]}" ${getModel() === m[0] ? 'selected' : ''}>${m[1]}</option>`).join('')}</select><button class="btn btn-sm" id="saveKey" type="button">Save</button></div>
        <p class="tiny muted" style="margin:6px 0 0">The key is stored only in this browser (localStorage) and sent straight to api.anthropic.com from your device; it is not in the app's files or the shared link. Each question costs roughly 20–40k input tokens (the spot's data). Clear the key with an empty Save.</p>
      </details>`;
    const msgs = $('#chatMsgs'); msgs.scrollTop = msgs.scrollHeight;
    $('#saveKey').onclick = () => { try { const k = $('#apiKey').value.trim(); if (k) localStorage.setItem('sm_api_key', k); else localStorage.removeItem('sm_api_key'); localStorage.setItem('sm_model', $('#modelSel').value); } catch (e) {} window.toast(getKey() ? 'Key saved in this browser' : 'Key removed'); window.renderChat(p); };
    $('#chatForm').onsubmit = async e => {
      e.preventDefault(); const q = $('#chatIn').value.trim(); if (!q) return; $('#chatIn').value = '';
      hist.push({ role: 'user', content: q }); hist.push({ role: 'assistant', content: '…', pending: true }); window.renderChat(p);
      const ans = await ask(p, hist);
      hist.pop(); hist.push({ role: 'assistant', content: ans }); window.renderChat(p);
    };
  };
  function mdLite(s) { // minimal markdown: paragraphs, bullets, bold
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n{2,}/).map(par => /^(\s*[-•] )/m.test(par) ? '<ul>' + par.split(/\n/).filter(l => l.trim()).map(l => '<li>' + l.replace(/^\s*[-•]\s*/, '') + '</li>').join('') + '</ul>' : '<p>' + par.replace(/\n/g, '<br>') + '</p>').join('');
  }
  async function ask(p, hist) {
    const key = getKey(); if (!key) return 'No API key saved — open Assistant settings below.';
    const ctx = buildContext(p);
    const prior = hist.filter(m => !m.pending);
    const messages = [{ role: 'user', content: 'Context for the active pin (JSON):\n' + JSON.stringify(ctx) + '\n\nAnswer questions about this spot from this context only.' }, { role: 'assistant', content: 'Understood. I will answer only from this context and say when something is not in it.' }].concat(prior.map(m => ({ role: m.role, content: m.content })));
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 60000);
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: getModel(), max_tokens: 1200, system: SYSTEM, messages }) });
      clearTimeout(t);
      const j = await r.json();
      if (!r.ok) return `The API returned an error (${r.status}): ${j.error && j.error.message ? j.error.message : 'unknown'}. Check the key and model in settings.`;
      return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n') || 'No answer returned.';
    } catch (e) { return 'Could not reach api.anthropic.com (offline, or blocked by the browser). ' + (e.message || ''); }
  }
  window.buildPinContext = buildContext;
})();
