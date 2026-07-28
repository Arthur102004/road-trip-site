(() => {
  const checks = Array.from(document.querySelectorAll(".budget-check"));
  const summary = document.getElementById("budget-summary");
  const countEl = document.getElementById("budget-summary-count");
  const totalEl = document.getElementById("budget-total");
  const clearBtn = document.getElementById("budget-clear");

  if (!checks.length || !summary) return;

  function update() {
    const selected = checks.filter((c) => c.checked);
    const total = selected.reduce((sum, c) => sum + (parseFloat(c.dataset.cost) || 0), 0);
    countEl.textContent = selected.length + (selected.length === 1 ? " activity selected" : " activities selected");
    totalEl.textContent = "$" + total.toLocaleString();
    summary.classList.toggle("has-selection", selected.length > 0);
  }

  checks.forEach((c) => c.addEventListener("change", update));

  clearBtn.addEventListener("click", () => {
    checks.forEach((c) => {
      c.checked = false;
    });
    update();
  });

  update();
})();

// ---------- splurge vote (shared via TripSync when enabled) ----------
// One field per person per option (`vote.<splurge>.<person>` = bool), so no
// two people's votes can ever conflict; per-field LWW only ever arbitrates
// one person changing their own mind on two devices. The cost-planner
// checkboxes above stay device-local on purpose.
(() => {
  const LOCAL_KEY = "roadtrip-vote-v1";
  const MAX_VOTES = 2;
  const CREW = (window.TripSync && window.TripSync.crew) || ["Arthur", "Driver 1", "Driver 2", "Flyer 1", "Flyer 2"];
  const sync = window.TripSync && window.TripSync.enabled ? window.TripSync : null;

  function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function localLoad() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function getVote(splurgeId, personSlug) {
    const key = `vote.${splurgeId}.${personSlug}`;
    if (sync) return !!sync.get(key);
    return !!localLoad()[key];
  }

  function setVote(splurgeId, personSlug, val) {
    const key = `vote.${splurgeId}.${personSlug}`;
    if (sync) {
      sync.set(key, val);
    } else {
      const data = localLoad();
      data[key] = val;
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
      } catch (e) {}
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const items = Array.from(document.querySelectorAll(".budget-item[data-splurge-id]"));
    if (items.length === 0) return;

    const label = document.getElementById("vote-sync-label");
    if (label) label.textContent = sync ? "shared across the crew" : "this device only";

    const blocks = new Map(); // splurgeId -> {btn, tally}

    function myVoteCount(who) {
      const me = slug(who);
      return items.filter((it) => getVote(it.dataset.splurgeId, me)).length;
    }

    function render() {
      const who = sync && sync.who ? sync.who() : null;
      items.forEach((item) => {
        const id = item.dataset.splurgeId;
        const { btn, tally } = blocks.get(id);
        const voters = CREW.filter((name) => getVote(id, slug(name)));
        const mine = who ? getVote(id, slug(who)) : false;

        btn.disabled = !who;
        btn.title = who ? "" : "Pick who you are first";
        btn.classList.toggle("voted", mine);
        btn.setAttribute("aria-pressed", String(mine));
        btn.textContent = mine ? "★ Voted" : "☆ Vote";

        tally.innerHTML =
          `${voters.length} vote${voters.length === 1 ? "" : "s"}` +
          (voters.length ? ` <span class="vote-names">· ${voters.join(", ")}</span>` : "");
      });
    }

    items.forEach((item) => {
      const id = item.dataset.splurgeId;
      const block = document.createElement("div");
      block.className = "vote-block";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vote-btn";
      const tally = document.createElement("span");
      tally.className = "vote-tally";
      block.appendChild(btn);
      block.appendChild(tally);
      // Sibling of the <label>, not inside it — otherwise tapping Vote would
      // also toggle the cost-planner checkbox.
      item.insertAdjacentElement("afterend", block);
      blocks.set(id, { btn, tally });

      btn.addEventListener("click", () => {
        const who = sync && sync.who ? sync.who() : localStorage.getItem("roadtrip-who");
        if (!who) return;
        const mine = getVote(id, slug(who));
        if (!mine && myVoteCount(who) >= MAX_VOTES) {
          tally.innerHTML = `<span class="vote-names">vote on ${MAX_VOTES} max — un-vote something first</span>`;
          setTimeout(render, 2500);
          return;
        }
        setVote(id, slug(who), !mine);
        render();
      });
    });

    const whoRow = document.getElementById("vote-who-row");
    if (whoRow && window.TripSync) window.TripSync.renderWhoRow(whoRow, render);

    render();
    if (sync) sync.subscribe("vote.", render);
  });
})();
