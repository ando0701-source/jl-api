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
  data TEXT                                 -- JSON string (optional)
);

CREATE INDEX IF NOT EXISTS idx_bus_events_ts ON bus_events(event_ts);
CREATE INDEX IF NOT EXISTS idx_bus_events_code_ts ON bus_events(event_code, event_ts);

-- Extend event_catalog with appended-event definitions.
INSERT OR IGNORE INTO event_catalog(event_code, severity, message) VALUES
  ('CLAIM_RECLAIMED', 'WARN', 'TTL reclaim cleared an expired claim (append-only; original claim fields may be overwritten)'),
  ('AUTO_FINALIZE_ACK', 'INFO', 'Transport-layer ACK finalized a bus message (script-driven auto-finalize)'),
  ('ENQUEUE_DUPLICATE', 'WARN', 'enqueue ignored because bus_id already exists (idempotent duplicate)'),
  ('ENQUEUE_CONSTRAINT_FAILED', 'ERROR', 'enqueue failed by DB constraint (non-duplicate)');
