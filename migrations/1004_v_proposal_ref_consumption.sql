-- 1004_v_proposal_ref_consumption.sql
-- Proposal_ref consumption summary for Phase1B one-shot semantics.
-- One row per proposal response that has at least one accepted consuming
-- JL_COMMIT/JL_REJECT REQUEST. The hard gate should keep consumer_count = 1.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_proposal_ref_consumption;

CREATE VIEW v_proposal_ref_consumption AS
WITH consumers AS (
  SELECT
    json_extract(r.bus_json, '$.message.contents.PROPOSAL.bus_id') AS proposal_ref_bus_id,
    r.bus_id AS consuming_request_bus_id,
    r.bus_ts AS consuming_request_bus_ts,
    r.op_id AS consuming_request_op_id,
    r.flow_owner_id,
    r.lane_id,
    r.request_id,
    ROW_NUMBER() OVER (
      PARTITION BY json_extract(r.bus_json, '$.message.contents.PROPOSAL.bus_id')
      ORDER BY r.bus_ts ASC, r.bus_id ASC
    ) AS rn,
    COUNT(*) OVER (
      PARTITION BY json_extract(r.bus_json, '$.message.contents.PROPOSAL.bus_id')
    ) AS consumer_count
  FROM bus_messages r
  WHERE r.msg_type = 'REQUEST'
    AND r.op_id IN ('JL_COMMIT', 'JL_REJECT')
    AND json_extract(r.bus_json, '$.message.contents.PROPOSAL.bus_id') IS NOT NULL
)
SELECT
  c.proposal_ref_bus_id,
  c.consuming_request_bus_id AS first_consuming_request_bus_id,
  c.consuming_request_op_id AS first_consuming_op_id,
  c.consuming_request_bus_ts AS first_consuming_bus_ts,
  c.flow_owner_id,
  c.lane_id,
  c.request_id,
  c.consumer_count,
  CASE WHEN c.consumer_count = 1 THEN 'OK' ELSE 'DUPLICATE_CONSUMPTION' END AS consumption_status
FROM consumers c
WHERE c.rn = 1;
