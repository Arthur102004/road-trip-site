# OKC ⇄ Vegas Road Trip Site

Static site built from `road-trip-content.md`. No build step — plain HTML/CSS/JS.

## Pages

- `index.html` — Home / Route
- `itinerary.html` — Day-by-Day Itinerary
- `charging.html` — Charging Stops + Tesla Model Y Playbook
- `vegas.html` — Vegas on a Budget
- `info.html` — Trip Info (editable flights, lodging, notes, checklist — saves to the browser's `localStorage`, per device)

## Run locally

Just open `index.html` in a browser, or serve the folder so relative links behave the same as in production:

```
# Python
python -m http.server 8000

# Node
npx serve .
```

Then visit `http://localhost:8000`.

## Deploy — GitHub Pages (free)

1. Create a new GitHub repo and push this folder's contents to it:
   ```
   git init
   git add .
   git commit -m "Road trip site"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Source → Deploy from a branch → main / (root)**.
3. Your site goes live at `https://<username>.github.io/<repo>/` within a minute or two.

## Deploy — Vercel (free)

1. Install the CLI: `npm i -g vercel`
2. From this folder, run `vercel` and accept the defaults (no build command needed — it's static).
3. Vercel gives you a shareable `https://<project>.vercel.app` URL immediately, and redeploys on every push if you connect it to a GitHub repo.

## Notes

- `info.html`'s edits are stored per-browser via `localStorage`, not synced between people. For a version everyone can edit together, it'd need a small backend (or something like a shared Google Sheet embedded instead).
- Content source of truth is `road-trip-content.md` — if the trip plan changes, update that file, then reflect the changes in the relevant page(s).
