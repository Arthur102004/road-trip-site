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
          highlightNearest(pos.coords.latitude, pos.coords.longitude);
          status.textContent = "Nearest charge stop is highlighted below.";
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
