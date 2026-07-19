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
