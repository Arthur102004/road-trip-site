// Applies a locked return-route decision (js/return-variants.js) to the
// static day-cards already in itinerary.html. Reads the synced decision
// field and swaps in the pre-built variant live -- no deploy, no Claude Code
// run needed once a decision is locked on return-route-decision.html.
//
// Design: TripSync.get() returns whatever this device last knew (its
// localStorage-cached copy), synchronously, even before this page's first
// network sync resolves -- so the initial render below is correct on repeat
// visits, and the subscribe() call catches the rare cases where the value
// changes after paint (first-ever sync completing, or someone else locking/
// unlocking while this tab is open).
(() => {
  const sync = window.TripSync && window.TripSync.enabled ? window.TripSync : null;
  const DECISION_KEY = "decision.returnRoute";
  const DECISION_LOCAL_KEY = "roadtrip-route-decision-v1"; // matches js/return-decision.js's local fallback
  let appliedKey = null; // which variant (or null = default) is currently rendered

  function getDecision() {
    if (sync) return sync.get(DECISION_KEY) || null;
    try {
      const raw = localStorage.getItem(DECISION_LOCAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function escapeIR(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function chargeCalloutHTML(charge) {
    return (
      '<div class="callout">' +
      '<span class="pill pill-return" style="background:transparent;border-color:var(--border);color:var(--text-dim);">⚡ Charge</span> ' +
      charge +
      "</div>"
    );
  }

  function buildDayCardHTML(day) {
    const parts = [];
    parts.push('<div class="card ' + day.legClass + ' day-card" id="' + day.id + '">');
    parts.push('<div class="day-head">');
    parts.push('<span class="pill ' + day.pillClass + '">' + escapeIR(day.pillLabel) + "</span>");
    parts.push('<span class="day-date mono">' + escapeIR(day.dateLabel) + "</span>");
    parts.push('<h3 style="margin:0;">' + escapeIR(day.title) + "</h3>");
    parts.push("</div>");

    if (!day.noStats) {
      parts.push('<div class="day-stats">');
      if (day.miles) parts.push('<span class="pill mono">' + escapeIR(day.miles) + "</span>");
      if (day.wake) parts.push('<span class="pill mono">wake 9:00</span>');
      parts.push("</div>");
      parts.push('<div class="weather-strip"></div>');
    }

    if (day.intro) parts.push('<p class="mt-0">' + day.intro + "</p>");
    if (day.warning) parts.push('<div class="callout" style="border-color:var(--gold-dim);">' + day.warning + "</div>");

    if (day.bullets && day.bullets.length) {
      parts.push("<ul>");
      day.bullets.forEach((b) => parts.push("<li>" + b + "</li>"));
      parts.push("</ul>");
    }

    if (day.charge) parts.push(chargeCalloutHTML(day.charge));
    if (day.eat) parts.push('<div class="callout"><span class="pill pill-food">Eat</span> ' + day.eat + "</div>");
    if (day.bookAhead) {
      parts.push('<div class="callout" style="border-color:var(--gold-dim);"><strong style="color:var(--gold)">Book ahead:</strong> ' + day.bookAhead + "</div>");
    }

    parts.push("</div>");
    return parts.join("");
  }

  function updateHeroAndFooter(variant) {
    const eyebrow = document.querySelector(".hero .eyebrow span");
    if (eyebrow && variant) eyebrow.textContent = variant.totalDays + " Days · " + variant.heroDate;
    const footerSpan = document.querySelector("footer .wrap span");
    if (footerSpan && variant) footerSpan.textContent = "OKC ⇄ Las Vegas · " + variant.footerDate + " · UWC-USA reunion";
  }

  function applyVariant(key) {
    const variant = window.RETURN_VARIANTS && window.RETURN_VARIANTS[key];
    if (!variant) return;

    const container = document.getElementById("itinerary-days");
    let lastNode = null;

    (variant.replaceDays || []).forEach((day) => {
      const existing = document.getElementById(day.id);
      if (!existing) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = buildDayCardHTML(day);
      const newNode = tmp.firstElementChild;
      existing.replaceWith(newNode);
      lastNode = newNode;
      applyTripDataOverride(day);
    });

    (variant.appendDays || []).forEach((day) => {
      const tmp = document.createElement("div");
      tmp.innerHTML = buildDayCardHTML(day);
      const newNode = tmp.firstElementChild;
      if (lastNode && lastNode.parentNode === container) {
        lastNode.after(newNode);
      } else if (container) {
        container.appendChild(newNode);
      }
      lastNode = newNode;
      applyTripDataOverride(day);
    });

    updateHeroAndFooter(variant);

    const pendingCallout = document.getElementById("pending-decision-callout");
    if (pendingCallout) pendingCallout.hidden = true;

    if (window.relinkItineraryDayHeadings) window.relinkItineraryDayHeadings();
    if (window.renderTripWeather) window.renderTripWeather(false);
  }

  function applyTripDataOverride(day) {
    if (!window.TRIP_DAYS || !day.tripData) return;
    const entry = Object.assign({ date: day.date, label: day.dateLabel, leg: "return" }, day.tripData);
    const idx = window.TRIP_DAYS.findIndex((d) => d.date === day.date);
    if (idx === -1) {
      window.TRIP_DAYS.push(entry);
      window.TRIP_DAYS.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    } else {
      window.TRIP_DAYS[idx] = entry;
    }
  }

  function renderFromDecision() {
    const decision = getDecision();
    const key = decision && decision.option ? decision.option : null;

    if (key === appliedKey) return; // nothing changed, avoid a redundant reflow

    if (!key) {
      // Reverting to the default (unlocked) itinerary is a rare, deliberate
      // action -- a reload is the simplest way to get back the exact
      // original static markup without keeping a second copy of it as data.
      if (appliedKey) location.reload();
      return;
    }

    applyVariant(key);
    appliedKey = key;
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("itinerary-days")) return;
    renderFromDecision();
    if (sync) sync.subscribe(DECISION_KEY, renderFromDecision);
  });
})();
