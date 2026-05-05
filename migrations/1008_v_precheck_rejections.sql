-- 1008_v_precheck_rejections.sql
-- Dedicated audit view for enqueue preflight rejections.
-- Purpose: expose rejected-attempt details without requiring agents to parse
-- raw bus_events.data for common self-repair routing.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_precheck_rejections;

CREATE VIEW v_precheck_rejections AS
SELECT
  e.event_id,
  e.event_ts,
  e.bus_id AS attempted_bus_id,
  e.flow_owner_id,
  e.lane_id,
  e.request_id,
  e.op_id,
  e.actor_owner_id,
  json_extract(e.data, '$.failure_code') AS failure_code,
  json_extract(e.data, '$.validation_stage') AS validation_stage,
  json_extract(e.data, '$.error_code') AS error_code,
  json_extract(e.data, '$.attempted_payload_hash_sha256') AS attempted_payload_hash_sha256,
  json_extract(e.data, '$.details.proposal_ref_bus_id') AS proposal_ref_bus_id,
  json_extract(e.data, '$.details.target_bus_id') AS target_bus_id,
  json_extract(e.data, '$.details.consuming_request_bus_id') AS consuming_request_bus_id,
  json_extract(e.data, '$.details.consuming_request_op_id') AS consuming_request_op_id,
  json_extract(e.data, '$.details.consumption_stage') AS consumption_stage,
  CASE json_extract(e.data, '$.failure_code')
    WHEN 'proposal_ref_not_found' THEN 'RETRY_WITH_VALID_PROPOSAL_REF'
    WHEN 'proposal_ref_target_not_response' THEN 'RESELECT_PROPOSAL_RESPONSE_TARGET'
    WHEN 'proposal_ref_target_op_mismatch' THEN 'RESELECT_PROPOSAL_RESPONSE_TARGET'
    WHEN 'proposal_ref_target_terminal_mismatch' THEN 'RESTART_FROM_JL_PROPOSAL'
    WHEN 'proposal_ref_flow_owner_mismatch' THEN 'REPAIR_SCOPE_FLOW_OWNER'
    WHEN 'proposal_ref_lane_mismatch' THEN 'REPAIR_SCOPE_LANE'
    WHEN 'proposal_ref_request_id_mismatch' THEN 'REPAIR_SCOPE_REQUEST_ID'
    WHEN 'proposal_ref_origin_request_invalid' THEN 'REPAIR_ORIGIN_ECHO_OR_RESTART'
    WHEN 'proposal_ref_already_consumed' THEN 'RESTART_FROM_JL_PROPOSAL'
    ELSE 'INSPECT_PRECHECK_REJECTION'
  END AS effective_recovery_profile,
  e.data
FROM bus_events e
WHERE e.event_code = 'ENQUEUE_PRECHECK_REJECTED';
