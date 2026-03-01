-- DDL_D1_70_q_state_text_rebuild.sql
-- Rebuild bus_messages to use TEXT q_state: PENDING/DONE/DEAD.
-- This migration is intentionally destructive to schema (not data) but migrates existing rows.

PRAGMA foreign_keys=OFF;
BEGIN;

-- Drop dependent views (will be recreated)
DROP VIEW IF EXISTS v_bus_pending;
DROP VIEW IF EXISTS v_lane_events;
DROP VIEW IF EXISTS v_request_events;
DROP VIEW IF EXISTS v_response_correlation;
DROP VIEW IF EXISTS v_event_lane_mismatch;

-- Drop indexes (will be recreated)
DROP INDEX IF EXISTS idx_inbox;
DROP INDEX IF EXISTS idx_inbox_claim;
DROP INDEX IF EXISTS idx_inbox_pending;
DROP INDEX IF EXISTS idx_lane;
DROP INDEX IF EXISTS idx_request;
DROP INDEX IF EXISTS idx_op_id;
DROP INDEX IF EXISTS uq_req_dedup;

-- Rebuild bus_messages
DROP TABLE IF EXISTS bus_messages_old;
ALTER TABLE bus_messages RENAME TO bus_messages_old;

CREATE TABLE bus_messages (
  schema_id TEXT NOT NULL CHECK (schema_id = '2PLT_BUS/v1'),
  bus_id    TEXT PRIMARY KEY,
  bus_ts    INTEGER NOT NULL,
  q_state   TEXT NOT NULL DEFAULT 'PENDING' CHECK (q_state IN ('PENDING','DONE','DEAD')),

  from_owner_id TEXT NOT NULL,
  to_owner_id   TEXT NOT NULL,

  claimed_by TEXT,
  claimed_at INTEGER,
  done_at    INTEGER,

  message_schema_id TEXT NOT NULL CHECK (message_schema_id = '2PLT_MESSAGE/v1'),

  msg_type TEXT NOT NULL CHECK (msg_type IN ('REQUEST','RESPONSE')),
  op_id    TEXT NOT NULL,

  flow_owner_id TEXT NOT NULL,
  lane_id       TEXT NOT NULL,
  request_id    TEXT NOT NULL,

  in_state  TEXT NOT NULL CHECK (in_state IN ('NUL','PROPOSAL','COMMIT','UNRESOLVED','ABEND')),
  state     TEXT CHECK (state IN ('PROPOSAL','COMMIT','UNRESOLVED','ABEND')),
  out_state TEXT CHECK (out_state IN ('PROPOSAL','COMMIT','UNRESOLVED','ABEND')),

  bus_json TEXT NOT NULL,
  inserted_at INTEGER NOT NULL DEFAULT (unixepoch()),

  CHECK (
    (msg_type='REQUEST'  AND state IS NULL AND out_state IS NULL)
    OR
    (msg_type='RESPONSE' AND state IS NOT NULL AND out_state = state)
  )
);

INSERT INTO bus_messages(
  schema_id,bus_id,bus_ts,q_state,
  from_owner_id,to_owner_id,
  claimed_by,claimed_at,done_at,
  message_schema_id,msg_type,op_id,
  flow_owner_id,lane_id,request_id,
  in_state,state,out_state,
  bus_json,inserted_at
)
SELECT
  schema_id,bus_id,bus_ts,
  CASE
    WHEN q_state IN (0,'0') THEN 'PENDING'
    WHEN q_state IN (1,'1') THEN 'DONE'
    WHEN q_state IN (9,'9') THEN 'DEAD'
    WHEN q_state IN ('PENDING','DONE','DEAD') THEN q_state
    ELSE 'PENDING'
  END AS q_state,
  from_owner_id,to_owner_id,
  claimed_by,claimed_at,done_at,
  message_schema_id,msg_type,op_id,
  flow_owner_id,lane_id,request_id,
  in_state,state,out_state,
  json_set(bus_json, '$.q_state', CASE
    WHEN q_state IN (0,'0') THEN 'PENDING'
    WHEN q_state IN (1,'1') THEN 'DONE'
    WHEN q_state IN (9,'9') THEN 'DEAD'
    WHEN q_state IN ('PENDING','DONE','DEAD') THEN q_state
    ELSE 'PENDING'
  END),inserted_at
