#!/usr/bin/env python3
"""Build export files: Vera_School_Map.kml (Google My Maps), sources.html. Run after build_data.py.
Zones are computed here with the same rule as the app (intersection of comfort discs of High-rated
counting schools at each ranked spot) using a small port of the engine's distance logic."""
import json, os, math, html, re, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def load(name, prop):
    t = open(os.path.join(ROOT, 'data', name), encoding='utf-8').read()
    return json.loads(t[t.index('.%s = ' % prop) + len(prop) + 4:].rstrip().rstrip(';'))
schools = load('schools.js', 'schools'); homes = load('homes.js', 'homes'); parks = load('parks.js', 'parks')
stations = load('stations.js', 'stations'); rents = load('rents.js', 'rents'); areas = load('areas.js', 'areas'); meta = load('meta.js', 'meta')
chance_ref = load('chance_ref.js', 'chance_ref'); commute = load('commute_costs.js', 'commute_costs')
cfg_txt = open(os.path.join(ROOT, 'data', 'config.js'), encoding='utf-8').read()
def cfg(k, default):
    m = re.search(r'\b%s:\s*([\d.]+)' % k, cfg_txt); return float(m.group(1)) if m else default
CF_P, CF_S, WALK_F, CAP_L, CAP_O, SEC_OPEN = cfg('comfort_primary', .75), cfg('comfort_secondary', .85), cfg('walking_factor', 1.25), cfg('walk_cap_london_km', 1.5), cfg('walk_cap_outside_km', 2), cfg('sec_open_reach_km', 5)
R = 6371.0088
def hav(a, b, c, d):
    p = math.pi / 180; dl, dn = (c - a) * p, (d - b) * p
    x = math.sin(dl / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin(dn / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))
def dest(lat, lon, brg, km):
    d = km / R; b = brg * math.pi / 180; la1 = lat * math.pi / 180; lo1 = lon * math.pi / 180
    la2 = math.asin(math.sin(la1) * math.cos(d) + math.cos(la1) * math.sin(d) * math.cos(b))
    lo2 = lo1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(la1), math.cos(d) - math.sin(la1) * math.sin(la2))
    return la2 * 180 / math.pi, lo2 * 180 / math.pi

# --- zones: use the workbook's High ratings (chance_ref) for the ranked spots, discs = comfort radii
def zone_for(h, london):
    discs = []
    rows = [r for r in chance_ref if r['home'] == h['name'] and r['chance'].lower().startswith('high')]
    for r in rows:
        s = next((s for s in schools if s['name'].lower()[:20] == r['school'].lower()[:20]), None)
        if not s: continue
        if (s['phase'] == 'P' and not s['good']) or (s['phase'] == 'S' and not s['strong']): continue
        if s.get('faith_decides'): continue
        cf = CF_P if s['phase'] == 'P' else CF_S
        if s['mode'] == 'cutoff' and s.get('tight') and not (s['id'] in ('S-138286',)): rad = s['tight'] * cf
        elif s['mode'] == 'open': rad = SEC_OPEN if s['phase'] == 'S' else (CAP_L if london else CAP_O)
        elif s['id'] == 'S-138286': rad = 0.686 * cf
        else: continue
        discs.append((s['name'], s['lat'], s['lon'], rad, WALK_F if (s.get('walking') and s['mode'] != 'open') else 1))
    # keep only discs that contain the spot itself (the app's live engine may rate a walking-route school lower than the workbook did)
    discs = [d for d in discs if hav(h['lat'], h['lon'], d[1], d[2]) * d[4] <= d[3]]
    if not discs: return None, []
    pts = []
    for i in range(90):
        brg = i * 4; lo, hi = 0, 6
        def ok(km):
            p = dest(h['lat'], h['lon'], brg, km)
            return all(hav(p[0], p[1], d[1], d[2]) * d[4] <= d[3] for d in discs)
        if not ok(0): return None, discs
        for _ in range(18):
            mid = (lo + hi) / 2
            if ok(mid): lo = mid
            else: hi = mid
        pts.append(dest(h['lat'], h['lon'], brg, lo))
    return pts, discs

