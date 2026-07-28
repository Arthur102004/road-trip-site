(() => {
  const MAPS_BASE = "https://www.google.com/maps/search/?api=1&query=";
  const mapsUrl = (query) => MAPS_BASE + encodeURIComponent(query);

  function makeLink(text, query) {
    const a = document.createElement("a");
    a.href = mapsUrl(query);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "map-link";
    a.textContent = text;
    return a;
  }

  // replaces the leading run of text in `el` with a real <a> Maps link,
  // leaving any trailing text (e.g. a following <span>) untouched
  function linkFirstTextNode(el, queryFor) {
    if (!el) return null;
    const node = el.childNodes[0];
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const raw = node.nodeValue;
    const name = raw.trim();
    if (!name) return null;
    const startIdx = raw.indexOf(name);
    const range = document.createRange();
    range.setStart(node, startIdx);
    range.setEnd(node, startIdx + name.length);
    range.deleteContents();
    range.insertNode(makeLink(name, queryFor(name)));
    return name;
  }

  // links each "·"-delimited venue name in a clean, list-only text node
  // (used only where the source text is a pure delimited list, not prose)
  function linkDelimitedVenues(container, city) {
    if (!container) return;
    const node = Array.from(container.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim().length > 0
    );
    if (!node) return;
    const raw = node.nodeValue.trim();
    const hasTrailingPeriod = raw.endsWith(".");
    const core = hasTrailingPeriod ? raw.slice(0, -1) : raw;
    const parts = core.split("·").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const frag = document.createDocumentFragment();
    parts.forEach((venue, i) => {
      if (i > 0) frag.appendChild(document.createTextNode(" · "));
      frag.appendChild(makeLink(venue, `${venue}, ${city}`));
    });
    if (hasTrailingPeriod) frag.appendChild(document.createTextNode("."));
    node.parentNode.replaceChild(frag, node);
  }

  // ---- charging.html: real charging stops — city heading + clean Eat list ----
  document.querySelectorAll(".stop-card[data-lat]").forEach((card) => {
    const city = linkFirstTextNode(card.querySelector("h3"), (name) => name);
    if (city) linkDelimitedVenues(card.querySelector(".stop-food"), city);
  });

  // ---- charging.html: fun stops — venue heading, city pulled from the .miles span ----
  document.querySelectorAll(".stop-card:not([data-lat])").forEach((card) => {
    const milesEl = card.querySelector(".miles");
    const city = milesEl ? milesEl.textContent.trim() : "";
    linkFirstTextNode(card.querySelector("h3"), (name) => (city ? `${name}, ${city}` : name));
  });

  // ---- itinerary.html: one link per day, to that day's destination place ----
  // Titles are either "A → B" (link the final stop) or a plain rest-day/
  // fly-home title with no arrow ("Las Vegas: Lee Canyon", "Fly Home from
  // OKC") — those need the descriptive suffix stripped too, or the whole
  // phrase becomes the Maps query and the link goes nowhere useful.
  document.querySelectorAll(".day-card .day-head h3").forEach((h3) => {
    const raw = h3.textContent.trim();
    const dest = raw.includes("→")
      ? raw.split("→").pop().trim()
      : raw.includes(":")
      ? raw.split(":")[0].trim()
      : raw.includes(" from ")
      ? raw.split(" from ").pop().trim()
      : raw;
    if (!dest) return;
    h3.innerHTML = "";
    h3.appendChild(makeLink(raw, dest));
  });
})();
