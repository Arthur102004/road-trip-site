# road-trip-site

## Git workflow

After making a change that the user has approved and confirmed is working, commit and push it to `origin/main` automatically — do not wait to be asked. This applies each time, unless the user says otherwise for that change.

## Shared state (Supabase)

Shared crew data (packing list, pot, charging completion, splurge vote) syncs
through `js/sync.js` → the `sync_trip` RPC defined in `supabase/schema.sql`.
Changes to `supabase/schema.sql` do NOT deploy automatically — they must be
re-run manually in the Supabase dashboard SQL editor. Credentials (project
URL, anon key, trip secret) live only in the shared link's URL fragment and
each device's localStorage — never commit them; the repo is public.

## Service worker versioning — required on every deploy

Any commit that changes a file listed in `PRECACHE_URLS` in `sw.js` (HTML, CSS, JS, fonts, icons, manifest) MUST also bump the `VERSION` constant at the top of `sw.js` in that same commit. The byte-diff in `sw.js` is what triggers browsers to install the new worker and show the "new version available" banner — without the bump, users keep the old cache forever. Stale charging data on this site is worse than no data; a wrong charging stop could strand the car.
