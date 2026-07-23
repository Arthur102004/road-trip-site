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

  // public Overpass mirrors, tried in order — the primary instance rate-limits
  // and times out under load, so a lone endpoint makes wider-radius queries flaky
  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
  const OVERPASS_TIMEOUT_MS = 10000;
  const METERS_PER_MILE = 1609;
  const DEFAULT_RADIUS_MILES = 1;

  let currentRadiusMiles = DEFAULT_RADIUS_MILES;
  let lastCoords = null; // { lat, lon } from the most recent successful locate
  const nearbyCache = new Map(); // "lat,lon,radius" -> elements[], avoids re-hitting Overpass for a radius already fetched this session

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

  function overpassQuery(lat, lon, radiusMiles) {
    const radiusMeters = Math.round(radiusMiles * METERS_PER_MILE);
    // Overpass truncates "out body N" by its own internal order, not by distance,
    // so a wider radius needs a bigger raw fetch or nearby results can get starved
    const fetchLimit = radiusMiles <= 1 ? 60 : radiusMiles <= 3 ? 100 : radiusMiles <= 5 ? 140 : 200;
    console.log(`[nearby] querying Overpass: radius=${radiusMiles}mi (${radiusMeters}m), limit=${fetchLimit}`);
    return `[out:json][timeout:25];
(
  node["amenity"~"^(restaurant|cafe|fast_food|ice_cream|bar|pub)$"](around:${radiusMeters},${lat},${lon});
  node["tourism"~"^(attraction|museum|viewpoint|artwork)$"](around:${radiusMeters},${lat},${lon});
  node["leisure"="park"](around:${radiusMeters},${lat},${lon});
);
out body ${fetchLimit};`;
  }

  function mapsDirectionsUrl(lat, lon) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
  }

  function renderNearby(lat, lon, elements, radiusMiles) {
    const section = document.getElementById("nearby-section");
    const list = document.getElementById("nearby-list");
    const meta = document.getElementById("nearby-meta");
    if (!section || !list) return;

    const seenNames = new Set();
    // cap grows with radius — a fixed top-20-by-distance cap meant widening the
    // search radius pulled in more Overpass data but never changed what was displayed,
    // since the nearest 20 within 1 mi still won on distance at every wider radius too
    const displayLimit = radiusMiles <= 1 ? 15 : radiusMiles <= 3 ? 25 : radiusMiles <= 5 ? 35 : 50;

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
      .filter((p) => {
        const key = p.name.toLowerCase();
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      })
      .slice(0, displayLimit);

    list.innerHTML = "";

    if (places.length === 0) {
      section.hidden = false;
      meta.textContent = `nothing found within ${radiusMiles} mi`;
      list.innerHTML = `<div class="card">Nothing turned up within ${radiusMiles} mi of you. Try a wider radius above, or check the planned stops below.</div>`;
      return;
    }

    meta.textContent = `${places.length} within ${radiusMiles} mi`;
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

  function fetchOverpassOnce(url, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
    return fetch(url, { method: "POST", body, signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`bad response: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // Overpass sometimes answers 200 with a "remark" (soft timeout/overload)
        // and an empty/truncated elements array instead of a proper error status —
        // treat that as a failed attempt so it falls over to the next mirror instead
        // of rendering as a legitimate "nothing nearby" result
        if (data.remark && (!data.elements || data.elements.length === 0)) {
          throw new Error(`overpass remark: ${data.remark}`);
        }
        console.log(`[nearby] ${url} returned ${data.elements ? data.elements.length : 0} raw elements`);
        return data;
      })
      .finally(() => clearTimeout(timer));
  }

  async function fetchOverpassWithFallback(body) {
    let lastErr;
    for (const url of OVERPASS_ENDPOINTS) {
      try {
        return await fetchOverpassOnce(url, body);
      } catch (err) {
        console.log(`[nearby] ${url} failed: ${err.message}`);
        lastErr = err;
      }
    }
    throw lastErr;
  }

  function fetchNearby(lat, lon, radiusMiles) {
    const meta = document.getElementById("nearby-meta");
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)},${radiusMiles}`;

    if (nearbyCache.has(cacheKey)) {
      console.log(`[nearby] cache hit for ${cacheKey}, skipping Overpass call`);
      renderNearby(lat, lon, nearbyCache.get(cacheKey), radiusMiles);
      return Promise.resolve();
    }
    console.log(`[nearby] cache miss for ${cacheKey}, calling Overpass`);

    const body = "data=" + encodeURIComponent(overpassQuery(lat, lon, radiusMiles));
    return fetchOverpassWithFallback(body)
      .then((data) => {
        const elements = data.elements || [];
        nearbyCache.set(cacheKey, elements);
        renderNearby(lat, lon, elements, radiusMiles);
      })
      .catch(() => {
        status.textContent = "Nearest planned stop is highlighted below. Couldn't reach the map data service for nearby places, check your connection and try again.";
        if (meta) meta.textContent = `couldn't load ${radiusMiles} mi — the map data service may be rate-limited, try again shortly`;
      });
  }

  const radiusButtons = Array.from(document.querySelectorAll(".radius-btn"));

  radiusButtons.forEach((rBtn) => {
    rBtn.addEventListener("click", () => {
      const miles = parseFloat(rBtn.dataset.radius);
      if (miles === currentRadiusMiles) return;
      currentRadiusMiles = miles;
      radiusButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === rBtn)));

      if (lastCoords) {
        const meta = document.getElementById("nearby-meta");
        if (meta) meta.textContent = `searching within ${miles} mi…`;
        fetchNearby(lastCoords.lat, lastCoords.lon, currentRadiusMiles);
      }
    });
  });

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
          lastCoords = { lat: latitude, lon: longitude };
          highlightNearest(latitude, longitude);
          status.textContent = "Nearest planned stop is highlighted below. Searching nearby for food and things to do…";
          fetchNearby(latitude, longitude, currentRadiusMiles).then(() => {
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

  // ---------- charge timer, one per stop, duration tuned per leg ----------

  const TIMER_STORAGE_PREFIX = "roadtrip-charge-timer-";
  let notificationRequested = false;

  function formatTime(totalSeconds) {
    const clamped = Math.max(0, totalSeconds);
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function formatClock(date) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // maps-link.js (loaded earlier) replaces a stop-card h3's leading text node
  // with an <a> for real stops, so the city name has to be read from whichever
  // of those two shapes is currently present, not assumed to be one or the other
  function extractCityName(h3) {
    if (!h3) return "this stop";
    const link = h3.querySelector("a");
    if (link) return link.textContent.trim();
    const firstText = Array.from(h3.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    return firstText ? firstText.textContent.trim() : h3.textContent.trim();
  }

  function ensureNotificationPermission() {
    if (notificationRequested || !("Notification" in window)) return;
    notificationRequested = true;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }

  function notifyDone(cityName) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      new Notification("Charging done", {
        body: `${cityName} — the car should be ready to go.`,
        tag: `charge-${cityName}`,
      });
    } catch (e) {}
  }

  // three-note ascending chime, synthesized so no audio file has to be bundled
  // (works offline too, matching the rest of the site's offline-first setup)
  function playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      [880, 1046.5, 1318.5].forEach((freq, i) => {
        const start = now + i * 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch (e) {}
  }

  document.querySelectorAll(".charge-timer").forEach((el) => {
    const stopId = el.dataset.stopId || Math.random().toString(36).slice(2);
    const storageKey = TIMER_STORAGE_PREFIX + stopId;
    const defaultDuration = (parseInt(el.dataset.defaultMinutes, 10) || 25) * 60;

    let remaining = defaultDuration;
    let running = false;
    let intervalId = null;

    const display = el.querySelector(".timer-display");
    const departureEl = el.querySelector(".timer-departure");
    const startBtn = el.querySelector(".timer-start");
    const resetBtn = el.querySelector(".timer-reset");
    const adjustBtns = el.querySelectorAll(".timer-adjust");
    const cityName = extractCityName(el.closest(".stop-card")?.querySelector("h3"));

    resetBtn.setAttribute("aria-label", `Reset charge timer for ${cityName}`);
    adjustBtns.forEach((btn) => {
      const delta = parseInt(btn.dataset.delta, 10);
      btn.setAttribute("aria-label", `${delta > 0 ? "Add" : "Subtract"} 5 minutes to charge timer for ${cityName}`);
    });

    function persist() {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            running,
            remaining,
            endAt: running ? Date.now() + remaining * 1000 : null,
            done: el.classList.contains("is-done"),
          })
        );
      } catch (e) {}
    }

    function render() {
      if (el.classList.contains("is-done")) {
        display.textContent = "Charged ✓";
        departureEl.textContent = "";
        return;
      }
      display.textContent = formatTime(remaining);
      departureEl.textContent = remaining > 0 ? `Back by ${formatClock(new Date(Date.now() + remaining * 1000))}` : "";
    }

    function finish(silent) {
      clearInterval(intervalId);
      intervalId = null;
      running = false;
      remaining = 0;
      el.classList.remove("is-running");
      el.classList.add("is-done");
      startBtn.textContent = "Start";
      startBtn.setAttribute("aria-label", `Restart charge timer for ${cityName}`);
      render();
      persist();
      if (!silent) {
        playChime();
        notifyDone(cityName);
      }
    }

    function tick() {
      remaining -= 1;
      if (remaining <= 0) {
        finish(false);
      } else {
        render();
        persist();
      }
    }

    function start() {
      ensureNotificationPermission();
      el.classList.remove("is-done");
      el.classList.add("is-running");
      running = true;
      clearInterval(intervalId);
      intervalId = setInterval(tick, 1000);
      startBtn.textContent = "Pause";
      startBtn.setAttribute("aria-label", `Pause charge timer for ${cityName}`);
      render();
      persist();
    }

    function pause() {
      clearInterval(intervalId);
      intervalId = null;
      running = false;
      el.classList.remove("is-running");
      startBtn.textContent = "Start";
      startBtn.setAttribute("aria-label", `Start charge timer for ${cityName}`);
      persist();
    }

    startBtn.addEventListener("click", () => {
      if (running) {
        pause();
      } else {
        start();
      }
    });

    resetBtn.addEventListener("click", () => {
      pause();
      remaining = defaultDuration;
      el.classList.remove("is-done");
      render();
      persist();
    });

    adjustBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = parseInt(btn.dataset.delta, 10) * 60;
        remaining = Math.max(0, remaining + delta);
        if (remaining === 0 && running) {
          finish(false);
        } else {
          el.classList.remove("is-done");
          render();
          persist();
        }
      });
    });

    // restore from localStorage — a running timer stores an absolute end
    // timestamp rather than just "seconds left," so a reload or the phone
    // locking doesn't freeze the countdown; elapsed real time is caught up
    // in one step instead of drifting
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) {
        if (saved.done) {
          remaining = 0;
          el.classList.add("is-done");
        } else if (saved.running && saved.endAt) {
          const secondsLeft = Math.round((saved.endAt - Date.now()) / 1000);
          if (secondsLeft <= 0) {
            // timer would have finished while the page was closed — land on
            // "done" quietly rather than firing a stale notification/chime now
            remaining = 0;
            el.classList.add("is-done");
          } else {
            remaining = secondsLeft;
            start();
          }
        } else if (typeof saved.remaining === "number") {
          remaining = saved.remaining;
        }
      }
    } catch (e) {}

    // start() already sets its own "Pause..." label when restore resumes a
    // running timer — only stamp the default "Start" label when it didn't
    if (!running) {
      startBtn.setAttribute("aria-label", `Start charge timer for ${cityName}`);
    }
    render();
  });
})();
