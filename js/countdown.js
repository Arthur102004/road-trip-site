(() => {
  function daysUntil(targetDate) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = targetDate - startOfToday;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  function renderCountdown(numId, labelId, targetDate, futureLabel) {
    const numEl = document.getElementById(numId);
    const labelEl = document.getElementById(labelId);
    if (!numEl || !labelEl) return;

    const days = daysUntil(targetDate);

    if (days > 1) {
      numEl.textContent = days;
      labelEl.textContent = `days until ${futureLabel}`;
    } else if (days === 1) {
      numEl.textContent = "1";
      labelEl.textContent = `day until ${futureLabel}`;
    } else if (days === 0) {
      numEl.textContent = "Today";
      labelEl.textContent = `it's ${futureLabel} day!`;
    } else {
      numEl.textContent = "✓";
      labelEl.textContent = `${futureLabel} has passed`;
    }
  }

  const departureDate = new Date(2026, 6, 31); // Jul 31, 2026
  const vegasDate = new Date(2026, 7, 3); // Aug 3, 2026

  document.addEventListener("DOMContentLoaded", () => {
    renderCountdown("countdown-departure-num", "countdown-departure-label", departureDate, "departure");
    renderCountdown("countdown-vegas-num", "countdown-vegas-label", vegasDate, "vegas");
  });
})();
