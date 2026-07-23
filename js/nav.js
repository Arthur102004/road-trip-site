document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (!toggle || !links) return;

  // matches the CSS breakpoint that collapses .nav-links into the hamburger menu —
  // must stay in sync with the @media (max-width: 760px) rule in style.css
  const mobileQuery = window.matchMedia("(max-width: 760px)");

  // when the mobile menu is visually collapsed (max-height: 0; overflow: hidden),
  // its links are still in the DOM and still focusable by default — a keyboard
  // or screen-reader user tabbing through the page would land on invisible links.
  // tabindex="-1" removes them from the tab order until the menu is actually open.
  function syncFocusability() {
    const isMobile = mobileQuery.matches;
    const isOpen = links.classList.contains("open");
    const shouldHide = isMobile && !isOpen;
    links.setAttribute("aria-hidden", shouldHide ? "true" : "false");
    links.querySelectorAll("a").forEach((a) => {
      if (shouldHide) {
        a.setAttribute("tabindex", "-1");
      } else {
        a.removeAttribute("tabindex");
      }
    });
  }

  function closeMenu() {
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    syncFocusability();
  }

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    syncFocusability();
  });

  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && links.classList.contains("open")) {
      closeMenu();
      toggle.focus();
    }
  });

  mobileQuery.addEventListener("change", syncFocusability);
  syncFocusability();
});
