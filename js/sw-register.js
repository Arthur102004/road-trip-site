(() => {
  const LAST_UPDATE_KEY = "roadtrip-last-update";

  function fmtStamp(ms) {
    const d = new Date(ms);
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    if (sameDay) return time;
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + time;
  }

  function getStamp() {
    try {
      const v = localStorage.getItem(LAST_UPDATE_KEY);
      return v ? parseInt(v, 10) : null;
    } catch (e) {
      return null;
    }
  }

  function setStamp(ms) {
    try {
      localStorage.setItem(LAST_UPDATE_KEY, String(ms));
    } catch (e) {}
    renderStatus();
  }

  // --- persistent online/offline pill + footer status ---------------------

  let pill = null;

  function renderStatus() {
    const online = navigator.onLine;
    const stamp = getStamp();
    const stampText = stamp ? fmtStamp(stamp) : "not yet saved";

    if (!pill) {
      pill = document.createElement("div");
      pill.className = "net-pill mono no-print";
      pill.setAttribute("role", "status");
      document.body.appendChild(pill);
    }
    pill.classList.toggle("net-pill-offline", !online);
    pill.textContent = online
      ? `● Online · updated ${stampText}`
      : `● Offline · saved ${stampText}`;

    const footerEl = document.getElementById("offline-status");
    if (footerEl) {
      footerEl.textContent = online
        ? `📡 Online · saved for offline · updated ${stampText}`
        : `📴 Offline · showing saved copy from ${stampText}`;
    }
  }

  // --- non-blocking "new version" banner ----------------------------------

  function showUpdateBanner(reg) {
    if (document.querySelector(".update-banner")) return;
    const banner = document.createElement("div");
    banner.className = "update-banner no-print";
    banner.setAttribute("role", "alert");
    banner.innerHTML =
      '<span>🔄 New version available</span>' +
      '<button type="button" class="btn update-banner-btn">Tap to refresh</button>';
    banner.querySelector(".update-banner-btn").addEventListener("click", () => {
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    });
    document.body.appendChild(banner);
  }

  function watchForUpdates(reg) {
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateBanner(reg);
      return;
    }
    reg.addEventListener("updatefound", () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        // "installed" with an existing controller = an update is waiting.
        // Without a controller it's the very first install — nothing to announce.
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateBanner(reg);
        }
      });
    });
  }

  // --- registration -------------------------------------------------------

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js") // relative: scopes to the GitHub Pages subpath
        .then((reg) => {
          watchForUpdates(reg);

          // Browsers only re-check sw.js ~once a day on their own; on a road
          // trip that drifts in and out of signal, check whenever we come
          // back online or back to the foreground.
          window.addEventListener("online", () => reg.update().catch(() => {}));
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") reg.update().catch(() => {});
          });

          return navigator.serviceWorker.ready;
        })
        .then(() => {
          if (navigator.onLine && !getStamp()) setStamp(Date.now());
          renderStatus();
        })
        .catch(() => {
          renderStatus();
        });
    });

    // The SW pings after each successful background revalidation.
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "REVALIDATED") setStamp(event.data.at);
    });

    // After the waiting worker takes over, load the new version exactly once.
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }

  window.addEventListener("online", renderStatus);
  window.addEventListener("offline", renderStatus);
  document.addEventListener("DOMContentLoaded", renderStatus);
})();
