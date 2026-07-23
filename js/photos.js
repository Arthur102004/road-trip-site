(() => {
  const STORAGE_KEY = "roadtrip-photos-v1";

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { albumUrl: "", photos: {} };
      const parsed = JSON.parse(raw);
      return {
        albumUrl: parsed.albumUrl || "",
        photos: parsed.photos && typeof parsed.photos === "object" ? parsed.photos : {},
      };
    } catch (e) {
      return { albumUrl: "", photos: {} };
    }
  }

  let data = loadData();
  let saveTimer = null;

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;");
  }

  // ---------- shared album ----------

  function renderAlbum() {
    const input = document.getElementById("album-url");
    const openBtn = document.getElementById("album-open-btn");
    const status = document.getElementById("album-status");
    input.value = data.albumUrl;
    updateAlbumButton();

    input.addEventListener("input", () => {
      data.albumUrl = input.value.trim();
      scheduleSave();
      updateAlbumButton();
    });

    function updateAlbumButton() {
      if (data.albumUrl) {
        openBtn.href = data.albumUrl;
        openBtn.removeAttribute("aria-disabled");
        status.textContent = "";
      } else {
        openBtn.href = "#";
        openBtn.setAttribute("aria-disabled", "true");
        status.textContent = "Paste the album link above to enable this.";
      }
    }

    openBtn.addEventListener("click", (e) => {
      if (!data.albumUrl) e.preventDefault();
    });
  }

  // ---------- per-day photo tiles ----------

  function looksLikeUrl(str) {
    return /^https?:\/\//i.test(str.trim());
  }

  function renderPhotoGrid() {
    const grid = document.getElementById("photo-grid");
    if (!grid || !window.TRIP_DAYS) return;

    grid.innerHTML = window.TRIP_DAYS.map((day) => {
      const photoUrl = data.photos[day.date] || "";
      const slotContent = photoUrl
        ? `<img src="${escapeAttr(photoUrl)}" alt="Photo from ${escapeAttr(day.city)}, ${escapeAttr(day.label)}" loading="lazy" />`
        : `<a class="photo-placeholder" href="${data.albumUrl ? escapeAttr(data.albumUrl) : "#"}" target="_blank" rel="noopener noreferrer">+ Add photo</a>`;

      return `
        <div class="card photo-tile">
          <div class="photo-tile-head">
            <span class="day-date mono">${escapeHtml(day.label)}</span>
            <span class="small mono">${escapeHtml(day.city)}</span>
          </div>
          <div class="photo-slot">${slotContent}</div>
          <input type="text" class="photo-url-input mono" data-date="${day.date}" value="${escapeAttr(photoUrl)}" placeholder="Paste a direct photo URL" />
        </div>
      `;
    }).join("");

    grid.querySelectorAll(".photo-url-input").forEach((input) => {
      input.addEventListener("input", () => {
        const date = input.dataset.date;
        const val = input.value.trim();
        if (val && !looksLikeUrl(val)) return; // don't render garbage as an <img> mid-typing
        data.photos[date] = val;
        scheduleSave();
      });
      input.addEventListener("blur", () => {
        renderPhotoGrid(); // re-render just to swap the slot to an <img> once typing settles
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderAlbum();
    renderPhotoGrid();
  });
})();
