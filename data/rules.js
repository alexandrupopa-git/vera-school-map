// Typed admission rules for schools whose places are NOT decided by a plain distance cut-off.
// Each entry overrides the generic distance engine for that school id. Text comes from the
// workbooks ('Chance of a place' sheet) and the schools' published arrangements.
// Types: test | test-partial | herts-nearest | distance-unpublished | stags | ballot | feeder |
//        banded | priority-unknown | nodal | faith | unknown
window.SM_DATA = window.SM_DATA || {};
window.SM_DATA.rules = {
  // ---- grammar / selective ------------------------------------------------------------
  'S-136615': { type: 'test', area: 'tiffin',
    inner: "Test-dependent, with an edge: this address is in Tiffin Girls' Inner Area (up to 60 places for Inner Area girls ranked in the top 350). About 1,480 girls tested for 180 places.",
    designated: "Test-dependent — inside the Designated Area (KT1–10, TW1–5, TW9–10, SW13–20 …), so you compete on rank. About 1,480 girls tested for 180 places (≈8 per place).",
    outside: "Very low — outside Tiffin's Designated Area, and every place in 2024–26 went to Designated/Inner Area residents.",
    unknown: "Test-dependent — Designated Area membership depends on the postcode district (KT1–10, TW1–5, TW9–10, SW13–20); the live postcode lookup was not available for this pin.",
    check: "Confirm the postcode district is in Tiffin Girls' Designated Area (school's Patterns of Admission PDF)." },
  'S-136795': { type: 'test', circle_km: 5.25,
    inside: "Test-dependent — inside Nonsuch's 5.25 km circle (up to 125 places by score for girls living within it); about 1,000–1,100 applications for 210 places.",
    outside: "Test-dependent — outside Nonsuch's 5.25 km circle, so only the 85 open places by score (plus remaining places); about 1,000–1,100 applications for 210 places." },
  'S-136789': { type: 'test', circle_km: 6.7,
    inside: "Test-dependent — inside Wallington's 6.7 km radius (up to 110 places by score for girls within it); same SET test as Nonsuch.",
    outside: "Test-dependent — outside Wallington's 6.7 km radius, so only the 100 open places by score; same SET test as Nonsuch." },
  'S-136554': { type: 'test-partial', text: "Test-dependent — 37.5% of places by test; the rest banded, with priority areas (Potters Bar). Treat as a bonus route only." },
  'S-136899': { type: 'test-partial', text: "Test-dependent — 35% of places by test; the rest by priority area, siblings and distance (Garston, near Watford). Bonus route only." },
  // Watford Girls', Graveney, Burntwood, Greenshaw keep the distance engine on their non-test places (note added automatically).

  // ---- Hertfordshire nearest-school rules -------------------------------------------------
  'S-138286': { type: 'herts-nearest', eligible: 'coed', if_nearest: 'cutoff',
    not_nearest: "Very low — Beaumont is not your nearest co-ed school from here, and 'not nearest' applicants got 0 places in 2025–26.",
    nearest_note: "Beaumont is your nearest co-ed Herts school: nearest-school applicants were offered to 0.69 km (2025) and 1.36 km (2026; siblings fell from 119 to 93). The radius swung a lot in two years.",
    check: "Confirm with Hertfordshire's 'Find your nearest school' tool that Beaumont is the nearest co-ed, non-faith, non-partially-selective school for the exact address." },
  'S-137270': { type: 'herts-nearest', eligible: 'coed', if_nearest: 'cutoff', hist_tight: 1.0256, hist_wide: 1.4618,
    not_nearest: "Very low — Sir John Lawes places went to 'in priority area, nearest school' applicants (1.03–1.46 km); not your nearest school from here.",
    nearest_note: "Nearest-school applicants offered to 1.46 km (2025) and 1.03 km (2026).",
    check: "Confirm nearest-school status with Hertfordshire's tool." },
  'S-136973': { type: 'herts-nearest', eligible: 'coed', if_nearest: 'cutoff', hist_tight: 3.3958, hist_wide: 6.5521,
    not_nearest: "Low — Roundwood Park (Harpenden) places went to nearest-school applicants (3.4–6.6 km); not your nearest school from here.",
    nearest_note: "Nearest-school applicants offered to 6.55 km (2025) and 3.40 km (2026).", check: "Confirm nearest-school status with Hertfordshire's tool." },
  'S-145890': { type: 'herts-nearest', eligible: 'coed', if_nearest: 'high', hist_tight: 2.3447, hist_wide: 2.4229,
    not_nearest_mode: 'cutoff',
    not_nearest: "Katherine Warington reached 'in priority area, NOT nearest school' applicants to 2.34–2.42 km, so even non-nearest homes within that got in.",
    nearest_note: "Nearest-school applicants were all offered; the school then reached 'not nearest' applicants to 2.3–2.4 km.", check: "Herts nearest-school tool." },
  'S-136609': { type: 'distance-unpublished', note: "All non-priority places by straight-line distance (142 in 2025, 104 in 2026); Herts does not publish the last distance. Thresholds here are the workbook's judgement, not data.",
    check: "Check the HCC allocation summary for Sandringham each spring; ask the school what the last offered distance was." },
  'S-138042': { type: 'unknown', text: "Unknown — Marlborough was full in 2025–26 but the last distance is not published." },
  'S-137339': { type: 'stags',
    nearest: "High — STAGS is your nearest eligible school from here, and every priority-area girl in that position was offered (2025–26).",
    lottery: "Medium (lottery) — STAGS is not your nearest eligible school here; priority-area girls get a random draw for 107–115 places.",
    outside: "Very low — outside Hertfordshire priority area 7; no places went outside the area.",
    check: "Priority area 7 is approximated here as 'within 6 km of St Albans city centre'. Confirm the address is in the area on Hertfordshire's admissions pages." },

  // ---- rules in London / Surrey -----------------------------------------------------------
  'S-138461': { type: 'priority-unknown', text: "Unknown — 85% of places go to Priority Area A (cut-off 1.76–2.03 km) and 15% to Area B (5.0–5.7 km); which area an address is in is only on an image map.",
    check: "Check the address against Waldegrave's Areas A/B map (PDF linked under sources)." },
  'S-141963': { type: 'nodal', lat: 51.4300, lon: -0.3340, approx: true,
    text: "80% of places by walking distance from a nodal point in Teddington (Somerset Gardens): 1.79–2.29 km; 20% from the school door. The nodal point here is placed approximately.",
    check: "Confirm the nodal point location on Turing House's admissions page." },
  'S-136750': { type: 'ballot', radius_km: 3.219,
    inside: "Medium (lottery) — inside the 2-mile radius, where remaining places go by random ballot (2023-24 policy; current policy unverified).",
    outside: "Very low — outside the 2-mile ballot radius.", check: "Verify West London Free School's current admissions policy; outcomes are not published." },
  'S-138267': { type: 'feeder', feeders: ['P-137563', 'P-101012', 'P-144621', 'P-146214'],
    with_feeder: "High — if Vera attends a feeder primary (feeder places went to 0.72–1.21 km in 2024–26). Places are split pro rata between Belleville, Honeywell, Belleville Wix and Ark John Archer, nearest first within each.",
    without: "Low — without a feeder primary, Ark Bolingbroke is out of reach; it fills from its four feeders.",
    check: "A feeder route needs a place at the feeder primary first — check that school's rating above." },
  'S-137855': { type: 'feeder', feeders: [],
    with_feeder: '', without: "Low/Unknown — Hinchley Wood fills from feeder primaries inside its catchment (criterion 5a reached 1.41–1.92 km). None of its feeders is in this dataset.",
    check: "See Hinchley Wood's admissions policy for the feeder list and catchment." },
  'S-138106': { type: 'faith', text: "Faith/feeder criteria decide — Loreto College (Catholic girls) fills from Catholic feeder primaries." },
  // ability-banded comprehensives (distance within band; band cut-offs not published)
  'S-136914': { type: 'banded' }, 'S-135316': { type: 'banded', hist_tight: 2.5, hist_wide: 3.05, text: "Recently only band A reached 2.5–3.05 km; the other bands stopped closer." },
  'S-136883': { type: 'banded' }, 'S-136172': { type: 'banded' }, 'S-149632': { type: 'banded' }, 'S-138607': { type: 'banded' },
  'S-137093': { type: 'banded' }, 'S-100625': { type: 'banded' },
};

