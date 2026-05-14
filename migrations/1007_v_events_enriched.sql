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
    WHEN e.failure_code IS NOT NULL THEN COALESCE(fc.severity, df.severity, 'UNKNOWN')
    ELSE COALESCE(bc.severity, 'UNKNOWN')
  END AS severity,
  CASE
    WHEN e.failure_code IS NOT NULL THEN COALESCE(fc.description, df.description, 'UNREGISTERED_FAILURE_CODE:' || e.failure_code)
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

  -- failure-code detection catalog meta
  fc.finding_code AS failure_finding_code,
  fc.required_detail_keys AS failure_event_required_detail_keys,
  fc.is_terminal AS failure_is_terminal,

  -- diagnostic finding meta
  df.finding_domain AS failure_finding_domain,
  df.effective_recovery_profile AS failure_effective_recovery_profile,
  df.primary_fix_doc_id AS failure_primary_fix_doc_id,
  df.primary_fix_rule_id AS failure_primary_fix_rule_id,
  df.target_json_path AS failure_target_json_path,
  df.required_detail_keys AS failure_required_detail_keys,

  CASE
    WHEN e.failure_code IS NOT NULL THEN COALESCE(df.effective_recovery_profile, bc.recovery_profile)
    ELSE bc.recovery_profile
  END AS effective_recovery_profile
FROM event_base e
LEFT JOIN bus_events_catalog bc
  ON bc.event_code = e.event_code
LEFT JOIN bus_failure_code_catalog fc
  ON fc.failure_code = e.failure_code
LEFT JOIN diag_findings_catalog df
  ON df.finding_code = fc.finding_code;
