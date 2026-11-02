# Vera's School Map

Interactive map for choosing where to rent in the UK from autumn 2028 so that one home works for
state Reception (Sept 2029) and Year 7 (Sept 2036).

## Open it

* **Laptop:** double-click `index.html`. Base map tiles, postcode lookup, live walking routes and street
  names need the internet; everything else works offline. Opened as a local file the base map is Esri's
  World Street Map (OpenStreetMap's own tile servers refuse requests from local files; switch to OSM on
  the hosted copy via the layers button, bottom-left).
* **Install as an app:** on the hosted copy, use the browser's "Add to Home Screen" / "Install" — the
  folder includes a web-app manifest and a small service worker, so it opens full-screen and the last
  loaded version works offline.
* **Phone / sharing with Irena:** host the folder on any free static host and open the link.
  Easiest: drag the whole folder onto <https://app.netlify.com/drop> (no account needed for a temporary
  site; free account to keep it), or push it to a GitHub repository and turn on GitHub Pages.
  GPS ("⌖ Me") needs an https link, which both give you.
* `guide.html` — one-screen "how to read this map". `sources.html` — every source with dates.
* `Vera_School_Map.kml` — import into Google My Maps (Create a new map → Import) for the zones,
  schools, parks and stations on your phone.

## Deploy

* **GitHub Pages:** push this folder to a repository's `main` branch; `.github/workflows/pages.yml` publishes it
  (Settings → Pages → Source: GitHub Actions). The site is public but unlisted.
* **Firebase Hosting:** `firebase.json` is included. Run `firebase login`, `firebase use <project>`, `firebase deploy`
  from this folder; or `firebase init hosting:github` once to deploy automatically from the GitHub repo.
* The assistant ("Ask about this spot") calls the Anthropic API from the browser with a key each user pastes once
  (stored in that browser only). To keep a single key server-side instead, put a small proxy (e.g. a Firebase
  function) in front of `api.anthropic.com` and point `chat.js` (`fetch('https://api.anthropic.com/v1/messages'…)`)
  at it.

## Yearly refresh

`REFRESH.md` is the runbook (what is published when, and the eight steps); `REFRESH_PROMPT.md` is a ready-made
prompt for a Claude session to do the look-ups. New figures go only into `source/updates/` — the build
recomputes the 3-year window, cut-offs, comfort radii and every rating.

## Update the data without rebuilding the app

The app reads plain JavaScript data files in `data/`, one per topic. Two ways to update:

1. **Edit the sources, rebuild the data.** Put the new cut-offs into `source/schools.geojson`
   (or re-export the data pack from the workbooks), rents into `source/rents_all.csv`, then run
   `python3 tools/build_data.py` and `python3 tools/build_exports.py`. Needs Python 3 only.
2. **Edit `data/*.js` directly** for a quick fix — they are readable JSON with a `window.SM_DATA.x = `
   prefix.

Hand-maintained files (not touched by the build): `data/config.js` (all thresholds and weights),
`data/rules.js` (typed rules for schools not decided by a plain distance cut-off, plus the Tiffin
Girls' areas), `data/extras.js` (Heathrow corridors, link templates, listing-site URL patterns),
`data/stations.js` and `data/parks.js` (research with sources; raw JSON in `source/`).

## Check the engine against the workbooks

`node tools/verify.js` compares the live chance ratings at the 11 ranked spots with
`chance_of_place.csv`. `node tools/functional.js` and `node tools/screenshot.js` drive the page in a
headless browser (needs Playwright).

## Files

```
index.html  app.css  app.js  panel.js  engine.js   the app (engine.js is the chance logic)
data/       data files loaded by the app
source/     the attached data pack + research JSON (inputs to tools/)
tools/      build_data.py, build_exports.py, verify.js, functional.js, screenshot.js
vendor/     Leaflet 1.9.4 (BSD-2)
```
