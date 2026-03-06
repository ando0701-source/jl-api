-- DDL_D1_76_owner_inbox.sql
-- Unified inbox for all owners (worker/manager) storing notifications (pointer + optional inline snapshot).
-- Target: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS owner_inbox (
  inbox_id TEXT PRIMARY KEY,                -- UUID/ULID recommended
  inbox_ts INTEGER NOT NULL,                -- epoch seconds
  to_owner_id TEXT NOT NULL,                -- inbox owner
  from_owner_id TEXT,                       -- optional sender
  channel TEXT NOT NULL DEFAULT 'D1' CHECK (channel IN ('D1','WEBHOOK')),
  q_state TEXT NOT NULL DEFAULT 'PENDING' CHECK (q_state IN ('PENDING','DONE','DEAD')),
  bus_id TEXT NOT NULL,                     -- pointer to bus_messages.bus_id
  content_json TEXT NOT NULL,               -- INBOX_ENVELOPE_V1 JSON string
  content_hash TEXT                         -- optional sha256 hex
);

CREATE INDEX IF NOT EXISTS idx_owner_inbox_to_q_state_ts ON owner_inbox(to_owner_id, q_state, inbox_ts);
CREATE INDEX IF NOT EXISTS idx_owner_inbox_bus_id ON owner_inbox(bus_id);
