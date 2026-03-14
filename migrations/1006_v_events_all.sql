-- 1006_v_events_all.sql
-- Unified events view: appended bus_events + derived mismatch events.
-- One object per migration file: v_events_all.
-- Target: Cloudflare D1 (SQLite)

CREATE VIEW IF NOT EXISTS v_events_all AS
SELECT
  event_id,
  event_code,
  event_ts,
  flow_owner_id,
  lane_id,
  request_id,
  op_id,
  bus_id,
  actor_owner_id,
  data
FROM bus_events

UNION ALL

SELECT
  event_id,
  event_code,
  event_ts,
  flow_owner_id,
  lane_id,
  request_id,
  op_id,
  bus_id,
  actor_owner_id,
  data
FROM v_event_response_correlation;
