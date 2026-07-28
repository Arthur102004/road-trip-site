(() => {
  const STORAGE_KEY = "roadtrip-driving-rotation-v1";
  const SWAP_WARN_MS = 2 * 60 * 60 * 1000; // 2 hours — "consider swapping"
  const SWAP_OVERDUE_MS = 3 * 60 * 60 * 1000; // 3 hours — "swap now"

  // Shared via TripSync when enabled: `rotation.current` = {index, startAt}
  // as ONE atomic field (index and shift-start must travel together — as two
  // fields, LWW could pair one phone's driver with another phone's timer),
  // plus `rotation.driver.<i>` per name so renaming different drivers from
  // two offline phones never conflicts. Timestamps use sync.now() (server-
  // corrected) so the elapsed timer reads the same on every phone.
  const sync = window.TripSync && window.TripSync.enabled ? window.TripSync : null;

  function nowMs() {
    return sync ? sync.now() : Date.now();
  }

  const DEFAULTS = {
    drivers: ["Arthur", "Driver 1", "Driver 2"], // only 3 drive the whole loop, per the playbook
    currentIndex: 0,
    shiftStartAt: Date.now(),
  };

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      return {
        drivers: Array.isArray(parsed.drivers) && parsed.drivers.length > 0 ? parsed.drivers : [...DEFAULTS.drivers],
        currentIndex: typeof parsed.currentIndex === "number" ? parsed.currentIndex : 0,
        shiftStartAt: typeof parsed.shiftStartAt === "number" ? parsed.shiftStartAt : Date.now(),
      };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  let data = loadData();
  let intervalId = null;

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  // Shared value when present and sane; local data as the fallback.
  function currentState() {
    if (sync) {
      const rc = sync.get("rotation.current");
      if (rc && typeof rc.index === "number" && typeof rc.startAt === "number") return rc;
    }
    return { index: data.currentIndex, startAt: data.shiftStartAt };
  }

  function driverName(i) {
    if (sync) {
      const n = sync.get(`rotation.driver.${i}`);
      if (typeof n === "string") return n;
    }
    return data.drivers[i];
  }

  function setCurrent(index) {
    const stamp = { index, startAt: nowMs() };
    data.currentIndex = index;
    data.shiftStartAt = stamp.startAt;
    persist();
    if (sync) sync.set("rotation.current", stamp);
  }

  function formatElapsed(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function render() {
    const nameEl = document.getElementById("rotation-current-name");
    const elapsedEl = document.getElementById("rotation-elapsed");
    const statusEl = document.getElementById("rotation-status");
    const card = document.querySelector("#rotation-section .card");
    if (!nameEl) return;

    const state = currentState();
    const current = driverName(state.index) || driverName(0);
    const elapsedMs = nowMs() - state.startAt;

    nameEl.textContent = current || "—";
    elapsedEl.textContent = `driving ${formatElapsed(elapsedMs)}`;

    card.classList.remove("rotation-warn", "rotation-overdue");
    if (elapsedMs >= SWAP_OVERDUE_MS) {
      card.classList.add("rotation-overdue");
      statusEl.textContent = "🔴 Over 3 hours — swap now.";
    } else if (elapsedMs >= SWAP_WARN_MS) {
      card.classList.add("rotation-warn");
      statusEl.textContent = "🟡 Past 2 hours — consider swapping soon.";
    } else {
      statusEl.textContent = "Swap every 2-3 hours per the playbook.";
    }

    updateRosterHighlight();
  }

  // built once on load (and again only when the roster structure itself
  // changes, e.g. via swap) — a periodic full re-render would blow away
  // cursor position and focus if someone's mid-edit on a driver name
  function buildRoster() {
    const roster = document.getElementById("rotation-roster");
    if (!roster) return;

    roster.innerHTML = data.drivers
      .map(
        (name, i) => `
        <div class="roster-item" data-index="${i}">
          <input type="text" class="roster-name-input mono" data-index="${i}" value="${escapeHtml(driverName(i) ?? name)}" aria-label="Driver ${i + 1} name" />
          <button class="btn roster-select-btn" data-index="${i}">Set as driver</button>
        </div>
      `
      )
      .join("");

    roster.querySelectorAll(".roster-name-input").forEach((input) => {
      input.addEventListener("input", () => {
        const i = Number(input.dataset.index);
        data.drivers[i] = input.value;
        persist();
        if (sync) sync.set(`rotation.driver.${i}`, input.value);
        const nameEl = document.getElementById("rotation-current-name");
        if (i === currentState().index && nameEl) nameEl.textContent = input.value || "—";
      });
    });

    roster.querySelectorAll(".roster-select-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setCurrent(Number(btn.dataset.index));
        render();
      });
    });

    updateRosterHighlight();
  }

  // toggles which roster row is marked "current" without touching any
  // input's value or focus state
  function updateRosterHighlight() {
    const roster = document.getElementById("rotation-roster");
    if (!roster) return;
    const currentIndex = currentState().index;
    roster.querySelectorAll(".roster-item").forEach((item) => {
      const isCurrent = Number(item.dataset.index) === currentIndex;
      item.classList.toggle("is-current", isCurrent);
      const btn = item.querySelector(".roster-select-btn");
      btn.disabled = isCurrent;
      btn.textContent = isCurrent ? "Driving now" : "Set as driver";
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function swap() {
    setCurrent((currentState().index + 1) % data.drivers.length);
    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("rotation-section")) return;
    buildRoster();
    render();
    document.getElementById("rotation-swap-btn").addEventListener("click", swap);
    intervalId = setInterval(render, 30000);

    if (sync) {
      sync.subscribe("rotation.", () => {
        // update non-focused name inputs to the remote value; never touch the
        // one someone is mid-edit on
        document.querySelectorAll(".roster-name-input").forEach((input) => {
          if (input === document.activeElement) return;
          const v = driverName(Number(input.dataset.index));
          if (typeof v === "string" && input.value !== v) input.value = v;
        });
        render();
      });
    }
  });
})();
