(() => {
  // real seasonal risk (not live-data-dependent) — Aug in NM/AZ along this
  // route is peak monsoon + extreme heat, worth flagging even if the forecast
  // API can't reach that date yet
  const MONSOON_STATES = new Set(["NM", "AZ"]);

  const FORECAST_MAX_DAYS_AHEAD = 16; // Open-Meteo's free forecast window

  function isAugust(dateStr) {
    return dateStr.slice(5, 7) === "08";
  }

  // Open-Meteo answers out-of-range dates with an HTTP 400 (not a 200 with
  // empty data), so checking the upper bound ourselves first avoids a doomed
  // request and lets us show the more useful "check back later" message
  // instead of a generic fetch-failed one. This must use the real wall-clock
  // date, not the (possibly debug-overridden) "trip today" — Open-Meteo's
  // actual forecast window is relative to when the request is made, and
  // debug-testing a future day shouldn't make earlier real trip days look
  // unfetchable. There's no meaningful lower bound to gate on: Open-Meteo's
  // history+forecast endpoint already covers ~90 days back, comfortably
  // more than "days before this trip," so a past date is just let through
  // to the real fetch rather than blocked by a guessed cutoff here.
  function daysAheadOfRealNow(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const realToday = new Date();
    const realTodayMidnight = new Date(realToday.getFullYear(), realToday.getMonth(), realToday.getDate());
    return Math.round((target - realTodayMidnight) / 86400000);
  }

  function fetchDayWeather(lat, lon, dateStr) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
    return fetch(url).then((res) => {
      if (!res.ok) throw new Error("weather fetch failed");
      return res.json();
    });
  }

  function renderWeather(el, data) {
    const daily = data && data.daily;
    if (!daily || !daily.time || daily.time.length === 0 || daily.temperature_2m_max[0] == null) {
      el.textContent = "Forecast not available yet — Open-Meteo only covers ~16 days out, check back closer to the date.";
      return;
    }
    const hi = Math.round(daily.temperature_2m_max[0]);
    const lo = Math.round(daily.temperature_2m_min[0]);
    const precip = daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : null;
    el.textContent = `${hi}°F / ${lo}°F` + (precip != null ? ` · ${precip}% chance of rain` : "");
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.TRIP_DAYS) return;
    const today = window.getTripToday();
    const todayKey = window.dateToTripKey(today);

    window.TRIP_DAYS.forEach((day) => {
      const card = document.getElementById(`day-${day.date}`);
      if (!card) return;

      if (day.date === todayKey) card.classList.add("is-today");

      const weatherEl = card.querySelector(".weather-strip");
      if (!weatherEl) return;

      if (MONSOON_STATES.has(day.state) && isAugust(day.date)) {
        const badge = document.createElement("span");
        badge.className = "pill monsoon-badge";
        badge.textContent = "⚠️ Monsoon & extreme heat season";
        weatherEl.appendChild(badge);
      }

      const forecastText = document.createElement("span");
      forecastText.className = "mono small weather-text";
      weatherEl.appendChild(forecastText);

      if (daysAheadOfRealNow(day.date) > FORECAST_MAX_DAYS_AHEAD) {
        forecastText.textContent = "Forecast not available yet — Open-Meteo only covers ~16 days out, check back closer to the date.";
        return;
      }

      forecastText.textContent = "Loading forecast…";
      fetchDayWeather(day.lat, day.lon, day.date)
        .then((data) => renderWeather(forecastText, data))
        .catch(() => {
          forecastText.textContent = "Couldn't load forecast right now.";
        });
    });

    // land on today's day-card automatically — but let an explicit #day-...
    // link (e.g. from index.html's Today card) take priority over this
    if (!window.location.hash) {
      const todayCard = document.getElementById(`day-${todayKey}`);
      if (todayCard) todayCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
})();
