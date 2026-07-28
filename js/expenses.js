(() => {
  const STORAGE_KEY = "roadtrip-expenses-v1";
  const CATEGORIES = ["Charging", "Lodging", "Food", "Tolls", "Activities"];
  const CATEGORY_CLASS = {
    Charging: "pill-charging",
    Lodging: "pill-lodging",
    Food: "pill-food",
    Tolls: "pill-tolls",
    Activities: "pill-activities",
  };

  const DEFAULTS = {
    people: [
      { name: "Arthur", venmo: "" },
      { name: "Driver 1", venmo: "" },
      { name: "Driver 2", venmo: "" },
      { name: "Flyer 1", venmo: "" },
      { name: "Flyer 2", venmo: "" },
    ],
    expenses: [],
    estimate: { miles: 3000, kwhPerMile: 0.3, rate: 0.4 },
  };

  function structuredCloneish(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredCloneish(DEFAULTS);
      const parsed = JSON.parse(raw);
      return {
        people: parsed.people ?? structuredCloneish(DEFAULTS.people),
        expenses: parsed.expenses ?? [],
        estimate: { ...structuredCloneish(DEFAULTS.estimate), ...(parsed.estimate ?? {}) },
      };
    } catch (e) {
      return structuredCloneish(DEFAULTS);
    }
  }

  let data = loadData();
  let saveTimer = null;
  let nextId = data.expenses.reduce((max, e) => Math.max(max, e.id || 0), 0) + 1;

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

  function money(n) {
    return "$" + (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ---------- people & venmo ----------

  function renderPeople() {
    const body = document.getElementById("people-body");
    body.innerHTML = "";
    data.people.forEach((p, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td contenteditable="true" data-field="name">${escapeHtml(p.name)}</td>
        <td><input type="text" class="venmo-input" data-index="${i}" value="${escapeHtml(p.venmo)}" placeholder="username" /></td>
      `;
      tr.querySelector('[data-field="name"]').addEventListener("input", (e) => {
        data.people[i].name = e.target.textContent;
        scheduleSave();
        renderExpenseForm();
        renderExpensesTable();
        renderTotals();
        renderSettleUp();
      });
      tr.querySelector(".venmo-input").addEventListener("input", (e) => {
        data.people[i].venmo = e.target.value.trim();
        scheduleSave();
        renderSettleUp();
      });
      body.appendChild(tr);
    });
  }

  // ---------- charging cost estimate ----------

  function renderEstimate() {
    document.getElementById("est-miles").value = data.estimate.miles;
    document.getElementById("est-kwh-per-mile").value = data.estimate.kwhPerMile;
    document.getElementById("est-rate").value = data.estimate.rate;
    updateEstimateResult();
  }

  function updateEstimateResult() {
    const kwh = data.estimate.miles * data.estimate.kwhPerMile;
    const cost = kwh * data.estimate.rate;
    document.getElementById("est-kwh-total").textContent = `${Math.round(kwh)} kWh`;
    document.getElementById("est-cost-total").textContent = money(cost);
  }

  function initEstimate() {
    document.getElementById("est-miles").addEventListener("input", (e) => {
      data.estimate.miles = parseFloat(e.target.value) || 0;
      updateEstimateResult();
      scheduleSave();
    });
    document.getElementById("est-kwh-per-mile").addEventListener("input", (e) => {
      data.estimate.kwhPerMile = parseFloat(e.target.value) || 0;
      updateEstimateResult();
      scheduleSave();
    });
    document.getElementById("est-rate").addEventListener("input", (e) => {
      data.estimate.rate = parseFloat(e.target.value) || 0;
      updateEstimateResult();
      scheduleSave();
    });
    document.getElementById("est-add-btn").addEventListener("click", () => {
      const kwh = data.estimate.miles * data.estimate.kwhPerMile;
      const cost = kwh * data.estimate.rate;
      if (cost <= 0) return;
      data.expenses.push({
        id: nextId++,
        description: `Projected charging (~${data.estimate.miles} mi @ ${data.estimate.kwhPerMile} kWh/mi @ $${data.estimate.rate}/kWh)`,
        amount: Math.round(cost * 100) / 100,
        paidBy: "",
        category: "Charging",
        split: data.people.map((p) => p.name),
      });
      renderExpensesTable();
      renderTotals();
      renderSettleUp();
      persist();
    });
  }

  // ---------- add-expense form ----------

  function renderExpenseForm() {
    const paidBySelect = document.getElementById("exp-paid-by");
    const currentPaidBy = paidBySelect.value;
    paidBySelect.innerHTML = data.people.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join("");
    if (data.people.some((p) => p.name === currentPaidBy)) paidBySelect.value = currentPaidBy;

    const splitContainer = document.getElementById("exp-split-checks");
    const previouslyChecked = new Set(
      Array.from(splitContainer.querySelectorAll("input:checked")).map((i) => i.dataset.name)
    );
    splitContainer.innerHTML = data.people
      .map(
        (p, i) => `
        <label class="split-check">
          <input type="checkbox" data-name="${escapeHtml(p.name)}" ${previouslyChecked.size === 0 || previouslyChecked.has(p.name) ? "checked" : ""} />
          ${escapeHtml(p.name)}
        </label>
      `
      )
      .join("");
  }

  function initExpenseForm() {
    document.getElementById("exp-add-btn").addEventListener("click", () => {
      const status = document.getElementById("exp-form-status");
      const description = document.getElementById("exp-description").value.trim();
      const amount = parseFloat(document.getElementById("exp-amount").value);
      const paidBy = document.getElementById("exp-paid-by").value;
      const category = document.getElementById("exp-category").value;
      const split = Array.from(document.querySelectorAll("#exp-split-checks input:checked")).map((i) => i.dataset.name);

      if (!description) { status.textContent = "Add a description first."; return; }
      if (!(amount > 0)) { status.textContent = "Enter an amount greater than 0."; return; }
      if (!paidBy) { status.textContent = "Pick who paid."; return; }
      if (split.length === 0) { status.textContent = "Pick at least one person to split between."; return; }

      data.expenses.push({ id: nextId++, description, amount: Math.round(amount * 100) / 100, paidBy, category, split });
      renderExpensesTable();
      renderTotals();
      renderSettleUp();
      persist();

      document.getElementById("exp-description").value = "";
      document.getElementById("exp-amount").value = "";
      status.textContent = "Added.";
    });
  }

  // ---------- expenses table ----------

  function renderExpensesTable() {
    const body = document.getElementById("expenses-body");
    const empty = document.getElementById("expenses-empty");
    const countEl = document.getElementById("expense-count");
    body.innerHTML = "";

    countEl.textContent = `${data.expenses.length} logged`;
    empty.hidden = data.expenses.length > 0;

    data.expenses.forEach((exp, i) => {
      const tr = document.createElement("tr");
      const categoryClass = CATEGORY_CLASS[exp.category] || "pill-charging";
      const paidBySelect = data.people
        .map((p) => `<option value="${escapeHtml(p.name)}" ${p.name === exp.paidBy ? "selected" : ""}>${escapeHtml(p.name)}</option>`)
        .join("");
      const categorySelect = CATEGORIES
        .map((c) => `<option value="${c}" ${c === exp.category ? "selected" : ""}>${c}</option>`)
        .join("");

      tr.innerHTML = `
        <td contenteditable="true" data-field="description">${escapeHtml(exp.description)}</td>
        <td>
          <select class="status-select ${categoryClass}" data-field="category">${categorySelect}</select>
        </td>
        <td>
          <select class="status-select" data-field="paidBy">
            <option value="" ${exp.paidBy ? "" : "selected"}>Unassigned</option>
            ${paidBySelect}
          </select>
        </td>
        <td class="mono small">${escapeHtml(exp.split.join(", "))}</td>
        <td contenteditable="true" data-field="amount" class="mono">${exp.amount.toFixed(2)}</td>
        <td><button class="btn" data-remove="${i}" title="Remove row">✕</button></td>
      `;

      tr.querySelector('[data-field="description"]').addEventListener("input", (e) => {
        exp.description = e.target.textContent;
        scheduleSave();
      });
      tr.querySelector('[data-field="amount"]').addEventListener("input", (e) => {
        const val = parseFloat(e.target.textContent);
        exp.amount = isNaN(val) ? 0 : val;
        renderTotals();
        renderSettleUp();
        scheduleSave();
      });
      tr.querySelector('[data-field="category"]').addEventListener("change", (e) => {
        exp.category = e.target.value;
        e.target.className = "status-select " + (CATEGORY_CLASS[exp.category] || "pill-charging");
        persist();
      });
      tr.querySelector('[data-field="paidBy"]').addEventListener("change", (e) => {
        exp.paidBy = e.target.value;
        renderTotals();
        renderSettleUp();
        persist();
      });
      tr.querySelector("[data-remove]").addEventListener("click", () => {
        data.expenses.splice(i, 1);
        renderExpensesTable();
        renderTotals();
        renderSettleUp();
        persist();
      });

      body.appendChild(tr);
    });
  }

  // ---------- totals ----------

  function computeBalances() {
    const paid = {};
    const owed = {};
    data.people.forEach((p) => {
      paid[p.name] = 0;
      owed[p.name] = 0;
    });

    let runningTotal = 0;
    data.expenses.forEach((exp) => {
      runningTotal += exp.amount;
      if (exp.paidBy && paid[exp.paidBy] !== undefined) paid[exp.paidBy] += exp.amount;
      if (exp.split.length > 0) {
        const share = exp.amount / exp.split.length;
        exp.split.forEach((name) => {
          if (owed[name] !== undefined) owed[name] += share;
        });
      }
    });

    const net = {};
    data.people.forEach((p) => {
      net[p.name] = paid[p.name] - owed[p.name];
    });

    return { paid, owed, net, runningTotal };
  }

  function renderTotals() {
    const { paid, owed, net, runningTotal } = computeBalances();
    document.getElementById("running-total").textContent = `${money(runningTotal)} total`;

    const body = document.getElementById("totals-body");
    body.innerHTML = "";
    data.people.forEach((p) => {
      const n = net[p.name] || 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td class="mono">${money(paid[p.name] || 0)}</td>
        <td class="mono">${money(owed[p.name] || 0)}</td>
        <td class="mono ${n > 0.005 ? "net-positive" : n < -0.005 ? "net-negative" : ""}">${n > 0.005 ? "+" : ""}${money(n)}</td>
      `;
      body.appendChild(tr);
    });
  }

  // ---------- settle up ----------

  function venmoUrl(person, amount, note) {
    const handle = (person.venmo || "").replace(/^@/, "").trim();
    const base = handle ? `https://venmo.com/${encodeURIComponent(handle)}` : "https://venmo.com/";
    return `${base}?txn=pay&amount=${amount.toFixed(2)}&note=${encodeURIComponent(note)}`;
  }

  function computeSettlement(net) {
    const debtors = data.people
      .map((p) => ({ name: p.name, amount: -(net[p.name] || 0) }))
      .filter((d) => d.amount > 0.005)
      .sort((a, b) => b.amount - a.amount);
    const creditors = data.people
      .map((p) => ({ name: p.name, amount: net[p.name] || 0 }))
      .filter((c) => c.amount > 0.005)
      .sort((a, b) => b.amount - a.amount);

    const transfers = [];
    let di = 0;
    let ci = 0;
    while (di < debtors.length && ci < creditors.length) {
      const debtor = debtors[di];
      const creditor = creditors[ci];
      const transfer = Math.min(debtor.amount, creditor.amount);
      if (transfer > 0.005) {
        transfers.push({ from: debtor.name, to: creditor.name, amount: transfer });
      }
      debtor.amount -= transfer;
      creditor.amount -= transfer;
      if (debtor.amount <= 0.005) di++;
      if (creditor.amount <= 0.005) ci++;
    }
    return transfers;
  }

  function renderSettleUp() {
    const { net } = computeBalances();
    const transfers = computeSettlement(net);
    const list = document.getElementById("settle-list");

    if (transfers.length === 0) {
      list.innerHTML = `<p class="small mt-0">Everyone's settled up — no transfers needed.</p>`;
      return;
    }

    list.innerHTML = transfers
      .map((t) => {
        const toPerson = data.people.find((p) => p.name === t.to);
        const note = `Road trip settle-up: ${t.from} → ${t.to}`;
        const url = venmoUrl(toPerson || { venmo: "" }, t.amount, note);
        return `
          <div class="settle-row">
            <span class="settle-text"><strong>${escapeHtml(t.from)}</strong> owes <strong>${escapeHtml(t.to)}</strong></span>
            <span class="settle-amount mono">${money(t.amount)}</span>
            <a class="btn hotel-search-link" href="${url}" target="_blank" rel="noopener noreferrer">Pay with Venmo</a>
          </div>
        `;
      })
      .join("");
  }

  // ---------- controls ----------

  function renderAll() {
    renderPeople();
    renderEstimate();
    renderExpenseForm();
    renderExpensesTable();
    renderTotals();
    renderSettleUp();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderAll();
    initEstimate();
    initExpenseForm();

    document.getElementById("save-btn").addEventListener("click", persist);

    document.getElementById("reset-btn").addEventListener("click", () => {
      if (!confirm("Reset all expenses to the original defaults? This clears your edits on this device.")) return;
      data = structuredCloneish(DEFAULTS);
      nextId = 1;
      persist();
      renderAll();
    });
  });
})();

