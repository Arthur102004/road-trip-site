-- Shared-state schema for road-trip-site. Safe to commit: contains no secrets.
--
-- Setup (one time, Supabase dashboard > SQL editor):
--   1. Run this whole file.
--   2. Pick a long random shared secret (e.g. `openssl rand -hex 16`), then:
--        insert into trips (id) values (encode(digest('YOUR-SECRET-HERE', 'sha256'), 'hex'));
--   3. Build the share link with link-builder.html (project URL + anon key + secret).
--
-- Security model: RLS is enabled with deliberately NO policies, so the anon
-- key cannot read or write either table directly. The only surface is the
-- sync_trip() RPC, which requires the shared secret; without it every call
-- fails on the trips-row gate. To rotate a leaked secret: insert a new trips
-- row for the new secret, delete the old row (cascades nothing — trip_fields
-- rows must be re-keyed or deleted), and re-share the link.

create extension if not exists pgcrypto;

-- One row per trip, inserted manually; id = sha256(shared secret).
-- Gates the RPC so the anon key alone cannot create or claim trips.
create table trips (
  id text primary key,
  created_at timestamptz not null default now()
);

-- One row per shared field. Per-field last-write-wins happens HERE, at the
-- database level, so two clients flushing concurrently can never interleave
-- a read-modify-write clobber.
create table trip_fields (
  trip_id text not null references trips(id),
  key     text not null,          -- e.g. "packing.item.sunscreen"
  value   jsonb not null,
  ts      bigint not null,        -- client-claimed epoch ms, server-clamped
  device  text not null,          -- LWW tie-break + debugging
  updated_at timestamptz not null default now(),
  primary key (trip_id, key)
);

alter table trips enable row level security;
alter table trip_fields enable row level security;
-- No policies on purpose: deny-all for direct table access.

-- Atomic push+pull. Applies the client's pending changes under LWW, then
-- returns the full post-merge field map plus server time (for client clock
-- offset). Called with changes = '[]' it is a plain poll.
create or replace function sync_trip(secret text, changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tid text := encode(digest(secret, 'sha256'), 'hex');
  server_now bigint := (extract(epoch from now()) * 1000)::bigint;
  c jsonb;
begin
  if not exists (select 1 from trips where id = tid) then
    raise exception 'unknown trip';
  end if;

  for c in select * from jsonb_array_elements(coalesce(changes, '[]'::jsonb)) loop
    insert into trip_fields (trip_id, key, value, ts, device)
    values (
      tid,
      c->>'key',
      c->'value',
      -- clamp: a device with a far-future clock cannot mint timestamps that
      -- permanently win every later conflict
      least((c->>'ts')::bigint, server_now + 60000),
      c->>'device'
    )
    on conflict (trip_id, key) do update
      set value = excluded.value,
          ts = excluded.ts,
          device = excluded.device,
          updated_at = now()
      where excluded.ts > trip_fields.ts
         or (excluded.ts = trip_fields.ts and excluded.device > trip_fields.device);
  end loop;

  return jsonb_build_object(
    'server_time', server_now,
    'fields', coalesce(
      (select jsonb_object_agg(key, jsonb_build_object('v', value, 't', ts, 'by', device))
       from trip_fields where trip_id = tid),
      '{}'::jsonb
    )
  );
end $$;

revoke all on function sync_trip(text, jsonb) from public;
grant execute on function sync_trip(text, jsonb) to anon;
