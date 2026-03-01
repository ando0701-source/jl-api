-- DDL_D1_61_event_lane_mismatch_view.sql
-- Derived events for correlation mismatches (view-only; no writes).
-- This view is intentionally narrow for TC3: LANE_MISMATCH only.
-- Target: Cloudflare D1 (SQLite)

CREATE VIEW IF NOT EXISTS v_event_lane_mismatch AS
SELECT
  r.bus_id   AS event_id,           -- stable id (use response bus_id)
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