// ---------- shared pot (synced via TripSync when enabled) ----------
// One field per person per property (`pot.<person>.paid`, `pot.<person>.amount`)
// so marking two different people paid from two offline devices never
// conflicts. Anyone can toggle any row — in practice whoever is collecting
// marks people off as money arrives.
(() => {
  const LOCAL_KEY = "roadtrip-pot-v1";
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

  function localSave(data) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function getField(key) {
    if (sync) return sync.get(key);
    return localLoad()[key];
  }

  function setField(key, value) {
    if (sync) {
      sync.set(key, value);
    } else {
      const data = localLoad();
      data[key] = value;
      localSave(data);
    }
  }

  function escapePot(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function render() {
    const rows = document.getElementById("pot-rows");
    if (!rows) return;
    // don't rebuild rows under someone mid-typing an amount — the next
    // subscribe/poll render catches up once focus leaves the input
    if (rows.contains(document.activeElement) && document.activeElement.classList.contains("pot-amount")) return;
    const who = sync ? sync.who() : null;
    rows.innerHTML = "";
    CREW.forEach((name) => {
      const s = slug(name);
      const paid = !!getField(`pot.${s}.paid`);
      const amount = getField(`pot.${s}.amount`);
      const row = document.createElement("div");
      row.className = "pot-row";
      row.innerHTML = `
        <span class="pot-name">${escapePot(name)}${who === name ? ' <span class="small mono">(you)</span>' : ""}</span>
        <input type="number" class="pot-amount" min="0" step="1" placeholder="$" value="${amount != null ? escapePot(String(amount)) : ""}" aria-label="Amount ${escapePot(name)} paid in" />
        <button type="button" class="pot-paid-btn ${paid ? "paid" : ""}" aria-pressed="${paid}" aria-label="${escapePot(name)} paid into the pot">${paid ? "✓ Paid in" : "Not paid"}</button>
      `;
      row.querySelector(".pot-paid-btn").addEventListener("click", () => {
        setField(`pot.${s}.paid`, !paid);
        render();
      });
      let amountTimer = null;
      row.querySelector(".pot-amount").addEventListener("input", (e) => {
        clearTimeout(amountTimer);
        const val = parseFloat(e.target.value);
        amountTimer = setTimeout(() => {
          setField(`pot.${s}.amount`, isNaN(val) ? null : val);
        }, 500);
      });
      rows.appendChild(row);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const rows = document.getElementById("pot-rows");
    if (!rows) return;

    const label = document.getElementById("pot-sync-label");
    if (label) label.textContent = sync ? "shared across the crew" : "this device only";

    const whoRow = document.getElementById("pot-who-row");
    if (whoRow && window.TripSync) window.TripSync.renderWhoRow(whoRow, render);

    render();
    if (sync) sync.subscribe("pot.", render);
  });
})();
