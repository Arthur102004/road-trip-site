# road-trip-site

## Git workflow

After making a change that the user has approved and confirmed is working, commit and push it to `origin/main` automatically — do not wait to be asked. This applies each time, unless the user says otherwise for that change.

## Service worker versioning — required on every deploy

Any commit that changes a file listed in `PRECACHE_URLS` in `sw.js` (HTML, CSS, JS, fonts, icons, manifest) MUST also bump the `VERSION` constant at the top of `sw.js` in that same commit. The byte-diff in `sw.js` is what triggers browsers to install the new worker and show the "new version available" banner — without the bump, users keep the old cache forever. Stale charging data on this site is worse than no data; a wrong charging stop could strand the car.
