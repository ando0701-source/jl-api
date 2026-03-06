-- DDL_D1_70_bus_events.sql
-- Append-only audit events that cannot be reconstructed once overwritten (e.g., TTL reclaim).
-- Target: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS bus_events (
  event_id TEXT PRIMARY KEY,
  event_ts INTEGER NOT NULL,                 -- epoch seconds
  event_code TEXT NOT NULL,

  -- Optional linkage / context
  bus_id TEXT,
  flow_owner_id TEXT,
  lane_id TEXT,
  request_id TEXT,
  op_id TEXT,
  actor_owner_id TEXT,
  data TEXT,                                -- JSON string (optional)

  -- Closed-world (recommended): event_code must exist in bus_events_catalog
  FOREIGN KEY (event_code) REFERENCES bus_events_catalog(event_code),

  -- Minimum linkage for per-message events
  CHECK (
    (event_code IN ('CLAIM_RECLAIMED','AUTO_FINALIZE_ACK','ENQUEUE_DUPLICATE','ENQUEUE_CONSTRAINT_FAILED') AND bus_id IS NOT NULL)
    OR
    (event_code NOT IN ('CLAIM_RECLAIMED','AUTO_FINALIZE_ACK','ENQUEUE_DUPLICATE','ENQUEUE_CONSTRAINT_FAILED'))
  )
);

CREATE INDEX IF NOT EXISTS idx_bus_events_ts ON bus_events(event_ts);
CREATE INDEX IF NOT EXISTS idx_bus_events_code_ts ON bus_events(event_code, event_ts);
