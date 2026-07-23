// Shared day-by-day trip data, read by both index.html's "Today" widget and
// itinerary.html's weather strips — single source of truth so the two stay
// in sync instead of duplicating city/coordinate data in two places.
window.TRIP_DAYS = [
  { date: "2026-07-30", label: "Thu, Jul 30", city: "Oklahoma City", state: "OK", lat: 35.4676, lon: -97.5164, leg: "outbound", driveMiles: 0, chargeStop: null },
  { date: "2026-07-31", label: "Fri, Jul 31", city: "Santa Rosa, NM", state: "NM", lat: 34.9381, lon: -104.6819, leg: "outbound", driveMiles: 430, chargeStop: { city: "Amarillo, TX", lat: 35.2220, lon: -101.8313 } },
  { date: "2026-08-01", label: "Sat, Aug 1", city: "Albuquerque, NM", state: "NM", lat: 35.0844, lon: -106.6504, leg: "outbound", driveMiles: 185, chargeStop: { city: "Las Vegas, NM", lat: 35.5939, lon: -105.2239 } },
  { date: "2026-08-02", label: "Sun, Aug 2", city: "Phoenix, AZ", state: "AZ", lat: 33.4484, lon: -112.0740, leg: "outbound", driveMiles: 465, chargeStop: { city: "Flagstaff, AZ", lat: 35.1983, lon: -111.6513 } },
  { date: "2026-08-03", label: "Mon, Aug 3", city: "Las Vegas, NV", state: "NV", lat: 36.1699, lon: -115.1398, leg: "vegas", driveMiles: 300, chargeStop: { city: "Kingman, AZ", lat: 35.1894, lon: -114.0530 } },
  { date: "2026-08-04", label: "Tue, Aug 4", city: "Las Vegas, NV", state: "NV", lat: 36.1699, lon: -115.1398, leg: "vegas", driveMiles: 0, chargeStop: null },
  { date: "2026-08-05", label: "Wed, Aug 5", city: "Las Vegas, NV", state: "NV", lat: 36.1699, lon: -115.1398, leg: "vegas", driveMiles: 0, chargeStop: null },
  { date: "2026-08-06", label: "Thu, Aug 6", city: "Las Vegas, NV", state: "NV", lat: 36.1699, lon: -115.1398, leg: "vegas", driveMiles: 0, chargeStop: null },
  { date: "2026-08-07", label: "Fri, Aug 7", city: "Grand Junction, CO", state: "CO", lat: 39.0639, lon: -108.5506, leg: "return", driveMiles: 510, chargeStop: { city: "St. George, UT", lat: 37.0965, lon: -113.5684 } },
  { date: "2026-08-08", label: "Sat, Aug 8", city: "Hays, KS", state: "KS", lat: 38.8792, lon: -99.3268, leg: "return", driveMiles: 530, chargeStop: { city: "Denver area, CO", lat: 39.5744, lon: -106.0956 } },
  { date: "2026-08-09", label: "Sun, Aug 9", city: "Oklahoma City", state: "OK", lat: 35.4676, lon: -97.5164, leg: "return", driveMiles: 330, chargeStop: { city: "Wichita, KS", lat: 37.6872, lon: -97.3301 } },
  { date: "2026-08-10", label: "Mon, Aug 10", city: "Oklahoma City", state: "OK", lat: 35.4676, lon: -97.5164, leg: "return", driveMiles: 0, chargeStop: null },
];

// Reads a "?debug-date=YYYY-MM-DD" query param so the date-sensitive widgets
// (Today card, weather-strip highlight) can be tested/previewed on any date
// without waiting for the actual trip — falls back to the real clock otherwise.
window.getTripToday = function () {
  const params = new URLSearchParams(window.location.search);
  const override = params.get("debug-date");
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
    const [y, m, d] = override.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

window.dateToTripKey = function (date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

window.haversineMilesTrip = function (lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
