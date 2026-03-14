-- 0010_bus_messages.sql
-- Canonical BUS ledger table for 2PLT_BUS/v1 envelopes.
-- One object per migration file: bus_messages + dedicated indexes.
-- Target: Cloudflare D1 (SQLite)
-- NOTE: bus_ts / claimed_at / done_at are epoch seconds.

CREATE TABLE IF NOT EXISTS bus_messages (
  -- ===== 2PLT_BUS/v1 required keys =====
  schema_id TEXT NOT NULL CHECK (schema_id = '2PLT_BUS/v1'),
  bus_id    TEXT PRIMARY KEY,
  bus_ts    INTEGER NOT NULL,
  q_state   TEXT NOT NULL DEFAULT 'PENDING' CHECK (q_state IN ('PENDING','DONE','DEAD')),

  from_owner_id TEXT NOT NULL,
  to_owner_id   TEXT NOT NULL,

  -- ===== 2PLT_BUS/v1 optional keys =====
  claimed_by TEXT,
  claimed_at INTEGER,
  done_at    INTEGER,

  -- ===== Inner message (fixed to 2PLT_MESSAGE/v1 for now) =====
  message_schema_id TEXT NOT NULL CHECK (message_schema_id = '2PLT_MESSAGE/v1'),

  msg_type TEXT NOT NULL CHECK (msg_type IN ('REQUEST','RESPONSE')),
  op_id    TEXT NOT NULL,

  flow_owner_id TEXT NOT NULL,
  lane_id       TEXT NOT NULL,
  request_id    TEXT NOT NULL,

  in_state  TEXT NOT NULL CHECK (in_state IN ('NUL','PROPOSAL','COMMIT','UNRESOLVED','ABEND')),
  state     TEXT CHECK (state IN ('PROPOSAL','COMMIT','UNRESOLVED','ABEND')),
  out_state TEXT CHECK (out_state IN ('PROPOSAL','COMMIT','UNRESOLVED','ABEND')),

  -- ===== Raw payload =====
  bus_json TEXT NOT NULL,

  -- server-side insertion time (audit convenience)
  inserted_at INTEGER NOT NULL DEFAULT (unixepoch()),

  -- ===== Minimal 2PLT consistency =====
  CHECK (
    (msg_type='REQUEST'  AND state IS NULL AND out_state IS NULL)
    OR
    (msg_type='RESPONSE' AND state IS NOT NULL AND out_state = state)
  )
);

CREATE INDEX IF NOT EXISTS idx_inbox
  ON bus_messages(to_owner_id, q_state, bus_ts, bus_id);

CREATE INDEX IF NOT EXISTS idx_inbox_claim
  ON bus_messages(to_owner_id, q_state, claimed_by, bus_ts, bus_id);

CREATE INDEX IF NOT EXISTS idx_inbox_pending
  ON bus_messages(to_owner_id, bus_ts, bus_id)
  WHERE q_state='PENDING' AND claimed_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_lane
  ON bus_messages(flow_owner_id, lane_id, bus_ts, bus_id);

CREATE INDEX IF NOT EXISTS idx_request
  ON bus_messages(flow_owner_id, lane_id, request_id, bus_ts, bus_id);

CREATE INDEX IF NOT EXISTS idx_op_id
  ON bus_messages(op_id, bus_ts, bus_id);

CREATE INDEX IF NOT EXISTS idx_bus_messages_echo_request_bus_id
  ON bus_messages (CAST(json_extract(bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT));