FROM bus_messages_old;

DROP TABLE bus_messages_old;

-- Rebuild vocab_q_state to name-based
DROP TABLE IF EXISTS vocab_q_state;
CREATE TABLE vocab_q_state (
  name TEXT PRIMARY KEY,
  legacy_code INTEGER NOT NULL UNIQUE,
  meaning TEXT NOT NULL
);
INSERT OR REPLACE INTO vocab_q_state(name,legacy_code,meaning) VALUES
  ('PENDING',0,'Eligible for claim/processing.'),
  ('DONE',1,'Successfully processed and finalized (not eligible for claim).'),
  ('DEAD',9,'Abnormal termination / dead-letter (not eligible for claim).');

-- Recreate indexes
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

-- Recreate views
CREATE VIEW v_bus_pending AS
SELECT
  bus_id, bus_ts, q_state,
  from_owner_id, to_owner_id,
  claimed_by, claimed_at,
  msg_type, op_id,
  flow_owner_id, lane_id, request_id,
  in_state, state, out_state,
  inserted_at
FROM bus_messages
WHERE q_state='PENDING' AND claimed_by IS NULL;

CREATE VIEW v_lane_events AS
SELECT
  flow_owner_id, lane_id,
  bus_ts, bus_id,
  msg_type, op_id,
  in_state, state, out_state,
  from_owner_id, to_owner_id,
  q_state, claimed_by, claimed_at, done_at
FROM bus_messages
ORDER BY flow_owner_id, lane_id, bus_ts, bus_id;

CREATE VIEW v_request_events AS
SELECT
  flow_owner_id, lane_id, request_id,
  bus_ts, bus_id,
  msg_type, op_id,
  in_state, state, out_state,
  from_owner_id, to_owner_id,
  q_state, claimed_by, claimed_at, done_at
FROM bus_messages
ORDER BY flow_owner_id, lane_id, request_id, bus_ts, bus_id;

-- Diagnostic correlation view (same as DDL_D1_50)
CREATE VIEW v_response_correlation AS
SELECT
  r.bus_id AS response_bus_id,
  r.bus_ts AS response_bus_ts,
  r.from_owner_id AS response_from_owner_id,
  r.to_owner_id AS response_to_owner_id,
  r.flow_owner_id AS response_flow_owner_id,
  r.lane_id AS response_lane_id,
  r.request_id AS response_request_id,
  CAST(json_extract(r.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT) AS echo_request_bus_id,
  q.bus_id AS request_bus_id,
  q.bus_ts AS request_bus_ts,
  q.flow_owner_id AS request_flow_owner_id,
  q.lane_id AS request_lane_id,
  q.request_id AS request_id
FROM bus_messages r
LEFT JOIN bus_messages q
  ON q.bus_id = CAST(json_extract(r.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT)
WHERE r.msg_type='RESPONSE';

-- Derived event view (same as DDL_D1_61)
CREATE VIEW v_event_lane_mismatch AS
SELECT
  r.bus_id   AS event_id,
  'LANE_MISMATCH' AS event_code,
  r.bus_ts   AS event_ts,

  q.flow_owner_id AS flow_owner_id,
  q.request_id    AS request_id,
  r.op_id         AS op_id,

  q.bus_id   AS request_bus_id,
  q.lane_id  AS expected_lane_id,
  r.lane_id  AS observed_lane_id,

  r.from_owner_id AS response_from_owner_id,
  r.to_owner_id   AS response_to_owner_id,
  r.bus_id        AS response_bus_id
FROM bus_messages r
JOIN bus_messages q
  ON q.bus_id = CAST(json_extract(r.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT)
WHERE r.msg_type='RESPONSE'
  AND q.lane_id <> r.lane_id;

COMMIT;
PRAGMA foreign_keys=ON;
