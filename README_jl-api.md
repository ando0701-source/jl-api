# jl-api (Workers + D1) TypeScript entry

This patch assumes your `wrangler.json` already points to:

- "main": "src/index.ts"
- D1 binding: "DB"

## Endpoints

All endpoints require `X-API-Key` and will fail-closed if `API_KEY` is not set.

- GET /ping
- POST /enqueue  (body: 2PLT_BUS/v1 JSON object)
- GET /dequeue?owner_id=...(&claimed_by=...)
- POST /finalize (body: {bus_id, q_state: 1|9})

## Notes

- The DB record-of-truth is `bus_json` (full 2PLT_BUS/v1 JSON string).
- Enqueue normalizes: q_state=0, claimed_by/claimed_at/done_at = null.
- Request validation is **strict only for DB-required keys**; any unknown/extra keys are preserved in `bus_json`.
  - For REQUEST: `message.state/out_state` are ignored (deleted) to satisfy DB CHECK constraints.
  - For RESPONSE: `message.state` is required; if `out_state` is missing it is auto-filled with `state`.
