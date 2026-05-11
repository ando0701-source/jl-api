-- 1005_v_event_proposal_ref_resolution.sql
-- Derived events for proposal_ref target-resolution mismatches.
-- Uses v_proposal_ref_resolution (1004) and emits one derived event row per target request with mismatch.
-- One object per migration file: v_event_proposal_ref_resolution.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_event_proposal_ref_resolution;

CREATE VIEW IF NOT EXISTS v_event_proposal_ref_resolution AS
SELECT
  'DERIVED:proposal_ref_resolution:' || request_bus_id AS event_id,
  resolution_status AS event_code,
  request_bus_ts AS event_ts,

  request_flow_owner_id AS flow_owner_id,
  request_lane_id AS lane_id,
  request_request_id AS request_id,
  request_op_id AS op_id,

  request_bus_id AS bus_id,
  request_from_owner_id AS actor_owner_id,

  json_object(
    'request_bus_id', request_bus_id,
    'request_from_owner_id', request_from_owner_id,
    'request_to_owner_id', request_to_owner_id,
    'request_op_id', request_op_id,
    'request_flow_owner_id', request_flow_owner_id,
    'request_lane_id', request_lane_id,
    'request_request_id', request_request_id,
    'proposal_ref_bus_id', proposal_ref_bus_id,
    'proposal_ref_source_op_id', proposal_ref_source_op_id,
    'proposal_ref_source_terminal', proposal_ref_source_terminal,
    'proposal_ref_resolution_mode', proposal_ref_resolution_mode,
    'target_bus_id', target_bus_id,
    'target_bus_ts', target_bus_ts,
    'target_msg_type', target_msg_type,
    'target_op_id', target_op_id,
    'target_contract_doc_id', target_contract_doc_id,
    'target_flow_owner_id', target_flow_owner_id,
    'target_lane_id', target_lane_id,
    'target_request_id', target_request_id,
    'target_echo_request_bus_id', target_echo_request_bus_id,
    'origin_request_bus_id', origin_request_bus_id,
    'origin_msg_type', origin_msg_type,
    'origin_op_id', origin_op_id,
    'origin_contract_doc_id', origin_contract_doc_id,
    'origin_flow_owner_id', origin_flow_owner_id,
    'origin_lane_id', origin_lane_id,
    'origin_request_id', origin_request_id,
    'consuming_request_bus_id', consuming_request_bus_id,
    'consuming_request_bus_ts', consuming_request_bus_ts,
    'consuming_request_op_id', consuming_request_op_id,
    'consuming_request_flow_owner_id', consuming_request_flow_owner_id,
    'consuming_request_lane_id', consuming_request_lane_id,
    'consuming_request_request_id', consuming_request_request_id,
    'consumption_stage', consumption_stage
  ) AS data

FROM v_proposal_ref_resolution
WHERE resolution_status <> 'OK';
