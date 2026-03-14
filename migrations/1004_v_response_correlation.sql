-- 1004_v_response_correlation.sql
-- Optional diagnostic view: detect RESPONSE correlation mismatches by joining
-- RESPONSE.contents.meta.echo_request_bus_id -> REQUEST.bus_id.
-- One object per migration file: v_response_correlation.
-- Target: Cloudflare D1 (SQLite)

CREATE VIEW IF NOT EXISTS v_response_correlation AS
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
  q.request_id AS request_id,

  CASE
    WHEN CAST(json_extract(r.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT) IS NULL THEN 'MISSING_ECHO_REQUEST_BUS_ID'
    WHEN q.bus_id IS NULL THEN 'ECHO_REQUEST_NOT_FOUND'
    WHEN q.lane_id <> r.lane_id THEN 'LANE_MISMATCH'
    WHEN q.request_id <> r.request_id THEN 'REQUEST_ID_MISMATCH'
    ELSE 'OK'
  END AS correlation_status

FROM bus_messages r
LEFT JOIN bus_messages q
  ON q.bus_id = CAST(json_extract(r.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT)
WHERE r.msg_type='RESPONSE';