# ------------------------------------------------------------ KML
def esc(s): return html.escape(str(s if s is not None else ''), quote=False)
def cdata(s): return '<![CDATA[' + str(s).replace(']]>', ']]&gt;') + ']]>'
kml = ['<?xml version="1.0" encoding="UTF-8"?>', '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>',
       "<name>Vera's School Map — zones, schools, spots</name>",
       '<description>%s</description>' % cdata('Exported %s from the map data pack (compiled %s). Chances are history, not promises. Import into Google My Maps: each folder becomes a layer.' % (datetime.date.today().isoformat(), meta['compiled'])),
       '<Style id="zone"><LineStyle><color>ff8c6f0f</color><width>3</width></LineStyle><PolyStyle><color>338c6f0f</color></PolyStyle></Style>',
       '<Style id="spot"><IconStyle><scale>1.3</scale><Icon><href>https://maps.google.com/mapfiles/kml/paddle/blu-blank.png</href></Icon></IconStyle></Style>',
       '<Style id="pgood"><IconStyle><scale>0.9</scale><color>ff5b8a1f</color><Icon><href>https://maps.google.com/mapfiles/kml/shapes/schools.png</href></Icon></IconStyle></Style>',
       '<Style id="pother"><IconStyle><scale>0.7</scale><color>ffa6b39b</color><Icon><href>https://maps.google.com/mapfiles/kml/shapes/schools.png</href></Icon></IconStyle></Style>',
       '<Style id="sstrong"><IconStyle><scale>1.0</scale><color>ffc9552d</color><Icon><href>https://maps.google.com/mapfiles/kml/shapes/schools.png</href></Icon></IconStyle></Style>',
       '<Style id="sother"><IconStyle><scale>0.8</scale><color>ffddae9a</color><Icon><href>https://maps.google.com/mapfiles/kml/shapes/schools.png</href></Icon></IconStyle></Style>',
       '<Style id="grammar"><IconStyle><scale>1.1</scale><color>ff17a0d4</color><Icon><href>https://maps.google.com/mapfiles/kml/shapes/schools.png</href></Icon></IconStyle></Style>',
       '<Style id="park"><IconStyle><scale>0.9</scale><Icon><href>https://maps.google.com/mapfiles/kml/shapes/parks.png</href></Icon></IconStyle></Style>',
       '<Style id="station"><IconStyle><scale>0.8</scale><Icon><href>https://maps.google.com/mapfiles/kml/shapes/rail.png</href></Icon></IconStyle></Style>',
       '<Style id="rule"><LineStyle><color>ffb03f7a</color><width>2</width></LineStyle><PolyStyle><color>10b03f7a</color></PolyStyle></Style>']
def coords(pts): return ' '.join('%.6f,%.6f,0' % (p[1], p[0]) for p in pts) + ' %.6f,%.6f,0' % (pts[0][1], pts[0][0])
# folder 1: ranked spots + zones
kml.append('<Folder><name>Ranked spots and search zones</name>')
zone_summary = []
for h in sorted([h for h in homes if h.get('rank')], key=lambda h: h['rank']):
    london = h['region'] not in ('Epsom & Ewell', 'St Albans')
    desc = '<b>#%d</b> %s<br><b>Verdict:</b> %s<br><b>Primary:</b> %s<br><b>Secondary:</b> %s<br><b>Grammar route:</b> %s<br><b>Rent now:</b> £%s pcm (%s) · travel £%s · total £%s<br><b>Main risk:</b> %s' % (
        h['rank'], h['name'], h['verdict'], h['primary'], h['secondary'], h['grammar'], h['rent'], h['property'], h['travel'], h.get('total'), h['risk'])
    kml.append('<Placemark><name>#%d %s</name><styleUrl>#spot</styleUrl><description>%s</description><Point><coordinates>%.6f,%.6f,0</coordinates></Point></Placemark>' % (h['rank'], esc(h['name']), cdata(desc), h['lon'], h['lat']))
    pts, discs = zone_for(h, london)
    if pts:
        zone_summary.append((h, discs))
        kml.append('<Placemark><name>Zone #%d — %s</name><styleUrl>#zone</styleUrl><description>%s</description><Polygon><outerBoundaryIs><LinearRing><coordinates>%s</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>' % (
            h['rank'], esc(h['name'].split(' — ')[-1]), cdata('Streets from which every High-rated key school stays inside its comfort radius (%d%% / %d%% of the tightest recent cut-off): ' % (CF_P * 100, CF_S * 100) + ', '.join(d[0] for d in discs) + '. Straight-line discs; walking-route schools scaled ×%.2f.' % WALK_F), coords(pts)))
