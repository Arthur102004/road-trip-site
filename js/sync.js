// Offline-first shared state for the 5-person crew, backed by Supabase.
//
// Design in one paragraph: every shared value is one field key mapping to
// {v: value, t: client-epoch-ms, by: device-id}. Writes land in localStorage
// and render immediately; a pending queue flushes to a single sync_trip RPC
// (push + pull in one round trip) whenever we're online. Conflict resolution
// is per-field last-write-wins on t (device id breaks ties), enforced BOTH
// server-side (see supabase/schema.sql) and client-side on merge, so a stale
// remote value can never overwrite a newer local one no matter the arrival
// order. Client clocks are corrected by the measured server offset, and the
// server clamps far-future timestamps. This is deliberately not a CRDT —
// per-field LWW is the right size for checkbox-grade data.
//
// Config (Supabase URL + anon key + trip secret) arrives ONLY via the shared
// link's URL fragment (#sync=base64url(json)) — never the repo, since GitHub
// Pages serves the repo verbatim. Without config the site runs local-only.
(() => {
  const CONFIG_KEY = "roadtrip-sync-config";
  const DEVICE_KEY = "roadtrip-device-id";
  const WHO_KEY = "roadtrip-who";
  const STATE_KEY = "roadtrip-sync-state";

  const FLUSH_DEBOUNCE_MS = 1500;
  const POLL_INTERVAL_MS = 25000;
  const BACKOFF_BASE_MS = 5000;
  const BACKOFF_MAX_MS = 120000;

  const CREW = ["Arthur", "Driver 1", "Driver 2", "Flyer 1", "Flyer 2"];

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch (e) {}
  }

  // ---- config: capture from #sync= fragment, else localStorage ----

  function captureConfigFromFragment() {
    const m = window.location.hash.match(/[#&]sync=([A-Za-z0-9_-]+)/);
    if (!m) return;
    try {
      const json = atob(m[1].replace(/-/g, "+").replace(/_/g, "/"));
      const cfg = JSON.parse(json);
      if (cfg && cfg.url && cfg.key && cfg.secret) {
        writeJson(CONFIG_KEY, { url: cfg.url.replace(/\/+$/, ""), key: cfg.key, secret: cfg.secret });
        // Strip the credential from the address bar; it lives in localStorage now.
        const cleaned = window.location.hash.replace(/[#&]sync=[A-Za-z0-9_-]+/, "");
        history.replaceState(null, "", window.location.pathname + window.location.search + (cleaned.length > 1 ? cleaned : ""));
      }
    } catch (e) {}
  }

  captureConfigFromFragment();
  const config = readJson(CONFIG_KEY, null);

  // ---- identity ----

  let deviceId = null;
  try {
    deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId) {
      deviceId = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
      localStorage.setItem(DEVICE_KEY, deviceId);
    }
  } catch (e) {
    deviceId = "ephemeral";
  }

  // ---- state ----

  const state = readJson(STATE_KEY, null) || { fields: {}, pending: {}, clockOffset: 0, lastSyncAt: null };
  if (!state.fields) state.fields = {};
  if (!state.pending) state.pending = {};

  let flushTimer = null;
  let pollTimer = null;
  let inFlight = false;
  let backoffMs = 0;
  let lastError = false;
  let readyFired = false;

  const subscribers = []; // { prefix, cb }
  const readyCbs = []; // fired once, after the first successful sync of this page load

  function persistState() {
    writeJson(STATE_KEY, state);
  }

  function now() {
    return Date.now() + (state.clockOffset || 0);
  }

  function notify(keys) {
    subscribers.forEach((sub) => {
      if (keys.some((k) => k.startsWith(sub.prefix))) {
        try {
          sub.cb();
        } catch (e) {}
      }
    });
  }

  // ---- merge rule (client side; mirrors the server's) ----

  function remoteWins(remote, local) {
    if (!local) return true;
    if (remote.t !== local.t) return remote.t > local.t;
    return (remote.by || "") > (local.by || "");
  }

  // ---- flush ----

  function scheduleFlush() {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, FLUSH_DEBOUNCE_MS);
  }

  function flush() {
    if (!config || inFlight || !navigator.onLine) {
      renderStatus();
      return;
    }
    inFlight = true;
    renderStatus();

    // Snapshot: what we're claiming to the server right now. If the user
    // writes again while this request is in flight, pending[key].t moves
    // past the snapshot and the ack below leaves it queued.
    const snapshot = Object.entries(state.pending).map(([key, f]) => ({
      key,
      value: f.v,
      ts: f.t,
      device: f.by,
    }));

    fetch(config.url + "/rest/v1/rpc/sync_trip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.key,
        Authorization: "Bearer " + config.key,
      },
      body: JSON.stringify({ secret: config.secret, changes: snapshot }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("sync failed: " + res.status);
        return res.json();
      })
      .then((result) => {
        state.clockOffset = result.server_time - Date.now();

        const pushedKeys = new Set(snapshot.map((c) => c.key));
        snapshot.forEach((c) => {
          const p = state.pending[c.key];
          if (p && p.t === c.ts) delete state.pending[c.key]; // acked; newer re-writes stay queued
        });

        const changed = [];
        const remoteFields = result.fields || {};
        Object.entries(remoteFields).forEach(([key, remote]) => {
          const local = state.fields[key];
          const stillPending = state.pending[key];
          // Keys we just pushed: the server's answer is the post-LWW truth
          // (our write won, or legitimately lost to a strictly newer one) —
          // unless the user wrote again mid-flight, in which case the newer
          // pending value keeps rendering and syncs next round.
          // All other keys: strict LWW, so a stale remote never overwrites.
          const apply = stillPending
            ? remoteWins(remote, stillPending)
            : pushedKeys.has(key) || remoteWins(remote, local);
          if (apply && (!local || local.t !== remote.t || (local.by || "") !== (remote.by || "") || JSON.stringify(local.v) !== JSON.stringify(remote.v))) {
            state.fields[key] = { v: remote.v, t: remote.t, by: remote.by };
            if (stillPending && remoteWins(remote, stillPending)) delete state.pending[key];
            changed.push(key);
          }
        });

        state.lastSyncAt = Date.now();
        lastError = false;
        backoffMs = 0;
        inFlight = false;
        persistState();
        renderStatus();
        if (!readyFired) {
          readyFired = true;
          readyCbs.splice(0).forEach((cb) => {
            try {
              cb();
            } catch (e) {}
          });
        }
        if (changed.length > 0) notify(changed);
        // Anything still pending (mid-flight rewrites) goes out next round.
        if (Object.keys(state.pending).length > 0) scheduleFlush();
      })
      .catch(() => {
        inFlight = false;
        lastError = true;
        backoffMs = Math.min(backoffMs ? backoffMs * 2 : BACKOFF_BASE_MS, BACKOFF_MAX_MS);
        persistState();
        renderStatus();
        clearTimeout(flushTimer);
        flushTimer = setTimeout(flush, backoffMs);
      });
  }

  // ---- status pill ----

  let pill = null;

  function fmtTime(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function renderStatus() {
    if (!document.body) return;
    if (!pill) {
      pill = document.createElement("div");
      pill.className = "sync-pill mono no-print";
      pill.setAttribute("role", "status");
      document.body.appendChild(pill);
    }
    const pendingCount = Object.keys(state.pending).length;
    if (!config) {
      pill.textContent = "● local only";
      pill.dataset.state = "local";
    } else if (!navigator.onLine) {
      pill.textContent = pendingCount > 0 ? `● offline · ${pendingCount} queued` : "● offline";
      pill.dataset.state = "offline";
    } else if (pendingCount > 0 || inFlight) {
      pill.textContent = `● ${pendingCount} pending…`;
      pill.dataset.state = "pending";
    } else if (lastError) {
      pill.textContent = "● sync error · retrying";
      pill.dataset.state = "offline";
    } else {
      pill.textContent = state.lastSyncAt ? `● synced ${fmtTime(state.lastSyncAt)}` : "● connecting…";
      pill.dataset.state = "synced";
    }
  }

  // ---- public API ----

  window.TripSync = {
    enabled: !!config,
    crew: CREW,

    get(key) {
      const f = state.fields[key];
      return f ? f.v : undefined;
    },

    // Server-corrected wall clock. Values that encode a moment in time (e.g.
    // the rotation shift start) should be stamped with this, not Date.now(),
    // so elapsed-time math agrees across phones with skewed clocks.
    now,

    // All entries under a prefix, e.g. entries("packing.item.")
    entries(prefix) {
      const out = {};
      Object.entries(state.fields).forEach(([key, f]) => {
        if (key.startsWith(prefix)) out[key] = f.v;
      });
      return out;
    },

    set(key, value) {
      const stamp = { v: value, t: now(), by: deviceId };
      state.fields[key] = stamp;
      state.pending[key] = stamp;
      persistState();
      renderStatus();
      scheduleFlush();
    },

    subscribe(prefix, cb) {
      subscribers.push({ prefix, cb });
    },

    // Runs cb after this page load's first successful sync (immediately when
    // sync is disabled, or when this device has synced in a previous session).
    // Guards default-seeding: a fresh device must NOT write defaults with new
    // timestamps before its first pull, or they'd win LWW over the crew's
    // real, older data.
    onReady(cb) {
      if (!config || readyFired || state.lastSyncAt) {
        cb();
      } else {
        readyCbs.push(cb);
      }
    },

    who() {
      try {
        return localStorage.getItem(WHO_KEY) || null;
      } catch (e) {
        return null;
      }
    },

    setWho(name) {
      try {
        localStorage.setItem(WHO_KEY, name);
      } catch (e) {}
    },

    status() {
      return {
        enabled: !!config,
        online: navigator.onLine,
        pending: Object.keys(state.pending).length,
        lastSyncAt: state.lastSyncAt,
      };
    },

    // Shared "You are: <name>" chip row used by the pot and the splurge vote.
    renderWhoRow(container, onChange) {
      const self = this;
      container.setAttribute("role", "group");
      container.setAttribute("aria-label", "Select who you are");
      function draw() {
        const who = self.who();
        container.innerHTML = "";
        const label = document.createElement("span");
        label.className = "small mono";
        label.textContent = who ? "You are:" : "Who are you?";
        container.appendChild(label);
        CREW.forEach((name) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "who-chip" + (who === name ? " who-active" : "");
          chip.textContent = name;
          chip.setAttribute("aria-pressed", String(who === name));
          chip.addEventListener("click", () => {
            self.setWho(name);
            draw();
            if (onChange) onChange(name);
          });
          container.appendChild(chip);
        });
      }
      draw();
    },

    flushNow: flush,
  };

  // ---- lifecycle ----

  window.addEventListener("online", () => {
    backoffMs = 0;
    renderStatus();
    flush();
  });
  window.addEventListener("offline", renderStatus);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") flush();
  });

  document.addEventListener("DOMContentLoaded", () => {
    renderStatus();
    if (config) {
      flush(); // initial pull (+push of anything queued from last session)
      pollTimer = setInterval(() => {
        if (document.visibilityState === "visible" && navigator.onLine && !inFlight) flush();
      }, POLL_INTERVAL_MS);
    }
  });
})();
