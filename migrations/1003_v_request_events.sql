-- 1003_v_request_events.sql
-- Request-focused view.
-- One object per migration file: v_request_events.
-- Target: Cloudflare D1 (SQLite)

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
