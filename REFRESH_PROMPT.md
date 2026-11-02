# Prompt for next year's refresh session

Open a new Claude session with this repository attached (or the folder connected) and paste:

---

Refresh Vera's School Map with the latest data. Read `REFRESH.md` and `source/updates/README.md` first,
then work through the steps. Do not edit `source/schools.geojson` or `source/rents_all.csv`; put new
figures only in `source/updates/*.csv` and `source/updates/meta.json`.

1. Cut-offs: for every school in `data/schools.js`, find the [YEAR] entry offer-day figure (furthest
   distance offered under the distance criterion, or "all offered" / "spare places"), using the council
   and school sources recorded for that school (`source_admissions`, allocation-history `source` URLs).
   Add one row per school to `source/updates/cutoffs.csv` with the exact source URL. Convert miles to km.
   Never infer or average a distance; if a figure is not published, record the status and leave the
   distance blank. Flag changes to measuring points, PANs, criteria or priority areas.
2. Results and Ofsted: add changed Attainment 8, grade 5+ English & maths, Progress 8, KS2 RWM and Ofsted
   outcomes to `source/updates/results.csv`; update England averages in `meta.json`.
3. Rents: add new ONS borough 2-bed/3-bed averages and annual change, Hutch averages and listing samples
   (available and let agreed) for the same postcode sectors; update `meta.json` rent_change and
   changelog.
4. Rules: re-read the determined arrangements for every school in `data/rules.js` and update text or
   numbers that changed. Check the Tiffin Girls' Designated/Inner Area lists.
5. Run `python3 tools/build_data.py && python3 tools/build_exports.py`, then `node tools/verify.js`.
   Report every issue the build prints and every rating that changed at the 11 ranked spots, with the
   reason (cut-off moved, rule changed, new data).
6. Give me: a summary of what moved (which spots got safer or riskier and why), the list of schools
   where no new figure could be found, and anything that looked inconsistent. Then commit and push.

Rules: admissions figures only from official sources; every row carries its source URL and date; say
where you could not find something rather than filling the gap.

---

Replace [YEAR] with the entry year just published (e.g. 2027 in spring/summer 2027).
