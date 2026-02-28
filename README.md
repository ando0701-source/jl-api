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


## Env vars
- `API_KEY`: required for /enqueue /dequeue /finalize
- `STEALTH_404`: "1" => unauthorized -> 404
- `CLAIM_TTL_SEC`: optional (seconds). If set to a positive integer, `/dequeue` will auto-reclaim expired claims
  (self-heal without human SQL). A claim is considered expired when `claimed_at <= now - CLAIM_TTL_SEC`.
- `DEBUG_LITE`: optional. "1" enables debug-lite:
  - API writes minimal diagnostic events into D1 table `debug_events` (created on-demand)
  - public export endpoint: `GET/HEAD /debug.txt` (TSV body, Content-Type: text/plain)
  - when `DEBUG_LITE` is not "1", `/debug.txt` returns 404 and no debug events are written.

## Debug-lite (removal)
Debug-lite is intentionally isolated:
- `src/lib/debug_lite.ts`
- `src/handlers/debug_txt.ts`
- a small `/debug.txt` block in `src/router.ts`
If you don't need it anymore, delete these, or simply unset `DEBUG_LITE`.
