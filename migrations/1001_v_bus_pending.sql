-- 1001_v_bus_pending.sql
-- Pending inbox items (common dequeue filter).
-- One object per migration file: v_bus_pending.
-- Target: Cloudflare D1 (SQLite)

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
