(() => {
  // Assumptions, confirmed with the user before implementing — see charging.html
  // commit history / conversation for the full derivation:
  //   - 75 kWh usable pack (Model Y Long Range AWD)
  //   - 290 Wh/mi real-world highway efficiency = 250 Wh/mi EPA baseline
  //     x1.08 (75-80mph highway) x1.04 (AC + battery thermal mgmt in 100°F+ heat)
  //     x1.03 (5 adults + luggage vs EPA test weight) = +15.7% over EPA
  //   - elevation: +2 Wh/ft for net climbs, -1.4 Wh/ft credit for net descents
  //     (~70% regen recovery — real, but not full recovery)
  //   - depart every stop at 90% unless the stop's own card carries a
  //     data-depart-pct override (Weatherford, Gallup, Limon all recommend 100%)
  const BATTERY_WH = 75000;
  const EFFICIENCY_WH_PER_MI = 290;
  const CLIMB_WH_PER_FT = 2;
  const DESCENT_WH_PER_FT = 1.4;
  const DEFAULT_DEPART_PCT = 90;

  function pctOfBattery(wh) {
    return (wh / BATTERY_WH) * 100;
  }

  function legTotalPct(miles, elevDelta) {
    const distWh = miles * EFFICIENCY_WH_PER_MI;
    const elevWh = elevDelta >= 0 ? elevDelta * CLIMB_WH_PER_FT : elevDelta * DESCENT_WH_PER_FT;
    return pctOfBattery(distWh + elevWh);
  }

  function renderDepartRecommend(card, departPct) {
    const timer = card.querySelector(".charge-timer");
    const note = document.createElement("div");
    note.className = "depart-recommend";
    note.textContent = `⚡ Recommended departure charge here: ${departPct}% before continuing`;
    if (timer) {
      timer.parentNode.insertBefore(note, timer);
    } else {
      card.appendChild(note);
    }
  }

  function renderSocInfo(card, miles, elevDelta, arrivalPct, opts) {
    opts = opts || {};
    const div = document.createElement("div");
    div.className = "soc-info";

    const elevText =
      elevDelta > 0
        ? `+${Math.round(elevDelta)} ft climb`
        : elevDelta < 0
        ? `${Math.round(elevDelta)} ft descent (regen recovers much of this)`
        : "flat";

    let badgeClass = "";
    let badgeText = "";
    if (arrivalPct < 10) {
      badgeClass = "soc-critical";
      badgeText = " 🔴 critical";
    } else if (arrivalPct < 20) {
      badgeClass = "soc-warning";
      badgeText = " 🟡 low";
    }

    const legLabel = opts.isReturnLeg ? "Return leg" : "This leg";
    const caveat = opts.caveat ? `<span class="mono small" style="color:var(--text-faint);display:block;margin-top:0.2rem;">${opts.caveat}</span>` : "";

    div.innerHTML = `
      <span class="mono small">${legLabel}: ${Math.round(miles)} mi · ${elevText}</span>
      <span class="mono small soc-arrival ${badgeClass}">Est. arrival: ${Math.round(arrivalPct)}%${badgeText}</span>
      ${caveat}
    `;

    const timer = card.querySelector(".charge-timer");
    if (timer) {
      timer.parentNode.insertBefore(div, timer);
    } else {
      card.appendChild(div);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const stops = Array.from(document.querySelectorAll(".stop-card[data-elevation]"));
    if (stops.length === 0) return;

    let prevElevation = null;
    let prevDepartOverride = null;

    stops.forEach((card) => {
      const elevation = parseFloat(card.dataset.elevation);
      const distancePrev = card.dataset.distancePrev ? parseFloat(card.dataset.distancePrev) : null;
      const departOverride = card.dataset.departPct ? parseFloat(card.dataset.departPct) : null;
      const caveat = card.dataset.socCaveat || null;

      if (departOverride) {
        renderDepartRecommend(card, departOverride);
      }

      if (prevElevation !== null && distancePrev !== null) {
        const departPct = prevDepartOverride || DEFAULT_DEPART_PCT;
        const elevDelta = elevation - prevElevation;
        const totalPct = legTotalPct(distancePrev, elevDelta);
        const arrivalPct = departPct - totalPct;
        renderSocInfo(card, distancePrev, elevDelta, arrivalPct, { caveat });
      }

      prevElevation = elevation;
      prevDepartOverride = departOverride;
    });

    // synthetic return-to-OKC leg — OKC's card sits at the very start of the
    // DOM (it's the trip's single start/finish card), so the sequential walk
    // above never reaches it as a "next stop." Wired up separately here.
    const okcCard = document.querySelector('[data-stop-id="oklahoma-city"]');
    const wichitaCard = document.querySelector('[data-stop-id="wichita"]');
    if (okcCard && wichitaCard && okcCard.dataset.returnDistance) {
      const returnMiles = parseFloat(okcCard.dataset.returnDistance);
      const okcElev = parseFloat(okcCard.dataset.elevation);
      const wichitaElev = parseFloat(wichitaCard.dataset.elevation);
      const elevDelta = okcElev - wichitaElev;
      const totalPct = legTotalPct(returnMiles, elevDelta);
      const arrivalPct = DEFAULT_DEPART_PCT - totalPct; // Wichita has no departure override
      renderSocInfo(okcCard, returnMiles, elevDelta, arrivalPct, { isReturnLeg: true });
    }
  });
})();
