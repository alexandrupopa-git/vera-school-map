# Updates folder — how next year's numbers get in

Add rows here; never edit `schools.geojson` or `rents_all.csv` by hand. Then run
`python3 tools/build_data.py && python3 tools/build_exports.py` and open the map.

## cutoffs.csv — one row per school per year (primary and secondary)
| column | what |
|---|---|
| school_id | from `data/schools.js` (P-URN / S-URN), e.g. `P-102628`; leave blank if unsure and fill `school_name` exactly as in the map |
| year | entry year, e.g. 2027 |
| cutoff_km | furthest distance offered under the distance criterion, in km (miles × 1.609). Blank if none published |
| status | primary: `Oversubscribed – distance cut-off` · `Not oversubscribed – all applicants offered` · `Spare places` · `Oversubscribed – no distance published` · `Full – all on-time applicants offered`. Secondary: leave blank, fill `oversubscribed` (yes/no) |
| last_criterion | the criterion the last place went to (number or text as published) |
| pan, applications, offered | as published |
| notes, source_url | where the figure comes from (council offer-day table, school website) |

The build recomputes the 3-year window (latest year and the two before), the tightest/widest cut-offs,
comfort radii, "spare places" status, trends and every rating. Nothing else needs touching.

## results.csv — new Ofsted outcomes and DfE results
`field` is one of: `ks2_rwm_expected_2yr` (proportion, e.g. 0.78), `ks2_rwm_higher` (proportion),
`attainment8`, `pct_grade5_eng_maths`, `progress8`, `ofsted_latest` (text, e.g. `2027-03-10 — Good`),
`ofsted_last_graded` (e.g. `Good (2027-03-10)`), `pan_latest`. `as_of` = academic year or date.

## rents.csv — new rent data points
Same columns as `rents_all.csv`. One row per figure (ONS borough average, Hutch ward/district average,
listing sample). The map picks rows by postcode district/sector, so fill `postcode_districts`
(e.g. `KT2 5/6`, `SW19 3`, `AL4`).

## meta.json — ONS rent change, England averages, changelog
Update the rent-change table each autumn (ONS, year to September) and the England averages when the
DfE tables come out (October: KS4 provisional; December: KS2 revised). Add a line to the changelog.
