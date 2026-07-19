(() => {
  const btn = document.getElementById("print-btn");
  if (!btn) return;
  btn.addEventListener("click", () => window.print());
})();
