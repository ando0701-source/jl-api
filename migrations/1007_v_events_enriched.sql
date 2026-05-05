-- 1007_v_events_enriched.sql
-- Enriched events view: v_events_all + bus_events_catalog (materialized vocab) -> audit-friendly shape.
-- Keeps /events.txt and ad-hoc SQL aligned: events -> catalog join -> output.
-- One object per migration file: v_events_enriched.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_events_enriched;

CREATE VIEW v_events_enriched AS
SELECT
  e.event_id,
  e.event_code,
  COALESCE(bc.severity, 'UNKNOWN') AS severity,
  COALESCE(bc.message_template, 'UNREGISTERED_EVENT_CODE:' || e.event_code) AS message,
  e.event_ts,
  e.flow_owner_id,
  e.lane_id,
  e.request_id,
  e.op_id,
  e.bus_id,
  e.actor_owner_id,
  e.data,
  json_extract(e.data, '$.failure_code') AS failure_code,

  -- catalog meta (useful for auditors/agents)
  bc.default_scope_kind AS default_scope_kind,
  bc.recovery_profile AS recovery_profile,
  CASE
    WHEN e.event_code = 'ENQUEUE_PRECHECK_REJECTED' THEN
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
        ELSE bc.recovery_profile
      END
    ELSE bc.recovery_profile
  END AS effective_recovery_profile,
  bc.required_data_keys AS required_data_keys,
  bc.optional_data_keys AS optional_data_keys
FROM v_events_all e
LEFT JOIN bus_events_catalog bc
  ON bc.event_code = e.event_code;
