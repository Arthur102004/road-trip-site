(() => {
  const STORAGE_KEY = "roadtrip-sunlight-mode";
  const root = document.documentElement;
  const btn = document.getElementById("sunlight-toggle");

  function apply(on) {
    root.classList.toggle("sunlight-mode", on);
    if (btn) {
      btn.setAttribute("aria-pressed", String(on));
    }
  }

  apply(root.classList.contains("sunlight-mode"));

  if (btn) {
    btn.addEventListener("click", () => {
      const next = !root.classList.contains("sunlight-mode");
      apply(next);
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch (e) {}
    });
  }
})();
