-- 1007_v_events_enriched.sql
-- Enriched events view: v_events_all + event_code catalog + failure_code catalog.
-- Phase1C: ENQUEUE_PRECHECK_REJECTED failure_code metadata is resolved through
-- bus_failure_code_catalog instead of hard-coded CASE expressions.
-- One object per migration file: v_events_enriched.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_events_enriched;

CREATE VIEW v_events_enriched AS
WITH event_base AS (
  SELECT
    e.*,
    json_extract(e.data, '$.failure_code') AS failure_code
  FROM v_events_all e
)
SELECT
  e.event_id,
  e.event_code,
  CASE
    WHEN e.failure_code IS NOT NULL THEN COALESCE(fc.severity, 'UNKNOWN')
    ELSE COALESCE(bc.severity, 'UNKNOWN')
  END AS severity,
  CASE
    WHEN e.failure_code IS NOT NULL THEN COALESCE(fc.message_template, 'UNREGISTERED_FAILURE_CODE:' || e.failure_code)
    ELSE COALESCE(bc.message_template, 'UNREGISTERED_EVENT_CODE:' || e.event_code)
  END AS message,
  e.event_ts,
  e.flow_owner_id,
  e.lane_id,
  e.request_id,
  e.op_id,
  e.bus_id,
  e.actor_owner_id,
  e.data,
  e.failure_code,

  -- event-code catalog meta
  bc.default_scope_kind AS default_scope_kind,
  bc.recovery_profile AS recovery_profile,
  bc.required_data_keys AS required_data_keys,
  bc.optional_data_keys AS optional_data_keys,

  -- failure-code catalog meta (Phase1C)
  fc.effective_recovery_profile AS failure_effective_recovery_profile,
  fc.default_scope_kind AS failure_default_scope_kind,
  fc.primary_doc_id AS failure_primary_doc_id,
  fc.primary_fix_doc_id AS failure_primary_fix_doc_id,
  fc.primary_fix_rule_id AS failure_primary_fix_rule_id,
  fc.detect_rule_id AS failure_detect_rule_id,
  fc.verify_query_id AS failure_verify_query_id,
  fc.required_detail_keys AS failure_required_detail_keys,
  fc.optional_detail_keys AS failure_optional_detail_keys,
  fc.phase_introduced AS failure_phase_introduced,
  fc.is_terminal AS failure_is_terminal,

  CASE
    WHEN e.failure_code IS NOT NULL THEN COALESCE(fc.effective_recovery_profile, bc.recovery_profile)
    ELSE bc.recovery_profile
  END AS effective_recovery_profile
FROM event_base e
LEFT JOIN bus_events_catalog bc
  ON bc.event_code = e.event_code
LEFT JOIN bus_failure_code_catalog fc
  ON fc.failure_code = e.failure_code;
