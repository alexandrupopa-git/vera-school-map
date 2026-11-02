# Yearly refresh — how to bring the map up to date

The map recomputes every rating from the rows in `source/`. A refresh is: add the new year's rows,
rebuild, check, deploy. Nothing in the app code changes. Budget: a few hours with Claude doing the
look-ups (see `REFRESH_PROMPT.md`), or a weekend by hand.

## When things are published

| What | When | Where |
|---|---|---|
| Reception offer-day tables (furthest distance offered) | national offer day 16 April; tables appear April–September | council admissions pages: Kingston, Richmond (AfC brochure, Sept), Merton (table PDF), Wandsworth, Lambeth, Camden/Brent; Surrey CC "Allocation of reception places"; Hertfordshire "allocation summary" |
| Secondary offer-day tables | national offer day 1 March; tables March–September | same councils (secondary); Sutton (Nonsuch/Wallington) page; school websites for own-admission academies |
| KS4 results (Attainment 8, grade 5+ English & maths) | October (provisional), January (revised) | DfE compare-school-performance / explore-education-statistics API (URLs per school in the data) |
| KS2 results (RWM expected standard) | September (provisional), December (revised) | same |
| Progress 8 | January | same |
| Ofsted | continuous | reports.ofsted.gov.uk (URL per school in the data) |
| ONS private rents and annual change | monthly; use September for the projection | ONS Price Index of Private Rents, local authority pages (URLs in rents_all.csv) |
| Hutch / listing samples | any time; take them the same week | Hutch area guides; Rightmove/Zoopla searches incl. let agreed |
| Admission arrangements (rule changes, PANs, areas) | determined by 28 February for entry 18 months later | council and school admissions pages |
| TfL fares | March | tfl.gov.uk fares |

## Steps

1. **Cut-offs.** For every school in `data/schools.js` (286), find the new year's furthest distance offered
   (or "all offered" / "spare places") and add one row to `source/updates/cutoffs.csv`. Columns and
   vocabulary are in `source/updates/README.md`. Convert miles to km (×1.609). Keep the source URL.
   Watch for: measuring-point changes (e.g. Kingston Academy 2026), PAN changes, new priority areas,
   schools becoming academies with new criteria, bulge classes.
2. **Results and Ofsted.** Add rows to `source/updates/results.csv` for changed figures. Update the
   England averages in `source/updates/meta.json`.
3. **Rents.** Add the new ONS borough averages and annual change (`meta.json`), fresh Hutch averages and
   listing samples for the same postcode sectors, to `source/updates/rents.csv`. Change the
   `compiled` date and add a changelog line in `meta.json`.
4. **Rules.** Re-read the determined admission arrangements for the rule-based schools in
   `data/rules.js` (Tiffin Girls' areas, Nonsuch/Wallington circles, Herts nearest-school and STAGS,
   Beaumont, Sandringham, Waldegrave, Turing House nodal point, WLFS ballot, Ark Bolingbroke feeders,
   banded schools) and edit the text or numbers there if anything changed.
5. **Build:** `python3 tools/build_data.py && python3 tools/build_exports.py`. Read the "issues"
   lines it prints (unmatched rows, inconsistent figures).
6. **Check:** `node tools/verify.js` compares the live ratings with `chance_of_place.csv` (the 2026
   workbook ratings) — differences are expected where cut-offs moved; read them, don't aim for 100%.
   Then open the map, drop pins on the ranked spots, and read the trends.
7. **Thresholds.** `data/config.js`: KS2 and A8 bars follow the England averages via `meta.json`;
   budgets, comfort factors and weights only if you want to change them. `latest_year` is detected
   from the data.
8. **Deploy:** commit and push (GitHub Pages redeploys automatically) or `firebase deploy`.

## Adding a new area

Add researched spots to `source/candidate_homes.geojson` (name with postcode sector, lat/lon, region),
schools to `source/schools.geojson` (copy an existing feature's shape; the build recomputes windows), rent
rows with the area's postcode districts, stations to `source/stations.json` and parks to
`source/parks.json`, then rebuild. The hex surface and zones follow automatically.

## What to re-verify every year, whatever the data says

- Richmond and Hounslow still measure the walking route (and which schools are exceptions).
- Tiffin Girls' Designated/Inner Area lists and place rules (each year's determined arrangements; entry is 2036, so treat as direction of travel).
- Hertfordshire priority areas and "nearest school" rules; Beaumont's radius.
- Merton priority areas (Dundonald/Wimbledon Chase, Wimbledon Park) and Stamford Green's catchment map.
- Heathrow: any change to runway alternation or approach paths.
