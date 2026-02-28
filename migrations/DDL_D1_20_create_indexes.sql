-- DDL_D1_20_create_indexes.sql
-- Target: Cloudflare D1 (SQLite)

-- Inbox polling (eligible work items)
-- NOTE: claim rule typically uses: q_state=0 AND claimed_by IS NULL.
CREATE INDEX IF NOT EXISTS idx_inbox
  ON bus_messages(to_owner_id, q_state, bus_ts, bus_id);

CREATE INDEX IF NOT EXISTS idx_inbox_claim
  ON bus_messages(to_owner_id, q_state, claimed_by, bus_ts, bus_id);

-- Partial index for the common dequeue path (fast)
CREATE INDEX IF NOT EXISTS idx_inbox_pending
  ON bus_messages(to_owner_id, bus_ts, bus_id)
  WHERE q_state=0 AND claimed_by IS NULL;

-- Lane history
CREATE INDEX IF NOT EXISTS idx_lane
  ON bus_messages(flow_owner_id, lane_id, bus_ts, bus_id);

-- Request correlation
CREATE INDEX IF NOT EXISTS idx_request
  ON bus_messages(flow_owner_id, lane_id, request_id, bus_ts, bus_id);

-- Trigger / op scans (debug)
CREATE INDEX IF NOT EXISTS idx_op_id
  ON bus_messages(op_id, bus_ts, bus_id);

-- Optional dedup (COMMENTED OUT by default)
-- If you want to "naturally" de-duplicate REQUEST replays at DB level, enable this.
-- Be careful: it forbids multiple REQUEST rows with the same (flow_owner_id,lane_id,request_id,op_id).
--
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_req_dedup
--   ON bus_messages(flow_owner_id, lane_id, request_id, op_id)
--   WHERE msg_type='REQUEST';
