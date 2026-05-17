-- 1004_v_response_correlation.sql
-- Optional diagnostic view: detect RESPONSE correlation mismatches by joining
-- RESPONSE request-block bus_id -> REQUEST.bus_id.
-- One object per migration file: v_response_correlation.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_response_correlation;

CREATE VIEW v_response_correlation AS
WITH response_base AS (
  SELECT
    r.*,
    CASE
      WHEN CAST(json_extract(r.bus_json, '$.doc_id') AS TEXT) = '2PLT_60_IO_CONTRACT_RESPONDER_COMMIT' THEN 'JL_COMMIT'
      WHEN CAST(json_extract(r.bus_json, '$.doc_id') AS TEXT) LIKE '%_FROM_JL_COMMIT' THEN 'JL_COMMIT'
      WHEN CAST(json_extract(r.bus_json, '$.doc_id') AS TEXT) LIKE '%_FROM_JL_REJECT' THEN 'JL_REJECT'
      ELSE 'JL_PROPOSAL'
    END AS source_request_op_id
  FROM bus_messages r
  WHERE r.msg_type='RESPONSE'
), response_resolved AS (
  SELECT
    r.*,
    CAST(json_extract(r.bus_json, '$.message.contents.' || r.source_request_op_id || '.bus_id') AS TEXT) AS source_request_bus_id
  FROM response_base r
)
SELECT
  r.bus_id AS response_bus_id,
  r.bus_ts AS response_bus_ts,
  r.from_owner_id AS response_from_owner_id,
  r.to_owner_id AS response_to_owner_id,
  r.op_id AS response_op_id,
  r.flow_owner_id AS response_flow_owner_id,
  r.lane_id AS response_lane_id,
  r.request_id AS response_request_id,
  r.source_request_bus_id AS request_bus_id,

  q.bus_id AS request_bus_id,
  q.bus_ts AS request_bus_ts,
  q.op_id AS request_op_id,
  q.flow_owner_id AS request_flow_owner_id,
  q.lane_id AS request_lane_id,
  q.request_id AS request_id,

  CASE
    WHEN r.source_request_bus_id IS NULL OR TRIM(r.source_request_bus_id) = '' THEN 'MISSING_ECHO_REQUEST_BUS_ID'
    WHEN q.bus_id IS NULL THEN 'ECHO_REQUEST_NOT_FOUND'
    WHEN q.lane_id <> r.lane_id THEN 'LANE_MISMATCH'
    WHEN q.request_id <> r.request_id THEN 'REQUEST_ID_MISMATCH'
    ELSE 'OK'
  END AS correlation_status

FROM response_resolved r
LEFT JOIN bus_messages q
  ON q.bus_id = r.source_request_bus_id;
