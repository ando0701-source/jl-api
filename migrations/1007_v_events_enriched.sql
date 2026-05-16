-- 1007_v_events_enriched.sql
-- Enriched events view: v_events_all + event-code catalog + diagnostic finding catalogs.
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
    WHEN e.failure_code IS NOT NULL THEN COALESCE(fc.severity, fdf.severity, edf.severity, 'UNKNOWN')
    ELSE COALESCE(edf.severity, bc.severity, 'UNKNOWN')
  END AS severity,
  CASE
    WHEN e.failure_code IS NOT NULL THEN COALESCE(fc.description, fdf.description, 'UNREGISTERED_FAILURE_CODE:' || e.failure_code)
    ELSE COALESCE(edf.description, bc.message_template, 'UNREGISTERED_EVENT_CODE:' || e.event_code)
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

  -- event-code diagnostic finding meta
  bc.finding_code AS event_finding_code,
  edf.finding_domain AS event_finding_domain,
  edf.effective_recovery_profile AS event_effective_recovery_profile,
  COALESCE(edf.primary_fix_doc_id, bc.primary_fix_doc_id) AS event_primary_fix_doc_id,
  COALESCE(edf.primary_fix_rule_id, bc.primary_fix_rule_id) AS event_primary_fix_rule_id,
  edf.target_json_path AS event_target_json_path,
  edf.required_detail_keys AS event_required_detail_keys,

  -- failure-code detection catalog meta
  fc.finding_code AS failure_finding_code,
  fc.required_detail_keys AS failure_event_required_detail_keys,
  fc.is_terminal AS failure_is_terminal,

  -- failure-code diagnostic finding meta
  fdf.finding_domain AS failure_finding_domain,
  fdf.effective_recovery_profile AS failure_effective_recovery_profile,
  fdf.primary_fix_doc_id AS failure_primary_fix_doc_id,
  fdf.primary_fix_rule_id AS failure_primary_fix_rule_id,
  fdf.target_json_path AS failure_target_json_path,
  fdf.required_detail_keys AS failure_required_detail_keys,

  CASE
    WHEN e.failure_code IS NOT NULL THEN COALESCE(fdf.effective_recovery_profile, edf.effective_recovery_profile, bc.recovery_profile)
    ELSE COALESCE(edf.effective_recovery_profile, bc.recovery_profile)
  END AS effective_recovery_profile
FROM event_base e
LEFT JOIN bus_events_catalog bc
  ON bc.event_code = e.event_code
LEFT JOIN bus_failure_code_catalog fc
  ON fc.failure_code = e.failure_code
LEFT JOIN diag_findings_catalog fdf
  ON fdf.finding_code = fc.finding_code
LEFT JOIN diag_findings_catalog edf
  ON edf.finding_code = bc.finding_code;
