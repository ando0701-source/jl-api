# jl-api (D1) TypeScript patch (2PLT_BUS/v1)

## What this patch does
- D1 table of truth: `bus_messages.bus_json` stores the full `2PLT_BUS/v1` envelope (including mutable queue fields q_state/claimed*/done_at).
- Validation policy: **strict only on required fields** (for DB extraction); preserve unknown fields.
- Server canonicalizes `bus_ts` to epoch seconds and normalizes legacy `message.payload` → `message.contents`.
- Unified POST JSON parsing (`/enqueue`, `/finalize`).
- Top-level try/catch to avoid abrupt failures (helps reduce 'connection reset' symptoms).
- Optional stealth mode: set `STEALTH_404="1"` to return 404 for auth failures.

## Endpoints
- GET `/ping` -> `pong`
- POST `/enqueue` -> accepts `2PLT_BUS/v1` JSON, idempotent by `bus_id`
- GET `/dequeue?owner_id=...(&claimed_by=...)` -> claims a pending message
- POST `/finalize` body `{bus_id, q_state:1|9}`

- GET `/logs.tsv?limit=...` -> **public** export of `bus_messages` as TSV (header included)
  - `limit` default 1000, max 5000 (clamped); invalid -> 400
  - rows ordered by `inserted_at ASC, bus_id ASC`


## Notes for Windows cmd.exe curl
- Use `--http1.1` and always specify method via `-X`.
- Prefer `--data-binary "@file.json"` instead of inline JSON.


## /finalize input
Accepts either `{bus_id,q_state}` or a `/dequeue` snapshot `{..., row:{bus_id,q_state,...}}`.

## Build marker
This build sets response header `x-jl-api-build: jl-api-main_08` and exposes it via `/diag`.

## Public debug endpoint (test-only)
- GET `/bus.json?bus_id=...` -> summary of DB row + bus_json parse status
- GET `/bus.json?bus_id=...&sync=1` -> best-effort sync bus_json.q_state/done_at to DB columns
- Add `&full=1` to include raw/parsed bus_json

## /finalize debug
Add `?debug=1` to include `bus_json_sync` result in response JSON.
