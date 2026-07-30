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

// ---------- return-route group vote + locked decision ----------
// Vote: one field per option per person (`vote.returnRoute.<option>.<slug>`)
// so two people picking different options offline never conflict; a person
// picking a new option clears their vote on the others first (single-select,
// unlike the splurge vote's max-2). Decision: ONE atomic field holding
// {option, lockedBy, lockedAt} (or null) -- atomic for the same reason the
// driving-rotation state is atomic: option/lockedBy/lockedAt must never be
// mixed from two different lock events under last-write-wins.
(() => {
  const VOTE_LOCAL_KEY = "roadtrip-route-vote-v1";
  const DECISION_LOCAL_KEY = "roadtrip-route-decision-v1";
  const DECISION_KEY = "decision.returnRoute";
  const CREW = (window.TripSync && window.TripSync.crew) || ["Arthur", "Driver 1", "Driver 2", "Flyer 1", "Flyer 2"];
  const sync = window.TripSync && window.TripSync.enabled ? window.TripSync : null;

  const ROUTE_OPTIONS = [
    { key: "A", label: "A - Extend to 12 days" },
    { key: "B1", label: "B1 - Drop a Vegas day" },
    { key: "B2", label: "B2 - Drop the Grand Junction night" },
    { key: "C", label: "C - One long mega-day" },
  ];

  function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function escapeRD(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function localJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function who() {
    return sync ? sync.who() : localStorage.getItem("roadtrip-who");
  }

  function voteKey(optionKey, personSlug) {
    return "vote.returnRoute." + optionKey + "." + personSlug;
  }

  function getVote(optionKey, personSlug) {
    if (sync) return !!sync.get(voteKey(optionKey, personSlug));
    return !!localJson(VOTE_LOCAL_KEY, {})[voteKey(optionKey, personSlug)];
  }

  function setVote(optionKey, personSlug, val) {
    if (sync) {
      sync.set(voteKey(optionKey, personSlug), val);
    } else {
      const v = localJson(VOTE_LOCAL_KEY, {});
      v[voteKey(optionKey, personSlug)] = val;
      try {
        localStorage.setItem(VOTE_LOCAL_KEY, JSON.stringify(v));
      } catch (e) {}
    }
  }

  function renderVotes() {
    const container = document.getElementById("route-vote-rows");
    if (!container) return;
    const me = who();
    container.innerHTML = "";
    ROUTE_OPTIONS.forEach((opt) => {
      const voters = CREW.filter((name) => getVote(opt.key, slug(name)));
      const mine = me ? getVote(opt.key, slug(me)) : false;
      const row = document.createElement("div");
      row.className = "route-vote-row";
      const btnAttrs = me ? "" : ' disabled title="Pick who you are first"';
      const namesHtml = voters.length ? ' <span class="vote-names">' + voters.map(escapeRD).join(", ") + "</span>" : "";
      row.innerHTML =
        '<span class="route-vote-label">' + escapeRD(opt.label) + "</span>" +
        '<button type="button" class="vote-btn' + (mine ? " voted" : "") + '"' + btnAttrs + ">" + (mine ? "★ Your pick" : "☆ Pick this") + "</button>" +
        '<span class="vote-tally">' + voters.length + " vote" + (voters.length === 1 ? "" : "s") + namesHtml + "</span>";
      row.querySelector(".vote-btn").addEventListener("click", () => {
        const meNow = who();
        if (!meNow) return;
        const mySlug = slug(meNow);
        const currentlyMine = getVote(opt.key, mySlug);
        ROUTE_OPTIONS.forEach((o) => {
          if (o.key !== opt.key) setVote(o.key, mySlug, false);
        });
        setVote(opt.key, mySlug, !currentlyMine);
        renderVotes();
      });
      container.appendChild(row);
    });
  }

  function getDecision() {
    if (sync) return sync.get(DECISION_KEY) || null;
    return localJson(DECISION_LOCAL_KEY, null);
  }

  function setDecision(val) {
    if (sync) {
      sync.set(DECISION_KEY, val);
    } else {
      try {
        localStorage.setItem(DECISION_LOCAL_KEY, JSON.stringify(val));
      } catch (e) {}
    }
  }

  function fmtWhen(ms) {
    return new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function renderDecisionStatus() {
    const card = document.getElementById("decision-status-card");
    if (!card) return;
    const decision = getDecision();

    if (decision && decision.option) {
      const meta = ROUTE_OPTIONS.find((o) => o.key === decision.option);
      const label = meta ? meta.label.replace(/^[A-Za-z0-9]+ - /, "") : "";
      const lockedLine = decision.lockedBy ? "Locked by " + escapeRD(decision.lockedBy) : "Locked";
      const whenLine = decision.lockedAt ? " · " + fmtWhen(decision.lockedAt) : "";
      card.className = "card card-accent decision-banner-locked";
      card.innerHTML =
        '<h3 class="mt-0">✅ Decided: Option ' + escapeRD(decision.option) + " - " + escapeRD(label) + "</h3>" +
        '<p class="small mt-0">' + lockedLine + whenLine + '. The <a href="itinerary.html">Itinerary page</a> now shows this route automatically -- no site update needed.</p>' +
        '<button class="btn" id="unlock-decision-btn">🔓 Unlock / change decision</button>';
      const unlockBtn = document.getElementById("unlock-decision-btn");
      if (unlockBtn) {
        unlockBtn.addEventListener("click", () => {
          setDecision(null);
          renderDecisionStatus();
        });
      }
    } else {
      card.className = "card card-accent";
      card.innerHTML = '<p class="mt-0 small">No decision locked yet -- vote below, then whoever\'s ready can lock one in. The <a href="itinerary.html">Itinerary page</a> keeps showing the original Kansas route until then.</p>';
    }

    document.querySelectorAll(".section[data-option]").forEach((section) => {
      const opt = section.dataset.option;
      const isDecided = !!(decision && decision.option === opt);
      const isCollapsed = !!(decision && decision.option && !isDecided);
      section.classList.toggle("option-decided", isDecided);
      section.classList.toggle("option-collapsed", isCollapsed);
      const toggleBtn = section.querySelector(".option-toggle-btn");
      if (toggleBtn) toggleBtn.hidden = !isCollapsed;
    });
  }

  function initLockButtons() {
    document.querySelectorAll(".lock-decision-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const statusEl = document.getElementById("decision-status-card");
        const me = who();
        if (!me) {
          if (statusEl) {
            const notice = document.createElement("p");
            notice.className = "small mono";
            notice.style.color = "var(--gold)";
            notice.textContent = "Pick who you are in the Group Vote section first.";
            statusEl.prepend(notice);
            setTimeout(() => notice.remove(), 3000);
          }
          return;
        }
        setDecision({ option: btn.dataset.option, lockedBy: me, lockedAt: Date.now() });
        renderDecisionStatus();
        if (statusEl) statusEl.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    document.querySelectorAll(".option-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const section = document.querySelector('.section[data-option="' + btn.dataset.option + '"]');
        if (section) section.classList.remove("option-collapsed");
        btn.hidden = true;
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("route-vote-rows")) return;

    const syncLabel = document.getElementById("route-vote-sync-label");
    if (syncLabel) syncLabel.textContent = sync ? "shared across the crew" : "this device only";

    const whoRow = document.getElementById("route-vote-who-row");
    if (whoRow && window.TripSync) window.TripSync.renderWhoRow(whoRow, renderVotes);

    renderVotes();
    renderDecisionStatus();
    initLockButtons();

    if (sync) {
      sync.subscribe("vote.returnRoute.", renderVotes);
      sync.subscribe(DECISION_KEY, renderDecisionStatus);
    }
  });
})();
