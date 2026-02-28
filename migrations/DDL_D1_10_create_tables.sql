-- DDL_D1_10_create_tables.sql
-- Target: Cloudflare D1 (SQLite)
-- Storage unit: 2PLT_BUS/v1 envelope is the DB "record of truth".
-- NOTE: bus_ts / claimed_at / done_at are epoch *seconds* (not milliseconds).

-- Main table: bus_messages
-- - Append-oriented history (do not delete during normal operation).
-- - Queue behavior uses (q_state, claimed_by, claimed_at, done_at).

CREATE TABLE IF NOT EXISTS bus_messages (
  -- ===== 2PLT_BUS/v1 required keys =====
  schema_id TEXT NOT NULL CHECK (schema_id = '2PLT_BUS/v1'),
  bus_id    TEXT PRIMARY KEY,                 -- UUID recommended; used as idempotency key
  bus_ts    INTEGER NOT NULL,                 -- epoch seconds
  q_state   INTEGER NOT NULL DEFAULT 0 CHECK (q_state IN (0,1,9)),

  from_owner_id TEXT NOT NULL,
  to_owner_id   TEXT NOT NULL,

  -- ===== 2PLT_BUS/v1 optional keys =====
  claimed_by TEXT,
  claimed_at INTEGER,
  done_at    INTEGER,

  -- ===== Inner message (fixed to 2PLT_MESSAGE/v1 for now) =====
  message_schema_id TEXT NOT NULL CHECK (message_schema_id = '2PLT_MESSAGE/v1'),

  msg_type TEXT NOT NULL CHECK (msg_type IN ('REQUEST','RESPONSE')),
  op_id    TEXT NOT NULL,                     -- trigger / operation id

  flow_owner_id TEXT NOT NULL,
  lane_id       TEXT NOT NULL,
  request_id    TEXT NOT NULL,

  in_state  TEXT NOT NULL CHECK (in_state IN ('NUL','PROPOSAL','COMMIT','UNRESOLVED','ABEND')),
  state     TEXT CHECK (state IN ('PROPOSAL','COMMIT','UNRESOLVED','ABEND')),  -- response only
  out_state TEXT CHECK (out_state IN ('PROPOSAL','COMMIT','UNRESOLVED','ABEND')),  -- response only

  -- ===== Raw payload =====
  bus_json TEXT NOT NULL,                     -- full 2PLT_BUS/v1 JSON string

  -- server-side insertion time (audit convenience)
  inserted_at INTEGER NOT NULL DEFAULT (unixepoch()),

  -- ===== Minimal 2PLT consistency =====
  CHECK (
    (msg_type='REQUEST'  AND state IS NULL AND out_state IS NULL)
    OR
    (msg_type='RESPONSE' AND state IS NOT NULL AND out_state = state)
  )
);

-- Optional: vocab tables (helpful for audits / UI / consistency checks)
CREATE TABLE IF NOT EXISTS vocab_q_state (
  q_state INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  meaning TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vocab_2plt_state (
  state TEXT PRIMARY KEY,
  meaning TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vocab_msg_type (
  msg_type TEXT PRIMARY KEY,
  meaning TEXT NOT NULL
);