kml.append('</Folder>')
# folder 2: other researched spots
kml.append('<Folder><name>Other researched spots</name>')
for h in homes:
    if h.get('rank'): continue
    kml.append('<Placemark><name>%s</name><description>%s</description><Point><coordinates>%.6f,%.6f,0</coordinates></Point></Placemark>' % (esc(h['name']), cdata('Researched spot (%s). Not in the long-term shortlist.' % h['region']), h['lon'], h['lat']))
kml.append('</Folder>')
# folders 3/4: schools
def hist_txt(s):
    out = []
    for hh in s['hist']:
        y = hh.get('year') or hh.get('year_label'); km = hh.get('km')
        out.append('%s: %s' % (y, ('%.2f km' % km) if isinstance(km, (int, float)) else (hh.get('status') or hh.get('crit') or 'no distance')))
    return ' · '.join(out)
for phase, title in (('P', 'Primary schools'), ('S', 'Secondary schools')):
    kml.append('<Folder><name>%s</name>' % title)
    for s in schools:
        if s['phase'] != phase: continue
        if phase == 'P':
            style = 'pgood' if s['good'] else 'pother'
            d = '%s · %s · Ofsted %s · KS2 RWM %s%s<br>Cut-offs: tightest %s km, widest %s km (2024–26) · comfort radius %s<br>%s<br>Measured: %s%s<br>%s' % (
                s.get('phase_detail') or 'Primary', s['type'], s['ofsted'], ('%d%%' % round(s['ks2'] * 100)) if s.get('ks2') is not None else 'n/a', ' · <b>good primary</b>' if s['good'] else '',
                s.get('tight') or '–', s.get('wide') or '–', ('%.2f km' % (s['tight'] * CF_P)) if s.get('tight') else s['mode'], hist_txt(s), s['dist_method'], ' <b>(walking route)</b>' if s.get('walking') else '', s.get('criteria') or '')
        else:
            style = 'grammar' if s['sel_short'] == 'grammar' else ('sstrong' if s['strong'] else 'sother')
            d = '<b>%s</b> · %s%s · Ofsted %s · A8 %s · 5+ E&M %s · P8 %s%s<br>Main-route cut-off: %s%s<br>%s<br>Measured: %s%s' % (
                s['sel_short'], s['gender'], (' · ' + s['faith']) if s.get('is_faith') else '', s['ofsted'], s.get('a8'), s.get('g5'), s.get('p8'), ' · <b>strong secondary</b>' if s['strong'] else '',
                ('%.2f km (tightest), %.2f km (widest)' % (s['tight'], s['wide'])) if s.get('tight') else (s.get('rule') or s['mode']), (' — ' + s['basis']) if s.get('basis') else '', hist_txt(s), s['dist_method'], ' <b>(walking route)</b>' if s.get('walking') else '')
        src = s.get('src') or {}
        d += '<br>Sources: ' + ' · '.join('<a href="%s">%s</a>' % (esc(u.split(';')[0].strip()), k) for k, u in src.items() if u)
        kml.append('<Placemark><name>%s</name><styleUrl>#%s</styleUrl><description>%s</description><Point><coordinates>%.6f,%.6f,0</coordinates></Point></Placemark>' % (esc(s['name']), style, cdata(d), s['lon'], s['lat']))
    kml.append('</Folder>')
# folder 5: rule circles
kml.append('<Folder><name>Grammar / ballot rule areas</name>')
for a in areas:
    if not a.get('polygon'): continue
    kml.append('<Placemark><name>%s</name><styleUrl>#rule</styleUrl><description>%s</description><Polygon><outerBoundaryIs><LinearRing><coordinates>%s</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>' % (esc(a['name']), cdata(a['rule'] + ' (' + (a.get('quality') or '') + ')'), coords([(c[0], c[1]) for c in a['polygon']])))
kml.append('</Folder>')
# folder 6/7: parks, stations
kml.append('<Folder><name>Off-lead parks</name>')
for p in parks['parks']:
    kml.append('<Placemark><name>%s</name><styleUrl>#park</styleUrl><description>%s</description><Point><coordinates>%.6f,%.6f,0</coordinates></Point></Placemark>' % (esc(p['name']), cdata('%s<br>Off lead: %s<br>%s<br>%s · <a href="%s">source</a> (%s)' % (p['area'], p['off_lead'], p.get('notes') or '', p.get('managed_by') or '', p['source'], p['checked'])), p['lon'], p['lat']))
