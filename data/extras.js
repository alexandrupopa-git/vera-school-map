// Hand-maintained extras: Heathrow corridors (approximate), risk/daily-life link templates, Thames note.
window.SM_DATA = window.SM_DATA || {};
window.SM_DATA.extras = {
  heathrow: {
    note: "Approximate corridors drawn by Claude from runway alignments (runways 27L/27R run east–west at about 51.465°N and 51.478°N). On westerly days (about 70% of the year) arrivals fly the final approach from the east along these lines over Barnes, East Sheen, Mortlake, Kew, Richmond and Isleworth; on easterly days departures climb east and fan out over Richmond, Twickenham, Kingston and Wimbledon. This is NOT a noise contour. Check the official maps before signing: Heathrow noise maps and WebTrak (live flight tracks).",
    sources: [
      { name: 'Heathrow — noise and flight paths', url: 'https://www.heathrow.com/company/local-community/noise' },
      { name: 'WebTrak (live/recent flight tracks over your address)', url: 'https://webtrak.emsbk.com/lhr3' },
      { name: 'Heathrow Noise Action Plan / contour maps', url: 'https://www.heathrow.com/company/local-community/noise/reports-and-statistics' }
    ],
    // [lat, lon] rings; approach corridors are ±1.3 km around each runway centreline, from the airport to about 18 km east
    corridors: [
      { name: 'Westerly approach — southern runway (27L)', kind: 'approach', poly: [[51.4765,-0.4330],[51.4765,-0.1400],[51.4530,-0.1400],[51.4530,-0.4330]] },
      { name: 'Westerly approach — northern runway (27R)', kind: 'approach', poly: [[51.4895,-0.4330],[51.4895,-0.1400],[51.4660,-0.1400],[51.4660,-0.4330]] },
      { name: 'Easterly departures — fan (about 30% of days)', kind: 'departure', poly: [[51.4720,-0.4330],[51.4950,-0.3000],[51.4800,-0.1900],[51.4300,-0.2000],[51.3950,-0.3100],[51.4400,-0.4100]] }
    ]
  },
  // Link templates. {lat} {lon} {pc} (postcode, URL-encoded) {pcq} (postcode with space as +)
  links: {
    risk: [
      { name: 'Flood risk (Environment Agency, long-term, by postcode)', url: 'https://check-long-term-flood-risk.service.gov.uk/postcode', needs: 'pc', note: 'paste the postcode' },
      { name: 'Flood map for planning (EA zones 2/3)', url: 'https://flood-map-for-planning.service.gov.uk/', needs: 'pc', note: 'paste the postcode' },
      { name: 'Road/rail/air noise — Defra strategic noise maps', url: 'https://extrium.co.uk/noiseviewer.html', note: 'search the postcode in the viewer' },
      { name: 'Heathrow flight tracks — WebTrak', url: 'https://webtrak.emsbk.com/lhr3' },
      { name: 'Air quality — London Air (annual maps)', url: 'https://www.londonair.org.uk/london/asp/annualmaps.asp', london: true },
      { name: 'Air quality — Defra UK-AIR (outside London)', url: 'https://uk-air.defra.gov.uk/', outside: true },
      { name: 'Crime — police.uk, your area', url: 'https://www.police.uk/pu/your-area/?q={pcq}', needs: 'pc' }
    ],
    life: [
      { name: 'Street View here', url: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat},{lon}' },
      { name: 'OpenStreetMap (shops, cafés, playgrounds)', url: 'https://www.openstreetmap.org/#map=17/{lat}/{lon}' },
      { name: 'Cycle map (OpenCycleMap)', url: 'https://www.opencyclemap.org/?zoom=15&lat={lat}&lon={lon}' },
      { name: 'TfL Cycleways map', url: 'https://tfl.gov.uk/maps/cycle', london: true },
      { name: 'Nurseries & childminders — Ofsted search', url: 'https://reports.ofsted.gov.uk/search?q=&location={pcq}&radius=1', needs: 'pc' },
      { name: 'Childcare & 30-hours funding — GOV.UK', url: 'https://www.gov.uk/find-free-early-education' },
      { name: 'GP surgeries — NHS', url: 'https://www.nhs.uk/service-search/find-a-gp/results/{pcq}', needs: 'pc' },
      { name: 'Libraries, pools, playgrounds — OSM', url: 'https://www.openstreetmap.org/#map=16/{lat}/{lon}' }
    ],
    commute: [
      { name: 'Google Maps transit from here to {dest}', url: 'https://www.google.com/maps/dir/?api=1&origin={lat},{lon}&destination={destq}&travelmode=transit' },
      { name: 'TfL Journey Planner', url: 'https://tfl.gov.uk/plan-a-journey/?InputFrom={lat},{lon}&InputTo={destq}', london: true }
    ],
    schools: [
      { name: 'Get Information about Schools', url: 'https://www.get-information-schools.service.gov.uk/Establishments/Establishment/Details/{urn}' },
      { name: 'DfE performance tables', url: 'https://www.compare-school-performance.service.gov.uk/school/{urn}' }
    ],
    admissions_maps: {
      'Dundonald': 'https://merton.gov.uk/education-and-learning/schools/admissions/primary/wimbledon-chase-priority-area',
      'Wimbledon Chase': 'https://merton.gov.uk/education-and-learning/schools/admissions/primary/wimbledon-chase-priority-area',
      'Wimbledon Park': 'https://merton.gov.uk/education-and-learning/schools/admissions/primary/wimbledon-park-priority-area',
      'Waldegrave': 'https://waldegrave.richmond.sch.uk/wp-content/uploads/2025/05/Waldegrave-Catchment-v2-1-compressed-2.pdf',
      'Stamford Green': 'https://www.surreycc.gov.uk/schools-and-learning/schools/admissions/arrangements-and-outcomes/previous-years',
      'Hertfordshire': 'https://www.hertfordshire.gov.uk/services/schools-and-education/school-admissions/',
      'Tiffin': 'https://fra1.digitaloceanspaces.com/tiffingirls.org/wp-content/uploads/2026/09/02143656/Patterns-of-Admission-2024-26.pdf'
    }
  },
  // Rental-site link builders. Verified status is recorded in sources.html.
  listing_sites: [
    { name: 'Rightmove', landing: true, pets: false, letagreed: false, verified: 'opens the lettings landing page (deep links to results need an internal location id)',
      url: 'https://www.rightmove.co.uk/property-to-rent.html',
      note: 'Paste the postcode, set radius 0.5 mi, bedrooms and price; tick "Include let agreed" to read the real market. No pets filter.' },
    { name: 'Zoopla', pets: true, letagreed: true, verified: 'URL pattern is Zoopla\'s standard one; could not be opened from the build environment (robots), so check the filters once',
      url: 'https://www.zoopla.co.uk/to-rent/property/{pcslug}/?beds_min={beds}&beds_max={beds}&price_max={max}&price_frequency=per_month&radius={radius}&q={pcq}&search_source=to-rent{pets}{letagreed}',
      pets_param: '&pets_allowed=true', letagreed_param: '&include_rented=true', note: 'Check that "Pets allowed" and "Include let agreed" are ticked; Zoopla may ignore URL filters it does not recognise.' },
    { name: 'OpenRent', pets: true, letagreed: false, verified: 'opens filtered results for the postcode (checked 1 Nov 2026: 138 properties for KT2, 2-bed, ≤£2,500); pets filter not applied from the URL',
      url: 'https://www.openrent.co.uk/properties-to-rent/{pcslug}?term={pcq}&prices_max={max}&bedrooms_min={beds}&bedrooms_max={beds}&isLive=true',
      note: 'Live listings only (no let-agreed view). Tick "Accept pets" on the page.' },
    { name: 'OnTheMarket', pets: false, letagreed: true, verified: 'standard OnTheMarket URL pattern; could not be opened from the build environment (robots)',
      url: 'https://www.onthemarket.com/to-rent/property/{pcslug}/?max-price={max}&min-bedrooms={beds}&max-bedrooms={beds}&radius={radius}{letagreed}',
      letagreed_param: '&let-agreed=true', note: 'No pets filter in the URL; use the "Pets allowed" feature filter on the page.' }
  ]
};
