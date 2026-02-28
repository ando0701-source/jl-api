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