kml.append('</Folder><Folder><name>Stations (peak times to London)</name>')
for st in stations['stations']:
    t = st.get('times') or {}
    kml.append('<Placemark><name>%s</name><styleUrl>#station</styleUrl><description>%s</description><Point><coordinates>%.6f,%.6f,0</coordinates></Point></Placemark>' % (esc(st['name']), cdata('Zone %s · %s<br>' % (st.get('zone'), st.get('lines') or '') + ' · '.join('%s %s min' % (k, v['min']) for k, v in t.items() if v and v.get('min') is not None) + '<br>TfL Journey Planner, arrive by 08:45 Mon 3 Nov 2026 (checked %s)' % stations.get('checked')), st['lon'], st['lat']))
kml.append('</Folder></Document></kml>')
open(os.path.join(ROOT, 'Vera_School_Map.kml'), 'w', encoding='utf-8').write('\n'.join(kml))
print('kml ok; zones:', len(zone_summary))

# ------------------------------------------------------------ sources.html
rows = []
def row(cat, what, url, date, note=''):
    rows.append((cat, what, url, date, note))
row('Workbooks', 'Secondary schools and long-term ranking.xlsx (ranking, chance ratings, secondary allocations)', '', '1 Nov 2026', 'source of truth for admissions')
row('Workbooks', 'Reception admissions – London (2-bed).xlsx', '', '1 Nov 2026', '')
row('Workbooks', 'Reception admissions – Epsom Ewell and St Albans.xlsx', '', '1 Nov 2026', '')
row('Workbooks', 'Map data pack (schools.geojson, candidate_homes.geojson, chance_of_place.csv, rents_all.csv, special_admission_areas.geojson, commute_costs.csv)', '', 'compiled 1 Nov 2026', 'README_data.md lists known gaps')
for s in schools:
    src = s.get('src') or {}
    if src.get('ofsted'): row('Schools — Ofsted', s['name'], src['ofsted'].split(';')[0].strip(), s.get('ofsted_latest', '')[:10] if s.get('ofsted_latest') else '', s['ofsted'])
    if src.get('results'): row('Schools — results (DfE)', s['name'], src['results'].split(';')[0].strip(), '2025/26 provisional (KS4) / 2024/25 revised (KS2)', '')
    if src.get('admissions'): row('Schools — admissions', s['name'], src['admissions'], 'latest year 2026', s['dist_method'])
    if s['phase'] == 'S':
        for hh in s['hist']:
            if hh.get('source'): row('Schools — allocation data', '%s %s' % (s['name'], hh.get('year_label')), hh['source'], str(hh.get('year_label')), (hh.get('notes') or '')[:140])
for r in rents['rows']:
    if r.get('url'): row('Rents', '%s — %s' % (r['area'], r['metric']), r['url'], r['date'], (r.get('notes') or '')[:140])
