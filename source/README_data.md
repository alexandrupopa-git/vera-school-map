# Map data pack — school admissions, rents and commute (compiled 1 Nov 2026)

These files were exported from three workbooks. When a value differs between a file here and a workbook, the workbook is the source of truth:
- `Reception admissions - Epsom Ewell and St Albans.xlsx`
- `Reception admissions - London (2-bed).xlsx`
- `Secondary schools and long-term ranking.xlsx`

Coordinates are WGS84 (lon, lat in GeoJSON). Distances are in km and rents in £ per calendar month.

## Files

| File | What it holds |
|---|---|
| `schools.geojson` | 286 state schools: 171 primary/infant/junior and 115 secondary. Each school is a point with quality, admission rules, how distance is measured, and a year-by-year cut-off history (2023–2026). |
| `candidate_homes.geojson` | 77 candidate home locations ("spots") used in the workbooks. The 11 with `long_term_rank` are the shortlist, with rent, travel cost, summaries, risk and verdict. |
| `chance_of_place.csv` | Shortlist spot × nearby school, with a chance rating (High / Medium / Low / Very low / Test-dependent / Unknown) and the reason. Rule-based ratings are in "Rule-based chance". |
| `long_term_ranking.csv` | The ranking table (spot, counts of High/Medium schools, primary and secondary summaries, grammar route, rent, travel, total, risk, verdict). |
| `rents_all.csv` | Every rent data point collected: ONS borough averages, Hutch ward/district averages and Rightmove/Zoopla listing samples, with dates and URLs. Outside London the figures are 3-bed; in London they are 2-bed. |
| `special_admission_areas.geojson` | Circles for Nonsuch (5.25 km), Wallington (6.7 km) and West London Free School (2 miles). Also lists, with sources, the areas still to be drawn: Tiffin Designated/Inner Area, Merton priority areas, Waldegrave A/B, Herts priority area, Stamford Green catchment. |
| `commute_costs.csv` | Monthly Travelcard or season-ticket cost per area. |

## Key fields in `schools.geojson`

**Primary schools**
- `tightest_recent_cutoff_km` / `widest_recent_cutoff_km`: the smallest and largest "furthest distance offered" in 2024–2026, counting only years when the school was full.
- `comfort_radius_km` = 0.75 × the tightest cut-off. It is `"no cut-off"` when the school had spare places and `"no recent data"` when nothing was published.
- `demand_status`, plus `cutoff_history[]`: one entry per year with year, cutoff_km, status, last_criterion, PAN and applications.
- `good_school` = "Yes" when Ofsted is Good/Outstanding (or the report-card equivalent) **and** the 2-year KS2 reading, writing and maths (RWM) average is at least 61.5% (the England average).
- `faith_decides_places` = "Yes" when faith criteria decided places in a full year. These schools are excluded from the counts.
- `ks2_rwm_expected_2yr` is a proportion (0.78 = 78%). Infant schools use their linked junior school's KS2 results.

**Secondary schools**
- `selection_type` is one of:
  - comprehensive (optionally banded and/or with aptitude places)
  - grammar (fully selective)
  - partially selective (X% by academic test)
- Also: `gender`, `faith`.
- `main_route_cutoff`: either a number (the tightest 2024–26 offer-day distance), or `"everyone offered"`, or `"rules: …"` (decided by nearest school, feeder, priority area, lottery, bands, faith or test).
- Results: `attainment8_2026` and `pct_grade5_eng_maths_2026` are 2025/26 provisional. `progress8_2024` is 2023/24, the last year published. England averages: A8 46.2, grade 5+ English & maths 46.3%, Progress 8 −0.03.
- `strong_secondary` = A8 at least 5 points above England, with no weak Ofsted outcome.
- `allocation_history[]`: one entry per year.

**All schools**
- `distance_method` says how the local authority measures distance. This matters most in Richmond and Hounslow, which use the walking route; elsewhere it is mostly a straight line, but to different points: gate, entrance or centre.

## Chance rating (same rules as the workbooks)

| Rating | Primary | Secondary |
|---|---|---|
| High | inside 75% of the tightest recent cut-off, or every applicant offered | inside 85% of the tightest recent cut-off, or every applicant offered, or qualifies under the deciding rule |
| Medium | inside the tightest cut-off but not the margin | same, or a lottery, or ability-banded |
| Low | inside only the widest recent cut-off | same |
| Very low | outside every recent cut-off | same |
| Test-dependent | — | grammar or test places |

## Known gaps and caveats

- Distances are straight lines from school postcode centres; allow 100–200 m of error. Walking-route boroughs (Richmond, Hounslow) will be longer on foot.
- Richmond primary: 2024 and 2025 offer-day tables were not available (2021–23 and 2026 are in).
- Kingston Academy has no 2026 figure, and its measuring point moved to the Richmond Road boundary from 2026.
- Herts does not publish Sandringham's last distance.
- Several faith and academy schools publish no outcomes: Ursuline, Holy Cross, Harris Morden, Sacred Heart, West London Free School, and some Hammersmith & Fulham primaries.
- Rents are current asking/average rents, not 2028 rents. ONS annual change (year to Sep 2026):

  | Area | Change |
  |---|---|
  | Kingston | −0.4% |
  | Camden | +1.4% |
  | Lambeth | +3.4% |
  | Wandsworth | +4.1% |
  | Richmond | +5.4% |
  | Merton | +5.5% |
  | Epsom & Ewell (3-bed) | +4.6% |
  | St Albans (3-bed) | +3.1% |

- Cut-offs are history, not promises. Secondary entry is in 2036, so treat secondary cut-offs as indicative.
