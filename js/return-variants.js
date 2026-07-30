// Pre-built return-route variants, read by js/itinerary-render.js. Each
// variant lists ONLY the day-cards that differ from the current default
// (Kansas) itinerary already in itinerary.html's static markup -- the
// outbound leg and Vegas days are identical across every variant (except
// B1, which drops one Vegas day) and are never re-encoded here.
//
// `replaceDays`: cards whose id already exists in the static HTML -- the
// renderer swaps that card's outerHTML in place, so unaffected neighboring
// cards are never touched.
// `appendDays`: brand-new cards with an id that doesn't exist yet (only
// variant A needs this, for the extended Aug 11 fly-home day).
//
// `tripData` on each entry mirrors one js/trip-data.js TRIP_DAYS row (city/
// state/lat/lon/driveMiles/chargeStop) so the itinerary page's weather
// strips show the correct city once a variant is applied.
window.RETURN_VARIANTS = {
  A: {
    label: "Extend to 12 days",
    totalDays: 12,
    heroDate: "Jul 31 - Aug 11, 2026",
    footerDate: "Jul 31 - Aug 11, 2026",
    replaceDays: [
      {
        id: "day-2026-08-08",
        date: "2026-08-08",
        dateLabel: "Sat, Aug 8",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Grand Junction → Denver area, CO",
        miles: "~245 mi",
        wake: true,
        bullets: [
          "West on I-70 through Glenwood Canyon and Glenwood Springs — a shorter day than the old Kansas route, since the group turns south on I-25 tomorrow instead of continuing east.",
          "Overnight in Frisco/Silverthorne, set up for the run down to New Mexico.",
        ],
        charge: 'Leave Grand Junction full; Supercharge in <strong style="color:var(--text)">Glenwood Springs</strong> — charge to <strong style="color:var(--text)">100%</strong> here, it’s the biggest climb of the whole return (+3,336 ft into Frisco).',
        eat: "Wingstop · Frisco Main Street.",
        tripData: { city: "Denver area, CO", state: "CO", lat: 39.5744, lon: -106.0956, driveMiles: 245, chargeStop: { city: "Glenwood Springs, CO", lat: 39.5505, lon: -107.3248 } },
      },
      {
        id: "day-2026-08-09",
        date: "2026-08-09",
        dateLabel: "Sun, Aug 9",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Denver area → Las Vegas, NM",
        miles: "~396 mi",
        wake: true,
        intro: 'South through Denver to I-25, then Colorado Springs, Pueblo, Trinidad, and across Raton Pass (7,834 ft) into New Mexico. <strong style="color:var(--text)">Second UWC-USA Montezuma visit</strong> — the whole reason for this route.',
        bullets: [
          "Overnight in Las Vegas, NM — revisit the UWC-USA campus and Montezuma Hot Springs.",
        ],
        charge: 'Supercharge in <strong style="color:var(--text)">Colorado Springs</strong>, <strong style="color:var(--text)">Pueblo</strong>, <strong style="color:var(--text)">Trinidad</strong>, then <strong style="color:var(--text)">Raton</strong>. Raton Pass’s real elevation (7,834 ft peak) is higher than either endpoint, so real consumption on that leg runs above the net-elevation estimate.',
        tripData: { city: "Las Vegas, NM", state: "NM", lat: 35.5939, lon: -105.2239, driveMiles: 396, chargeStop: { city: "Trinidad, CO", lat: 37.1695, lon: -104.5005 } },
      },
      {
        id: "day-2026-08-10",
        date: "2026-08-10",
        dateLabel: "Mon, Aug 10",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Las Vegas, NM → OKC",
        miles: "~450 mi",
        wake: true,
        bullets: [
          "East on I-40 through Santa Rosa (Route 66 Auto Museum if there’s time) and Amarillo (lunch).",
          "Quick top-up in Weatherford before the final stretch.",
          "Return the Model Y, settle up costs.",
        ],
        charge: 'Leave Las Vegas, NM full; Supercharge in <strong style="color:var(--text)">Santa Rosa</strong>, then <strong style="color:var(--text)">Amarillo</strong> — charge to <strong style="color:var(--text)">100%</strong> here, it’s a long hot leg to Weatherford — then <strong style="color:var(--text)">Weatherford</strong>.',
        eat: "Wingstop (Amarillo/Weatherford) · farewell dinner in Bricktown / Florence’s / Picasso Cafe (OKC).",
        tripData: { city: "Oklahoma City, OK", state: "OK", lat: 35.4676, lon: -97.5164, driveMiles: 450, chargeStop: { city: "Amarillo, TX", lat: 35.2220, lon: -101.8313 } },
      },
    ],
    appendDays: [
      {
        id: "day-2026-08-11",
        date: "2026-08-11",
        dateLabel: "Tue, Aug 11",
        legClass: "leg-return",
        pillClass: "pill-return",
        pillLabel: "Return",
        title: "Fly Home from OKC",
        noStats: true,
        intro: "All five fly out of OKC to their respective homes.",
        warning: "⚠️ Requires changing all 5 return flights — this trip extended from the originally booked Mon Aug 10.",
        tripData: { city: "Oklahoma City, OK", state: "OK", lat: 35.4676, lon: -97.5164, driveMiles: 0, chargeStop: null },
      },
    ],
  },

  B1: {
    label: "Drop a Vegas day",
    totalDays: 11,
    heroDate: "Jul 31 - Aug 10, 2026",
    footerDate: "Jul 31 - Aug 10, 2026",
    // no dropDays here: Aug 6 keeps its slot in the calendar, it's just
    // RECONTENTED from a Vegas rest day into a driving day (see replaceDays
    // below) — the total day count never changes for this variant.
    replaceDays: [
      {
        id: "day-2026-08-06",
        date: "2026-08-06",
        dateLabel: "Thu, Aug 6",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Las Vegas, NV → Grand Junction, CO",
        miles: "~510 mi",
        wake: true,
        intro: "Leaves Vegas one day earlier than usual to make room for the New Mexico return — the last Vegas evening (Downtown / Fremont Street) is dropped; the Airbnb’s Thu night is paid for but unused.",
        bullets: [
          "North on I-15 into Utah, then east on I-70 (lose an hour). San Rafael Swell canyon country; lunch in Green River, UT.",
          "All five drive home together from here; nobody flies out of Vegas.",
        ],
        charge: 'Leave Vegas full; Superchargers in <strong style="color:var(--text)">St. George, UT</strong> and <strong style="color:var(--text)">Green River, UT</strong> (lunch stop).',
        tripData: { city: "Grand Junction, CO", state: "CO", lat: 39.0639, lon: -108.5506, driveMiles: 510, chargeStop: { city: "St. George, UT", lat: 37.0965, lon: -113.5684 } },
      },
      {
        id: "day-2026-08-07",
        date: "2026-08-07",
        dateLabel: "Fri, Aug 7",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Grand Junction → Denver area, CO",
        miles: "~245 mi",
        wake: true,
        bullets: [
          "West on I-70 through Glenwood Canyon and Glenwood Springs.",
          "Overnight in Frisco/Silverthorne, set up for the run down to New Mexico.",
        ],
        charge: 'Leave Grand Junction full; Supercharge in <strong style="color:var(--text)">Glenwood Springs</strong> — charge to <strong style="color:var(--text)">100%</strong> here, it’s the biggest climb of the return (+3,336 ft into Frisco).',
        eat: "Wingstop · Frisco Main Street.",
        tripData: { city: "Denver area, CO", state: "CO", lat: 39.5744, lon: -106.0956, driveMiles: 245, chargeStop: { city: "Glenwood Springs, CO", lat: 39.5505, lon: -107.3248 } },
      },
      {
        id: "day-2026-08-08",
        date: "2026-08-08",
        dateLabel: "Sat, Aug 8",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Denver area → Las Vegas, NM",
        miles: "~396 mi",
        wake: true,
        intro: 'South through Denver to I-25, then Colorado Springs, Pueblo, Trinidad, and across Raton Pass (7,834 ft) into New Mexico. <strong style="color:var(--text)">Second UWC-USA Montezuma visit.</strong>',
        charge: 'Supercharge in <strong style="color:var(--text)">Colorado Springs</strong>, <strong style="color:var(--text)">Pueblo</strong>, <strong style="color:var(--text)">Trinidad</strong>, then <strong style="color:var(--text)">Raton</strong>. Raton Pass’s real elevation (7,834 ft) is higher than either endpoint, so real consumption runs above the net-elevation estimate.',
        tripData: { city: "Las Vegas, NM", state: "NM", lat: 35.5939, lon: -105.2239, driveMiles: 396, chargeStop: { city: "Trinidad, CO", lat: 37.1695, lon: -104.5005 } },
      },
      {
        id: "day-2026-08-09",
        date: "2026-08-09",
        dateLabel: "Sun, Aug 9",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Las Vegas, NM → OKC",
        miles: "~450 mi",
        wake: true,
        bullets: [
          "East on I-40 through Santa Rosa and Amarillo, then Weatherford.",
          "Return the Model Y, settle up costs.",
        ],
        charge: 'Leave Las Vegas, NM full; Supercharge in <strong style="color:var(--text)">Santa Rosa</strong>, then <strong style="color:var(--text)">Amarillo</strong> — charge to <strong style="color:var(--text)">100%</strong> here, long hot leg to Weatherford — then <strong style="color:var(--text)">Weatherford</strong>.',
        eat: "Wingstop (Amarillo/Weatherford) · farewell dinner in Bricktown / Florence’s / Picasso Cafe (OKC).",
        tripData: { city: "Oklahoma City, OK", state: "OK", lat: 35.4676, lon: -97.5164, driveMiles: 450, chargeStop: { city: "Amarillo, TX", lat: 35.2220, lon: -101.8313 } },
      },
    ],
  },

  B2: {
    label: "Drop the Grand Junction night",
    totalDays: 11,
    heroDate: "Jul 31 - Aug 10, 2026",
    footerDate: "Jul 31 - Aug 10, 2026",
    replaceDays: [
      {
        id: "day-2026-08-07",
        date: "2026-08-07",
        dateLabel: "Fri, Aug 7",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Las Vegas, NV → Denver area, CO",
        miles: "~755 mi",
        wake: true,
        warning: "⚠️ Longest day of the trip: ~755 mi, roughly 16 hours door-to-door including charging. A 9:00 AM departure lands after midnight — consider an earlier start if possible.",
        bullets: [
          "North on I-15 into Utah, east on I-70 through Green River and Grand Junction (charging stop only — no overnight here in this version), continuing through Glenwood Canyon to the Denver area.",
        ],
        charge: 'Leave Vegas full; Supercharge in <strong style="color:var(--text)">St. George</strong>, <strong style="color:var(--text)">Green River</strong>, <strong style="color:var(--text)">Grand Junction</strong>, then <strong style="color:var(--text)">Glenwood Springs</strong> — charge to <strong style="color:var(--text)">100%</strong> here, biggest climb of the return.',
        tripData: { city: "Denver area, CO", state: "CO", lat: 39.5744, lon: -106.0956, driveMiles: 755, chargeStop: { city: "Grand Junction, CO", lat: 39.0639, lon: -108.5506 } },
      },
      {
        id: "day-2026-08-08",
        date: "2026-08-08",
        dateLabel: "Sat, Aug 8",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Denver area → Las Vegas, NM",
        miles: "~396 mi",
        wake: true,
        intro: 'South through Denver to I-25, then Colorado Springs, Pueblo, Trinidad, and across Raton Pass (7,834 ft) into New Mexico. <strong style="color:var(--text)">Second UWC-USA Montezuma visit.</strong>',
        charge: 'Supercharge in <strong style="color:var(--text)">Colorado Springs</strong>, <strong style="color:var(--text)">Pueblo</strong>, <strong style="color:var(--text)">Trinidad</strong>, then <strong style="color:var(--text)">Raton</strong>. Raton Pass’s real elevation (7,834 ft) is higher than either endpoint, so real consumption runs above the net-elevation estimate.',
        tripData: { city: "Las Vegas, NM", state: "NM", lat: 35.5939, lon: -105.2239, driveMiles: 396, chargeStop: { city: "Trinidad, CO", lat: 37.1695, lon: -104.5005 } },
      },
      {
        id: "day-2026-08-09",
        date: "2026-08-09",
        dateLabel: "Sun, Aug 9",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Las Vegas, NM → OKC",
        miles: "~450 mi",
        wake: true,
        bullets: [
          "East on I-40 through Santa Rosa and Amarillo, then Weatherford.",
          "Return the Model Y, settle up costs.",
        ],
        charge: 'Leave Las Vegas, NM full; Supercharge in <strong style="color:var(--text)">Santa Rosa</strong>, then <strong style="color:var(--text)">Amarillo</strong> — charge to <strong style="color:var(--text)">100%</strong> here, long hot leg to Weatherford — then <strong style="color:var(--text)">Weatherford</strong>.',
        eat: "Wingstop (Amarillo/Weatherford) · farewell dinner in Bricktown / Florence’s / Picasso Cafe (OKC).",
        tripData: { city: "Oklahoma City, OK", state: "OK", lat: 35.4676, lon: -97.5164, driveMiles: 450, chargeStop: { city: "Amarillo, TX", lat: 35.2220, lon: -101.8313 } },
      },
    ],
  },

  C: {
    label: "One long day, keep Grand Junction",
    totalDays: 11,
    heroDate: "Jul 31 - Aug 10, 2026",
    footerDate: "Jul 31 - Aug 10, 2026",
    replaceDays: [
      {
        id: "day-2026-08-08",
        date: "2026-08-08",
        dateLabel: "Sat, Aug 8",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Grand Junction → Las Vegas, NM",
        miles: "~641 mi",
        wake: true,
        warning: "⚠️ Longest day of the trip: ~641 mi, roughly 14.5 hours door-to-door including charging. A 9:00 AM departure lands around 11:00 PM.",
        intro: 'I-70 east through Glenwood Canyon to the Denver area (charging stop only, no overnight), then south on I-25 through Colorado Springs, Pueblo, and Trinidad, crossing into New Mexico at Raton Pass (7,834 ft). <strong style="color:var(--text)">Second UWC-USA Montezuma visit</strong> on arrival.',
        charge: 'Leave Grand Junction full; Supercharge in <strong style="color:var(--text)">Glenwood Springs</strong> — charge to <strong style="color:var(--text)">100%</strong> here, biggest climb of the return — then <strong style="color:var(--text)">Colorado Springs</strong>, <strong style="color:var(--text)">Pueblo</strong>, <strong style="color:var(--text)">Trinidad</strong>, and <strong style="color:var(--text)">Raton</strong>.',
        tripData: { city: "Las Vegas, NM", state: "NM", lat: 35.5939, lon: -105.2239, driveMiles: 641, chargeStop: { city: "Colorado Springs, CO", lat: 38.8339, lon: -104.8214 } },
      },
      {
        id: "day-2026-08-09",
        date: "2026-08-09",
        dateLabel: "Sun, Aug 9",
        legClass: "leg-outbound",
        pillClass: "pill-outbound",
        pillLabel: "Return",
        title: "Las Vegas, NM → OKC",
        miles: "~450 mi",
        wake: true,
        bullets: [
          "East on I-40 through Santa Rosa and Amarillo, then Weatherford.",
          "Return the Model Y, settle up costs.",
        ],
        charge: 'Leave Las Vegas, NM full; Supercharge in <strong style="color:var(--text)">Santa Rosa</strong>, then <strong style="color:var(--text)">Amarillo</strong> — charge to <strong style="color:var(--text)">100%</strong> here, long hot leg to Weatherford — then <strong style="color:var(--text)">Weatherford</strong>.',
        eat: "Wingstop (Amarillo/Weatherford) · farewell dinner in Bricktown / Florence’s / Picasso Cafe (OKC).",
        tripData: { city: "Oklahoma City, OK", state: "OK", lat: 35.4676, lon: -97.5164, driveMiles: 450, chargeStop: { city: "Amarillo, TX", lat: 35.2220, lon: -101.8313 } },
      },
    ],
  },
};