row('Rents', 'ONS annual rent change by borough (used for 2028 projections)', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/latest', 'year to Sep 2026, published 21 Oct 2026', 'Kingston −0.4%, Camden +1.4%, Lambeth +3.4%, Wandsworth +4.1%, Richmond +5.4%, Merton +5.5%, Epsom & Ewell +4.6%, St Albans +3.1%')
for c in commute: row('Commute — tickets', '%s (%s)' % (c['area'], c['ticket']), c['source'] if c['source'].startswith('http') else '', c['source'], '£%s/month' % c['monthly_cost_gbp'])
for st in stations['stations']:
    for sc in st.get('sources') or []:
        row('Commute — stations & times', '%s — %s' % (st['name'], sc.get('what', '')), sc.get('url', ''), sc.get('checked', ''), '')
row('Commute — method', stations['method']['journey_times'][:300], 'https://api.tfl.gov.uk/', stations.get('checked', ''), stations['method'].get('season_tickets', '')[:200])
for p in parks['parks']: row('Parks & dogs', '%s (%s)' % (p['name'], p['area']), p['source'], p['checked'], p['off_lead'][:140])
for c in parks['council_rules']: row('Parks & dogs — council rules', c['council'], c['source'].split(';')[0].strip(), parks.get('checked', ''), c['rule'][:160])
tiff = json.load(open(os.path.join(ROOT, 'source', 'tiffin_areas.json'), encoding='utf-8'))
for sc in tiff['sources']: row("Tiffin Girls' areas", sc['title'], sc['url'], sc['checked'], '')
for a in areas: row('Rule areas', a['name'], a.get('source') or '', 'from the data pack', a.get('quality') or '')
import subprocess
ext = json.loads(subprocess.check_output(['node', '-e', "const w={SM_DATA:{}};const vm=require('vm');vm.runInNewContext(require('fs').readFileSync(process.argv[1],'utf8'),{window:w});console.log(JSON.stringify(w.SM_DATA.extras))", os.path.join(ROOT, 'data', 'extras.js')]))
for sc in ext['heathrow']['sources']: row('Heathrow (approximate corridors)', sc['name'], sc['url'], 'link-out', 'corridors are Claude-drawn approximations')
for k, u in ext['links']['admissions_maps'].items(): row('Admission area maps (not drawn)', k, u, 'link-out', '')
for l in ext['links']['risk']: row('Risk layers (link-outs)', l['name'], l['url'].split('{')[0], 'link-out', l.get('note', ''))
for s in ext['listing_sites']: row('Rental listing links', s['name'], s['url'].split('?')[0], 'checked 1 Nov 2026', s.get('verified', ''))
row('Map', 'OpenStreetMap tiles and data', 'https://www.openstreetmap.org/copyright', '', '© OpenStreetMap contributors; Leaflet 1.9.4')
row('Map', 'postcodes.io (postcode lookup, live)', 'https://postcodes.io/', 'live', 'Open Government Licence (ONS Postcode Directory)')
row('Map', 'OSRM demo server (live walking/road route distances)', 'https://project-osrm.org/', 'live', 'best-effort public server; falls back to straight line × factor')
row('Map', 'Nominatim (street names for zone edges, live)', 'https://nominatim.org/', 'live', 'few requests per zone, per usage policy')

cats = []
for r in rows:
    if r[0] not in cats: cats.append(r[0])
out = ['<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sources — Vera\'s School Map</title>',
       '<style>body{font:14px/1.45 -apple-system,"IBM Plex Sans",Segoe UI,sans-serif;max-width:1100px;margin:0 auto;padding:16px;color:#18212b}h1{font-size:22px}h2{font-size:16px;margin-top:28px;border-bottom:1px solid #dde3e9;padding-bottom:4px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{text-align:left;vertical-align:top;padding:4px 6px;border-bottom:1px solid #eef1f4}th{color:#7b8794;font-weight:500}a{color:#0f6f8c}.n{color:#7b8794}@media(prefers-color-scheme:dark){body{background:#121a22;color:#e8edf2}td,th{border-color:#2a3745}a{color:#4fb3cf}}</style></head><body>',
       '<h1>Sources and dates</h1><p>Every figure on the map traces to one of these. Admissions figures come only from the three workbooks and the official sources they cite; nothing was averaged or extrapolated. Generated %s.</p>' % datetime.date.today().isoformat(),
       '<p><a href="index.html">← back to the map</a> · <a href="guide.html">how to read the map</a></p>']
out.append('<p>Contents: ' + ' · '.join('<a href="#c%d">%s</a>' % (i, esc(c)) for i, c in enumerate(cats)) + '</p>')
for i, c in enumerate(cats):
    out.append('<h2 id="c%d">%s</h2><table><thead><tr><th>What</th><th>Source</th><th>Date</th><th>Note</th></tr></thead><tbody>' % (i, esc(c)))
    for r in rows:
        if r[0] != c: continue
        link = ('<a href="%s" target="_blank" rel="noopener">%s</a>' % (esc(r[2]), esc(r[2][:70] + ('…' if len(r[2]) > 70 else '')))) if r[2] else '<span class="n">attached file</span>'
        out.append('<tr><td>%s</td><td>%s</td><td>%s</td><td class="n">%s</td></tr>' % (esc(r[1]), link, esc(r[3]), esc(r[4])))
    out.append('</tbody></table>')
out.append('</body></html>')
open(os.path.join(ROOT, 'sources.html'), 'w', encoding='utf-8').write('\n'.join(out))
print('sources rows', len(rows))
# zone summary for README
with open(os.path.join(ROOT, 'tools', 'zones_summary.txt'), 'w', encoding='utf-8') as f:
    for h, discs in zone_summary:
        f.write('#%d %s: %s\n' % (h['rank'], h['name'], '; '.join('%s (%.2f km%s)' % (d[0], d[3], ', walking ×%.2f' % d[4] if d[4] != 1 else '') for d in discs)))
print(open(os.path.join(ROOT, 'tools', 'zones_summary.txt')).read())
