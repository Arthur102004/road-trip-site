(() => {
  const STORAGE_KEY = "roadtrip-info-v1";

  // leg: which color-coded stage of the trip this row belongs to —
  // drives the little route dot in the first table column
  const DEFAULTS = {
    flights: [
      { who: "Arthur", date: "Jul 31, 10:14 AM arrival", route: "Syracuse → OKC (connecting)", conf: "Delta 1108 → Delta 2490", leg: "outbound" },
      { who: "Flyer 1", date: "Aug 3", route: "Home → Las Vegas", conf: "", leg: "vegas" },
      { who: "Flyer 2", date: "Aug 3", route: "Home → Las Vegas", conf: "", leg: "vegas" },
      { who: "Arthur", date: "Aug 10, 11:19 AM departure", route: "OKC → Syracuse (connecting)", conf: "Delta 2490 → Delta 2690", leg: "return" },
      { who: "Flyer 1", date: "Aug 10", route: "OKC → Home", conf: "", leg: "return" },
      { who: "Flyer 2", date: "Aug 10", route: "OKC → Home", conf: "", leg: "return" },
    ],
    stays: [
      { night: "Thu Jul 30", city: "Oklahoma City", status: "searching", leg: "outbound" },
      { night: "Fri Jul 31", city: "Santa Rosa, NM", status: "not-booked", leg: "outbound" },
      { night: "Sat Aug 1", city: "Albuquerque, NM", status: "not-booked", leg: "outbound" },
      { night: "Sun Aug 2", city: "Phoenix, AZ", status: "not-booked", leg: "outbound" },
      { night: "Aug 3-7 (4 nights)", city: "LAS VEGAS: Airbnb \"Modern 5B/3B, Near Strip\"", status: "booked", leg: "vegas" },
      { night: "Fri Aug 7", city: "Grand Junction, CO", status: "not-booked", leg: "return" },
      { night: "Sat Aug 8", city: "Hays, KS", status: "not-booked", leg: "return" },
      { night: "Sun Aug 9", city: "Oklahoma City (near airport)", status: "searching", leg: "return" },
    ],
    hotelClaims: {
      "santa-rosa": { claimed: false, name: "" },
      "albuquerque": { claimed: false, name: "" },
      "phoenix": { claimed: false, name: "" },
      "grand-junction": { claimed: false, name: "" },
      "hays": { claimed: false, name: "" },
    },
    checklist: [
      { id: 1, text: "Book the five stopover hotels (Santa Rosa, Albuquerque, Phoenix, Grand Junction, Hays). Picks are ready above; someone needs to claim and book each one.", done: false },
      { id: 2, text: "Tell the other two drivers the plan for Jul 30-31. They land Jul 30 and prep the Model Y (charge, supplies, controls); Arthur lands Jul 31 at 10:14 AM and they pick him up straight from the airport before departing for Santa Rosa.", done: false },
      { id: 3, text: "Double-check Arthur's return flight numbers. Delta 2490 shows up on both his outbound and return connections; confirm that's not a typo.", done: false },
      { id: 4, text: "Book the Tesla Model Y in OKC, round trip. Under 25, so expect a young-driver surcharge (~$25-35/day); confirm the age policy and the charging-return rule. Photograph the car at pickup.", done: false },
      { id: 5, text: "Email UWC admissions to arrange the Saturday, Aug 1 visit (campus is closed weekends).", done: false },
      { id: 6, text: "Book flights: both flyers into Las Vegas on Aug 3; all five out of OKC on Aug 10.", done: false },
      { id: 7, text: "Agree the cost split: Model Y rental + Supercharging + stopover hotels split five ways; the two flyers add their airfare.", done: false },
      { id: 8, text: "Prep the car day one: charge to 100%, learn the controls, load the Trip Planner.", done: false },
    ],
    notes: "",
  };

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredCloneish(DEFAULTS);
      const parsed = JSON.parse(raw);
      const flights = (parsed.flights ?? structuredCloneish(DEFAULTS.flights)).map((f) => ({ leg: "outbound", ...f }));
      const stays = (parsed.stays ?? structuredCloneish(DEFAULTS.stays)).map((s) => ({ leg: "outbound", ...s }));
      const hotelClaims = { ...structuredCloneish(DEFAULTS.hotelClaims), ...(parsed.hotelClaims ?? {}) };
      return {
        flights,
        stays,
        hotelClaims,
        checklist: parsed.checklist ?? structuredCloneish(DEFAULTS.checklist),
        notes: parsed.notes ?? "",
      };
    } catch (e) {
      return structuredCloneish(DEFAULTS);
    }
  }

  const LEG_LABEL = { outbound: "Outbound", vegas: "Vegas", return: "Return" };

  function legDotCell(leg) {
    return `<td><span class="legend-dot dot-${leg}" title="${LEG_LABEL[leg] ?? leg}"></span></td>`;
  }

  function structuredCloneish(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  let data = loadData();
  let saveTimer = null;

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    flashSaved();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  }

  function flashSaved() {
    const el = document.getElementById("save-flash");
    if (!el) return;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 1200);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  // ---------- flight text parsing (shared by voice + email paste) ----------

  const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const AIRLINES = ["Delta", "United", "American", "Southwest", "JetBlue", "Alaska", "Spirit", "Frontier", "Allegiant", "Hawaiian", "Virgin"];
  const AIRLINE_CODES = ["DL", "UA", "AA", "WN", "B6", "AS", "NK", "F9", "G4", "HA"];

  function parseFlightDate(text) {
    const timeMatch = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
    const timeStr = timeMatch ? `, ${timeMatch[0].replace(/\s+/g, " ").toUpperCase()}` : "";

    let m = text.match(new RegExp(`\\b(${MONTHS.join("|")})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"));
    if (m) {
      const idx = MONTHS.indexOf(m[1].toLowerCase());
      return `${MONTH_ABBR[idx]} ${parseInt(m[2], 10)}${timeStr}`;
    }

    m = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join("|")})\\b`, "i"));
    if (m) {
      const idx = MONTHS.indexOf(m[2].toLowerCase());
      return `${MONTH_ABBR[idx]} ${parseInt(m[1], 10)}${timeStr}`;
    }

    m = text.match(/\b(\d{1,2})\/(\d{1,2})\/\d{2,4}\b/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (idx >= 0 && idx < 12) return `${MONTH_ABBR[idx]} ${parseInt(m[2], 10)}${timeStr}`;
    }

    m = text.match(/\b\d{4}-(\d{2})-(\d{2})\b/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (idx >= 0 && idx < 12) return `${MONTH_ABBR[idx]} ${parseInt(m[2], 10)}${timeStr}`;
    }

    return null;
  }

  function parseFlightNumbers(text) {
    const found = [];
    const nameRe = new RegExp(`\\b(${AIRLINES.join("|")})\\s*#?\\s*(\\d{2,5})\\b`, "gi");
    let m;
    while ((m = nameRe.exec(text)) !== null) {
      const airline = AIRLINES.find((a) => a.toLowerCase() === m[1].toLowerCase());
      found.push(`${airline} ${m[2]}`);
    }
    if (found.length === 0) {
      const codeRe = new RegExp(`\\b(${AIRLINE_CODES.join("|")})\\s*#?\\s*(\\d{2,5})\\b`, "gi");
      while ((m = codeRe.exec(text)) !== null) {
        found.push(`${m[1].toUpperCase()} ${m[2]}`);
      }
    }
    if (found.length === 0) return null;
    return [...new Set(found)].join(" → ");
  }

  function titleCase(s) {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function parseRoute(text) {
    let m = text.match(/\b([A-Z]{3})\s*(?:to|-|→|>)\s*([A-Z]{3})\b/);
    if (m) return `${m[1]} → ${m[2]}`;

    m = text.match(/\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)?)\s+to\s+([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)?)\b/);
    if (m) return `${m[1]} → ${m[2]}`;

    // loose fallback for voice transcripts (usually not capitalized mid-sentence)
    const idx = text.toLowerCase().indexOf(" to ");
    if (idx === -1) return null;
    const before = text.slice(0, idx).trim().split(/\s+/).slice(-2).join(" ");
    const after = text.slice(idx + 4).trim().split(/\s+/).slice(0, 2).join(" ");
    if (!before || !after) return null;
    return `${titleCase(before)} → ${titleCase(after)}`;
  }

  function parseFlightText(text) {
    return {
      date: parseFlightDate(text),
      route: parseRoute(text),
      conf: parseFlightNumbers(text),
    };
  }

  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

  // iOS Safari (and every browser on iOS, since Apple forces them all onto
  // WebKit) has never implemented SpeechRecognition — window.SpeechRecognition
  // and window.webkitSpeechRecognition are both simply undefined there. That
  // makes SpeechRecognitionCtor the right and only feature check; there's no
  // extra iOS-specific detection needed beyond "does this constructor exist."

  function micStatus(msg) {
    const el = document.getElementById("mic-status");
    if (el) el.textContent = msg;
  }

  const MIC_ERROR_MESSAGES = {
    "not-allowed": "Microphone permission was denied. Check your browser's site settings and allow microphone access, then try again.",
    "permission-denied": "Microphone permission was denied. Check your browser's site settings and allow microphone access, then try again.",
    "no-speech": "Didn't catch any speech. Try again and speak right after tapping the mic.",
    "audio-capture": "No microphone found on this device.",
    network: "Network error during voice recognition. Check your connection and try again.",
    "service-not-allowed": "Voice input was blocked by the browser. Try again or type the fields in manually.",
  };

  function startVoiceCapture(index, btn) {
    if (!SpeechRecognitionCtor) {
      micStatus("Voice input isn't supported in this browser (this is common on iPhone/iPad, including Safari and Chrome on iOS). Try Chrome or Edge on Android or desktop, or fill the fields in manually.");
      return;
    }

    let recognition;
    try {
      recognition = new SpeechRecognitionCtor();
    } catch (e) {
      micStatus("Voice input isn't supported in this browser. Try Chrome or Edge on Android or desktop, or fill the fields in manually.");
      return;
    }

    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    btn.classList.add("listening");
    btn.textContent = "●";
    micStatus("Listening… speak the date, route, and flight number.");

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const parsed = parseFlightText(transcript);
      const flight = data.flights[index];
      if (!flight) return;
      let filledAny = false;
      if (parsed.date) { flight.date = parsed.date; filledAny = true; }
      if (parsed.route) { flight.route = parsed.route; filledAny = true; }
      if (parsed.conf) { flight.conf = parsed.conf; filledAny = true; }
      renderFlights();
      persist();
      micStatus(filledAny ? `Heard: "${transcript}"` : `Heard "${transcript}" but couldn't find a date, route, or flight number in it. Try again or fill in manually.`);
    };

    recognition.onerror = (event) => {
      btn.classList.remove("listening");
      btn.textContent = "🎤";
      micStatus(MIC_ERROR_MESSAGES[event.error] || `Voice input failed (${event.error}). Try again or fill the fields in manually.`);
    };

    recognition.onend = () => {
      btn.classList.remove("listening");
      btn.textContent = "🎤";
    };

    try {
      recognition.start();
    } catch (e) {
      btn.classList.remove("listening");
      btn.textContent = "🎤";
      micStatus("Couldn't start voice input. Try again in a moment.");
    }
  }

  // ---------- flights ----------

  function renderFlights() {
    const body = document.getElementById("flights-body");
    body.innerHTML = "";
    data.flights.forEach((f, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        ${legDotCell(f.leg)}
        <td contenteditable="true" data-field="who">${escapeHtml(f.who)}</td>
        <td contenteditable="true" data-field="date">${escapeHtml(f.date)}</td>
        <td contenteditable="true" data-field="route">${escapeHtml(f.route)}</td>
        <td contenteditable="true" data-field="conf">${escapeHtml(f.conf)}</td>
        <td><button class="mic-btn${SpeechRecognitionCtor ? "" : " unsupported"}" data-mic="${i}" title="${SpeechRecognitionCtor ? "Fill this row by voice" : "Voice input isn't supported in this browser: tap for details"}">🎤</button></td>
        <td><button class="btn" data-remove="${i}" title="Remove row">✕</button></td>
      `;
      tr.querySelectorAll("td[contenteditable]").forEach((td) => {
        td.addEventListener("input", () => {
          data.flights[i][td.dataset.field] = td.textContent;
          scheduleSave();
        });
      });
      const micBtn = tr.querySelector("[data-mic]");
      if (micBtn) {
        micBtn.addEventListener("click", () => startVoiceCapture(i, micBtn));
      }
      tr.querySelector("[data-remove]").addEventListener("click", () => {
        data.flights.splice(i, 1);
        renderFlights();
        persist();
      });
      body.appendChild(tr);
    });
  }

  // ---------- email confirmation paste ----------

  function initEmailExtract() {
    const btn = document.getElementById("extract-email-btn");
    const textEl = document.getElementById("email-paste");
    const statusEl = document.getElementById("extract-status");
    const previewEl = document.getElementById("email-extract-preview");
    if (!btn || !textEl) return;

    btn.addEventListener("click", () => {
      const text = textEl.value.trim();
      if (!text) {
        statusEl.textContent = "Paste some email text first.";
        return;
      }

      const parsed = parseFlightText(text);

      if (!parsed.date && !parsed.route && !parsed.conf) {
        statusEl.textContent = "Couldn't find a date, route, or flight number in that. Add the row manually instead.";
        previewEl.hidden = true;
        return;
      }

      data.flights.push({
        who: "",
        date: parsed.date || "",
        route: parsed.route || "",
        conf: parsed.conf || "",
        leg: "outbound",
      });
      renderFlights();
      persist();

      previewEl.hidden = false;
      previewEl.innerHTML = `
        <dl>
          <dt>Date</dt><dd class="${parsed.date ? "" : "unfilled"}">${escapeHtml(parsed.date || "not found, fill in manually")}</dd>
          <dt>Route</dt><dd class="${parsed.route ? "" : "unfilled"}">${escapeHtml(parsed.route || "not found, fill in manually")}</dd>
          <dt>Flight #</dt><dd class="${parsed.conf ? "" : "unfilled"}">${escapeHtml(parsed.conf || "not found, fill in manually")}</dd>
        </dl>
      `;
      statusEl.textContent = "Added as a new row above. Check it over and fill in who it's for.";
      textEl.value = "";
    });
  }

  // ---------- stays ----------

  const STATUS_CLASS = { booked: "status-booked", "not-booked": "status-not-booked", searching: "status-searching" };
  const STATUS_LABEL = { booked: "booked", "not-booked": "not booked", searching: "searching closer to date" };

  function renderStays() {
    const body = document.getElementById("stays-body");
    body.innerHTML = "";
    data.stays.forEach((s, i) => {
      const tr = document.createElement("tr");
      const status = s.status in STATUS_CLASS ? s.status : "not-booked";
      tr.innerHTML = `
        ${legDotCell(s.leg)}
        <td contenteditable="true" data-field="night">${escapeHtml(s.night)}</td>
        <td contenteditable="true" data-field="city">${escapeHtml(s.city)}</td>
        <td>
          <select class="status-select ${STATUS_CLASS[status]}">
            <option value="not-booked" ${status === "not-booked" ? "selected" : ""}>${STATUS_LABEL["not-booked"]}</option>
            <option value="booked" ${status === "booked" ? "selected" : ""}>${STATUS_LABEL.booked}</option>
            <option value="searching" ${status === "searching" ? "selected" : ""}>${STATUS_LABEL.searching}</option>
          </select>
        </td>
        <td><button class="btn" data-remove="${i}" title="Remove row">✕</button></td>
      `;
      tr.querySelectorAll("td[contenteditable]").forEach((td) => {
        td.addEventListener("input", () => {
          data.stays[i][td.dataset.field] = td.textContent;
          scheduleSave();
        });
      });
      const select = tr.querySelector("select");
      select.addEventListener("change", () => {
        data.stays[i].status = select.value;
        select.className = "status-select " + STATUS_CLASS[select.value];
        scheduleSave();
      });
      tr.querySelector("[data-remove]").addEventListener("click", () => {
        data.stays.splice(i, 1);
        renderStays();
        persist();
      });
      body.appendChild(tr);
    });
  }

  // ---------- hotel claims ----------

  function renderHotelClaims() {
    document.querySelectorAll(".claim-check").forEach((box) => {
      const key = box.dataset.cityKey;
      const claim = data.hotelClaims[key] ?? { claimed: false, name: "" };
      box.checked = claim.claimed;

      const nameRow = document.querySelector(`[data-claim-name-for="${key}"]`);
      const nameInput = document.querySelector(`.claim-name-input[data-city-key="${key}"]`);
      if (nameRow) nameRow.hidden = !claim.claimed;
      if (nameInput) nameInput.value = claim.name;

      box.addEventListener("change", () => {
        if (!data.hotelClaims[key]) data.hotelClaims[key] = { claimed: false, name: "" };
        data.hotelClaims[key].claimed = box.checked;
        if (nameRow) nameRow.hidden = !box.checked;
        if (box.checked && nameInput) nameInput.focus();
        persist();
      });

      if (nameInput) {
        nameInput.addEventListener("input", () => {
          if (!data.hotelClaims[key]) data.hotelClaims[key] = { claimed: false, name: "" };
          data.hotelClaims[key].name = nameInput.value;
          scheduleSave();
        });
      }
    });
  }

  // ---------- checklist ----------

  function renderChecklist() {
    const list = document.getElementById("checklist");
    list.innerHTML = "";
    data.checklist.forEach((item, i) => {
      const li = document.createElement("li");
      const checkboxId = `check-${item.id}`;
      const num = String(i + 1).padStart(2, "0");
      li.innerHTML = `
        <span class="check-num mono">${num}</span>
        <input type="checkbox" id="${checkboxId}" ${item.done ? "checked" : ""} />
        <label for="${checkboxId}" class="${item.done ? "done" : ""}">${escapeHtml(item.text)}</label>
      `;
      li.querySelector("input").addEventListener("change", (e) => {
        item.done = e.target.checked;
        li.querySelector("label").classList.toggle("done", item.done);
        persist();
      });
      list.appendChild(li);
    });
  }

  // ---------- notes ----------

  function renderNotes() {
    const ta = document.getElementById("notes");
    ta.value = data.notes;
    ta.addEventListener("input", () => {
      data.notes = ta.value;
      scheduleSave();
    });
  }

  // ---------- controls ----------

  function renderAll() {
    renderFlights();
    renderStays();
    renderHotelClaims();
    renderChecklist();
    renderNotes();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderAll();
    initEmailExtract();

    document.getElementById("save-btn").addEventListener("click", persist);

    document.getElementById("reset-btn").addEventListener("click", () => {
      if (!confirm("Reset all trip info to the original defaults? This clears your edits on this device.")) return;
      data = structuredCloneish(DEFAULTS);
      persist();
      renderAll();
    });

    document.getElementById("add-flight").addEventListener("click", () => {
      data.flights.push({ who: "", date: "", route: "", conf: "", leg: "outbound" });
      renderFlights();
      persist();
    });

    document.getElementById("add-stay").addEventListener("click", () => {
      data.stays.push({ night: "", city: "", status: "not-booked", leg: "outbound" });
      renderStays();
      persist();
    });
  });
})();
