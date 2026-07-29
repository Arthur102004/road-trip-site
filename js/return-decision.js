// Fillable "flight change cost" estimate for Option A on the return-route
// decision page. Shared via TripSync (same key seen by the whole crew) with
// a device-local fallback when sync is off — matches the pattern used for
// the pot tracker and packing list.
(() => {
  const LOCAL_KEY = "roadtrip-flight-cost-estimate";
  const SYNC_KEY = "decision.flightChangeCost";
  const sync = window.TripSync && window.TripSync.enabled ? window.TripSync : null;

  function getValue() {
    if (sync) return sync.get(SYNC_KEY);
    try {
      const v = localStorage.getItem(LOCAL_KEY);
      return v ? parseFloat(v) : undefined;
    } catch (e) {
      return undefined;
    }
  }

  function setValue(v) {
    if (sync) {
      sync.set(SYNC_KEY, v);
    } else {
      try {
        localStorage.setItem(LOCAL_KEY, String(v));
      } catch (e) {}
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("flight-cost-input");
    if (!input) return;

    const label = document.getElementById("flight-cost-sync-label");
    if (label) label.textContent = sync ? "shared across the crew" : "this device only";

    const existing = getValue();
    if (existing != null) input.value = existing;

    let saveTimer = null;
    input.addEventListener("input", () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const val = parseFloat(input.value);
        setValue(isNaN(val) ? null : val);
      }, 400);
    });

    if (sync) {
      sync.subscribe(SYNC_KEY, () => {
        if (input === document.activeElement) return;
        const v = sync.get(SYNC_KEY);
        if (v != null) input.value = v;
      });
    }
  });
})();
