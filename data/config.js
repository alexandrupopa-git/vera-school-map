// Adjustable rules. These are the workbooks' Settings-sheet values; the app lets you change
// the starred ones live, and this file sets the defaults that the URL does not override.
window.SM_DATA = window.SM_DATA || {};
window.SM_DATA.config = {
  // --- chance rating (workbook rules) ---
  comfort_primary: 0.75,        // * High = inside 75% of the tightest recent cut-off (Reception)
  comfort_secondary: 0.85,      // * High = inside 85% of the tightest recent cut-off (Year 7)
  stress_pct: 0,                // * stress test: shrink every cut-off by this many percent
  walk_cap_london_km: 1.5,      // good primary with spare places counts only within this (London workbook)
  walk_cap_outside_km: 2.0,     // same, Epsom & Ewell / St Albans workbook
  sec_open_reach_km: 5.0,       // a secondary that offered everyone counts within this straight-line distance
  max_real_cutoff_km: 5.0,      // a published distance above this means everyone got in
  recent_window_years: 3,       // 2024–2026 with the latest year 2026
  latest_year: 2026,
  // --- quality bars ---
  ks2_bar: 0.615,               // * good primary: 2-yr KS2 RWM at or above England (61.5%)
  a8_bar_offset: 5,             // * strong secondary: Attainment 8 at least this far above England
  england_a8: 46.2, england_g5: 46.3, england_p8: -0.03,
  // --- distance method ---
  walking_factor: 1.25,          // * multiply the straight line by this where the council measures the walking route
                                //   (Richmond, Hounslow). The workbooks used straight line + a warning; 1.25 is a typical
                                //   urban road/straight-line ratio and is Claude's default; where the line crosses the Thames the
                                //   route is taken via the nearest bridge first, not a council figure. Live
                                //   walking distances from OSRM replace it for a dropped pin when the network allows.
  // --- judgement thresholds for schools with unpublished distances (not data; see rules.js) ---
  unpublished_high_km: 0.5,     // "High (likely)" within this (Sandringham, per the workbook's judgement)
  unpublished_medium_km: 1.7,   // "Medium (likely)" within this
  banded_medium_km: 4.0,        // ability-banded comprehensives with no published band distances: Medium within this, Low to banded_low_km
  banded_low_km: 6.0,
  // --- sweet-spot score weights ---
  w_prim_high: 2, w_prim_med: 1, w_sec_high: 3, w_sec_med: 1.5, w_grammar: 0.5,  // *
  count_girls_schools: true,    // * Vera is a girl; girls' schools count. Turn off for "mixed only".
  count_faith: false,           // * schools where faith criteria decide places do not count (workbook rule)
  count_partially_selective: true, // partially selective schools count on their non-test places
  // --- money ---
  budget_preferred: 2500, budget_max: 3000,
  projection_years: 2,          // late 2026 -> autumn 2028
  // --- commute ---
  walk_speed_kmh: 4.8, station_buffer_min: 5, far_end_min: 10,
  destinations: ['Waterloo', 'Victoria', 'London Bridge', 'Bank', "King's Cross St Pancras"],
  // --- hex surface ---
  hex_m_fine: 300, hex_m_coarse: 650, hex_zoom_fine: 13,
  // --- regions: bounding boxes for the hex surface (lat/lon), padded around the researched schools ---
};
