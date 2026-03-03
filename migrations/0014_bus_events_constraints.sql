-- DDL_D1_75_bus_events_constraints.sql
-- Apply constraints / FK to bus_events.
-- NOTE: SQLite requires table rebuild to add CHECK/FK to existing table reliably.
-- Target: Cloudflare D1 (SQLite)

PRAGMA foreign_keys=OFF;

ALTER TABLE bus_events RENAME TO bus_events__old;

CREATE TABLE bus_events (
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

  -- Row-level constraints (from vocab)
  CHECK (
    (event_code IN ('CLAIM_RECLAIMED','AUTO_FINALIZE_ACK','ENQUEUE_DUPLICATE','ENQUEUE_CONSTRAINT_FAILED') AND bus_id IS NOT NULL)
    OR
    (event_code NOT IN ('CLAIM_RECLAIMED','AUTO_FINALIZE_ACK','ENQUEUE_DUPLICATE','ENQUEUE_CONSTRAINT_FAILED'))
  )
);

INSERT INTO bus_events(event_id,event_ts,event_code,bus_id,flow_owner_id,lane_id,request_id,op_id,actor_owner_id,data)
SELECT event_id,event_ts,event_code,bus_id,flow_owner_id,lane_id,request_id,op_id,actor_owner_id,data
FROM bus_events__old;

DROP TABLE bus_events__old;

CREATE INDEX IF NOT EXISTS idx_bus_events_ts ON bus_events(event_ts);
CREATE INDEX IF NOT EXISTS idx_bus_events_code_ts ON bus_events(event_code, event_ts);

PRAGMA foreign_keys=ON;
