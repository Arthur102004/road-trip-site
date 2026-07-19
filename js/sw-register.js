if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        const el = document.getElementById("offline-status");
        if (el) el.textContent = "📡 Saved for offline";
      })
      .catch(() => {});
  });
}
