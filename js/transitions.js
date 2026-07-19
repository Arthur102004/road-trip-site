(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const loader = document.getElementById("page-loader");

  // this page's own load: run the bar across quickly, then fade it out
  if (loader && !reduceMotion) {
    requestAnimationFrame(() => {
      loader.style.width = "55%";
    });
    window.addEventListener("load", () => {
      loader.style.width = "100%";
      setTimeout(() => loader.classList.add("done"), 150);
    });
  }

  if (reduceMotion) return;

  // internal navigation: brief fade-out + restart the bar before the browser
  // actually leaves, so a click always gets an immediate visual response
  document.querySelectorAll('a[href$=".html"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (link.target === "_blank") return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      e.preventDefault();
      document.body.classList.add("page-leaving");
      if (loader) {
        loader.classList.remove("done");
        loader.style.transition = "width 0.18s ease";
        loader.style.width = "70%";
      }
      setTimeout(() => {
        window.location.href = href;
      }, 170);
    });
  });
})();
