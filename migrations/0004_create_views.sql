-- DDL_D1_40_create_views.sql
-- Target: Cloudflare D1 (SQLite)

-- Pending inbox items (common dequeue filter)
CREATE VIEW IF NOT EXISTS v_bus_pending AS
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

-- Lane time series
CREATE VIEW IF NOT EXISTS v_lane_events AS
SELECT
  flow_owner_id, lane_id,
  bus_ts, bus_id,
  msg_type, op_id,
  in_state, state, out_state,
  from_owner_id, to_owner_id,
  q_state, claimed_by, claimed_at, done_at
FROM bus_messages
ORDER BY flow_owner_id, lane_id, bus_ts, bus_id;

-- Request-focused view
CREATE VIEW IF NOT EXISTS v_request_events AS
SELECT
  flow_owner_id, lane_id, request_id,
  bus_ts, bus_id,
  msg_type, op_id,
  in_state, state, out_state,
  from_owner_id, to_owner_id,
  q_state, claimed_by, claimed_at, done_at
FROM bus_messages
ORDER BY flow_owner_id, lane_id, request_id, bus_ts, bus_id;
