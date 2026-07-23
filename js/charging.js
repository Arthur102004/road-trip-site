(() => {
  // ---------- track my location → nearest charge stop ----------

  const stops = Array.from(document.querySelectorAll(".stop-card[data-lat]"));
  const btn = document.getElementById("locate-btn");
  const status = document.getElementById("locate-status");

  function haversineMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function clearNearest() {
    stops.forEach((s) => {
      s.classList.remove("is-nearest");
      const badge = s.querySelector(".nearest-badge");
      if (badge) badge.hidden = true;
    });
  }

  function highlightNearest(lat, lng) {
    clearNearest();
    let best = null;
    let bestDist = Infinity;
    stops.forEach((s) => {
      const d = haversineMiles(lat, lng, parseFloat(s.dataset.lat), parseFloat(s.dataset.lng));
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    });
    if (!best) return;
    best.classList.add("is-nearest");
    const badge = best.querySelector(".nearest-badge");
    if (badge) {
      badge.hidden = false;
      const distText = badge.querySelector(".nearest-dist");
      distText.textContent = bestDist < 10 ? bestDist.toFixed(1) : Math.round(bestDist);
    }
    best.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ---------- nearby now: real food/things-to-do anywhere, via Overpass ----------

  const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
  const RADIUS_METERS = 1609; // ~1 mile

  const CATEGORY_LABELS = {
    restaurant: "Restaurant",
    cafe: "Cafe",
    fast_food: "Fast Food",
    ice_cream: "Ice Cream",
    bar: "Bar",
    pub: "Pub",
    attraction: "Attraction",
    museum: "Museum",
    viewpoint: "Viewpoint",
    artwork: "Artwork",
    park: "Park",
  };

  function overpassQuery(lat, lon) {
    return `[out:json][timeout:20];
(
  node["amenity"~"^(restaurant|cafe|fast_food|ice_cream|bar|pub)$"](around:${RADIUS_METERS},${lat},${lon});
  node["tourism"~"^(attraction|museum|viewpoint|artwork)$"](around:${RADIUS_METERS},${lat},${lon});
  node["leisure"="park"](around:${RADIUS_METERS},${lat},${lon});
);
out body 40;`;
  }

  function mapsDirectionsUrl(lat, lon) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
  }

  function renderNearby(lat, lon, elements) {
    const section = document.getElementById("nearby-section");
    const list = document.getElementById("nearby-list");
    const meta = document.getElementById("nearby-meta");
    if (!section || !list) return;

    const places = elements
      .filter((el) => el.tags && el.tags.name)
      .map((el) => {
        const category = el.tags.amenity || el.tags.tourism || el.tags.leisure || "place";
        return {
          name: el.tags.name,
          category: CATEGORY_LABELS[category] || category,
          lat: el.lat,
          lon: el.lon,
          dist: haversineMiles(lat, lon, el.lat, el.lon),
        };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 20);

    list.innerHTML = "";

    if (places.length === 0) {
      section.hidden = false;
      meta.textContent = "nothing found within 1 mi";
      list.innerHTML = `<div class="card">Nothing turned up within a mile of you. Try again once you've moved, or check the planned stops below.</div>`;
      return;
    }

    meta.textContent = `${places.length} within 1 mi`;
    places.forEach((p) => {
      const card = document.createElement("div");
      card.className = "card card-accent nearby-item";
      card.innerHTML = `
        <h3>${escapeHtmlLocal(p.name)} <span class="miles">${p.dist < 0.1 ? "<0.1" : p.dist.toFixed(1)} mi</span></h3>
        <div class="stop-do"><span>${escapeHtmlLocal(p.category)}</span></div>
        <a class="btn hotel-search-link" href="${mapsDirectionsUrl(p.lat, p.lon)}" target="_blank" rel="noopener noreferrer">Directions</a>
      `;
      list.appendChild(card);
    });
    section.hidden = false;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function escapeHtmlLocal(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function fetchNearby(lat, lon) {
    return fetch(OVERPASS_URL, {
      method: "POST",
      body: "data=" + encodeURIComponent(overpassQuery(lat, lon)),
    })
      .then((res) => {
        if (!res.ok) throw new Error("bad response");
        return res.json();
      })
      .then((data) => {
        renderNearby(lat, lon, data.elements || []);
      })
      .catch(() => {
        status.textContent = "Nearest planned stop is highlighted below. Couldn't reach the map data service for nearby places, check your connection and try again.";
      });
  }

  if (btn) {
    btn.addEventListener("click", () => {
      if (!("geolocation" in navigator)) {
        status.textContent = "Geolocation isn't supported in this browser.";
        return;
      }
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = "Locating…";
      status.textContent = "Waiting on location permission…";

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          btn.disabled = false;
          btn.textContent = originalLabel;
          const { latitude, longitude } = pos.coords;
          highlightNearest(latitude, longitude);
          status.textContent = "Nearest planned stop is highlighted below. Searching nearby for food and things to do…";
          fetchNearby(latitude, longitude).then(() => {
            if (status.textContent.includes("Searching nearby")) {
              status.textContent = "Nearest planned stop is highlighted below, and nearby places are listed above.";
            }
          });
        },
        (err) => {
          btn.disabled = false;
          btn.textContent = originalLabel;
          status.textContent = "Couldn't get your location (" + err.message + ").";
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  // ---------- 25-minute charge countdown, one per stop ----------

  const DURATION = 25 * 60;

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  document.querySelectorAll(".charge-timer").forEach((el) => {
    let remaining = DURATION;
    let intervalId = null;
    const display = el.querySelector(".timer-display");
    const startBtn = el.querySelector(".timer-start");
    const resetBtn = el.querySelector(".timer-reset");

    function render() {
      display.textContent = formatTime(remaining);
    }

    function finish() {
      clearInterval(intervalId);
      intervalId = null;
      remaining = 0;
      el.classList.remove("is-running");
      el.classList.add("is-done");
      display.textContent = "Charged ✓";
      startBtn.textContent = "Start";
    }

    function tick() {
      remaining -= 1;
      if (remaining <= 0) {
        finish();
      } else {
        render();
      }
    }

    function start() {
      el.classList.remove("is-done");
      el.classList.add("is-running");
      intervalId = setInterval(tick, 1000);
      startBtn.textContent = "Pause";
    }

    function pause() {
      clearInterval(intervalId);
      intervalId = null;
      el.classList.remove("is-running");
      startBtn.textContent = "Start";
    }

    startBtn.addEventListener("click", () => {
      if (intervalId) {
        pause();
      } else {
        start();
      }
    });

    resetBtn.addEventListener("click", () => {
      pause();
      remaining = DURATION;
      el.classList.remove("is-done");
      render();
    });

    render();
  });
})();
