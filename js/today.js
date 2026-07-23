(() => {
  const AVG_MPH = 55; // rough highway average, same "~" approximation style the rest of the site uses for mileage

  document.addEventListener("DOMContentLoaded", () => {
    const card = document.getElementById("today-card");
    if (!card || !window.TRIP_DAYS) return;

    const today = window.getTripToday();
    const todayKey = window.dateToTripKey(today);
    const days = window.TRIP_DAYS;
    const todayIndex = days.findIndex((d) => d.date === todayKey);

    if (todayIndex === -1) return; // outside the trip window — leave the countdown cards as the only date widget

    const todayEntry = days[todayIndex];
    const originEntry = todayIndex > 0 ? days[todayIndex - 1] : todayEntry;

    // find the next day (today or later) that actually has a charging stop —
    // Vegas rest days and the fly-home day don't have one of their own
    let chargeIndex = todayIndex;
    while (chargeIndex < days.length && !days[chargeIndex].chargeStop) chargeIndex++;

    card.hidden = false;

    document.getElementById("today-date-label").textContent = todayEntry.label;
    document.getElementById("today-route").textContent =
      todayEntry.driveMiles > 0 ? `${originEntry.city} → ${todayEntry.city}` : todayEntry.city;

    const chargeEl = document.getElementById("today-charge");
    if (chargeIndex >= days.length) {
      chargeEl.textContent = "No more charging stops planned — almost home.";
    } else {
      const chargeDay = days[chargeIndex];
      const chargeOrigin = chargeIndex > 0 ? days[chargeIndex - 1] : chargeDay;
      const miles = window.haversineMilesTrip(chargeOrigin.lat, chargeOrigin.lon, chargeDay.chargeStop.lat, chargeDay.chargeStop.lon);
      const hours = miles / AVG_MPH;
      const whenPrefix = chargeIndex === todayIndex ? "" : ` (${chargeDay.label})`;
      chargeEl.textContent = `Next charging stop: ${chargeDay.chargeStop.city}${whenPrefix} — ~${Math.round(miles)} mi, ~${hours.toFixed(1)} hr drive`;
    }

    const link = document.getElementById("today-itinerary-link");
    if (link) link.href = `itinerary.html#day-${todayEntry.date}`;
  });
})();