// Tiffin Girls' areas, from the school's Determined Admissions Arrangements (Sept 2027 entry) and Patterns of Admission 2024–26. A pin is checked against these by its postcode district / ward (live lookup).
window.SM_DATA.tiffin = {
 "designated_districts": [
  "KT1",
  "KT2",
  "KT3",
  "KT4",
  "KT5",
  "KT6",
  "KT7",
  "KT8",
  "KT9",
  "KT10",
  "KT12",
  "KT13",
  "KT17",
  "KT19",
  "TW1",
  "TW2",
  "TW3",
  "TW4",
  "TW5",
  "TW7",
  "TW8",
  "TW9",
  "TW10",
  "TW11",
  "TW12",
  "TW13",
  "TW14",
  "TW15",
  "TW16",
  "TW17",
  "SW13",
  "SW14",
  "SW15",
  "SW17",
  "SW18",
  "SW19",
  "SW20",
  "W3",
  "W4",
  "W5",
  "W7",
  "W13",
  "SM4",
  "CR4"
 ],
 "designated_complete": true,
 "inner_wards": [
  "Berrylands",
  "Canbury Gardens",
  "Coombe Hill",
  "Coombe Vale",
  "Green Lane & St James",
  "Kingston Gate",
  "Kingston Town",
  "New Malden Village",
  "Norbiton",
  "St Mark's & Seething Wells",
  "Surbiton Hill",
  "Tudor",
  "Ham, Petersham and Richmond Riverside"
 ],
 "inner_complete": true,
 "policy_year": "Entry September 2027 (Determined Admissions Arrangements, para 5.3.1 and 5.4.1)",
 "place_rules": "PAN 180. Order: (1) EHCP naming the school. (2) Looked-after / previously looked-after children scoring at or above the 350th-ranked mark of all Stage Two sitters. (3) Up to 60 places for girls at or above the 350th-ranked mark, in priority order: (i) Designated Area residents eligible for Pupil Premium, then (ii) Inner Area residents; tie for the 60th place goes to the girl living nearest the school. (4) Remaining places (c.120) in rank order of combined Stage Two mark, Designated Area residents first, then those outside the Designated Area; tie for the 180th place: looked-after, then Pupil Premium, then nearest. Since the Designated Area was introduced in 2014 all places have gone to Designated Area residents; in 2024-26 all places went to Designated Area / Inner Area girls.",
 "sources": [
  {
   "title": "Determined Admissions Arrangements for entry September 2027 (PDF)",
   "url": "https://fra1.digitaloceanspaces.com/tiffingirls.org/wp-content/uploads/2026/03/11120006/Determined-Admissions-Arrangements-for-entry-September-2027.pdf",
   "checked": "2026-11-01"
  },
  {
   "title": "Patterns of Admission 2024-26 (PDF)",
   "url": "https://fra1.digitaloceanspaces.com/tiffingirls.org/wp-content/uploads/2026/09/02143656/Patterns-of-Admission-2024-26.pdf",
   "checked": "2026-11-01"
  },
  {
   "title": "Admissions FAQs Sept 2027 (PDF)",
   "url": "https://fra1.digitaloceanspaces.com/tiffingirls.org/wp-content/uploads/2026/03/13141601/FAQ-Sep27-%40-100226.pdf",
   "checked": "2026-11-01"
  },
  {
   "title": "Year 7 Admissions page",
   "url": "https://www.tiffingirls.org/admissions/year-7/",
   "checked": "2026-11-01"
  }
 ],
 "gaps": [
  "Ward-to-borough mapping is not stated in the policy; attributed from council ward lists (12 Kingston, 1 Richmond).",
  "No published split of the 180 offers between Inner Area and the rest of the Designated Area, and no lowest-qualifying-rank by area.",
  "2028-entry policy not yet published on the site (checked 2026-11-01); 2027 policy used."
 ]
};
