-- DDL_D1_77_owner_inbox_events.sql
-- Append-only operational events for inbox lifecycle (notify/take/ack/poll).
-- Target: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS owner_inbox_events (
  event_id TEXT PRIMARY KEY,             -- UUID/ULID recommended
  event_ts INTEGER NOT NULL,             -- epoch seconds
  event_code TEXT NOT NULL,              -- INBOX_EVENT_CODE (closed world)
  actor_owner_id TEXT NOT NULL,          -- actor that emitted the event
  to_owner_id TEXT NOT NULL,             -- inbox owner (recipient)
  from_owner_id TEXT,                    -- sender owner_id if known
  inbox_id TEXT,                         -- pointer to owner_inbox.inbox_id if applicable
  bus_id TEXT,                           -- pointer to bus_messages.bus_id if applicable
  channel TEXT NOT NULL DEFAULT 'D1',    -- D1 / WEBHOOK
  data TEXT NOT NULL                     -- JSON payload (schema depends on event_code)
);
