-- 1008_v_precheck_rejections.sql
-- Dedicated audit view for enqueue preflight rejections.
-- Resolves failure_code through bus_failure_code_catalog and diag_findings_catalog.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_precheck_rejections;

CREATE VIEW v_precheck_rejections AS
WITH precheck AS (
  SELECT
    e.*,
    json_extract(e.data, '$.failure_code') AS failure_code
  FROM bus_events e
  WHERE e.event_code = 'ENQUEUE_PRECHECK_REJECTED'
)
SELECT
  e.event_id,
  e.event_ts,
  e.bus_id AS attempted_bus_id,
  e.flow_owner_id,
  e.lane_id,
  e.request_id,
  e.op_id,
  e.actor_owner_id,
  e.failure_code,
  fc.finding_code,
  json_extract(e.data, '$.validation_stage') AS validation_stage,
  json_extract(e.data, '$.error_code') AS error_code,
  json_extract(e.data, '$.attempted_payload_hash_sha256') AS attempted_payload_hash_sha256,
  json_extract(e.data, '$.details.proposal_ref_bus_id') AS proposal_ref_bus_id,
  json_extract(e.data, '$.details.target_bus_id') AS target_bus_id,
  json_extract(e.data, '$.details.consuming_request_bus_id') AS consuming_request_bus_id,
  json_extract(e.data, '$.details.consuming_request_op_id') AS consuming_request_op_id,
  json_extract(e.data, '$.details.consumption_stage') AS consumption_stage,
  COALESCE(fc.severity, df.severity, 'UNKNOWN') AS failure_severity,
  COALESCE(df.effective_recovery_profile, 'INSPECT_PRECHECK_REJECTION') AS effective_recovery_profile,
  df.finding_domain AS finding_domain,
  df.primary_fix_doc_id AS primary_fix_doc_id,
  df.primary_fix_rule_id AS primary_fix_rule_id,
  df.target_json_path AS target_json_path,
  COALESCE(df.required_detail_keys, fc.required_detail_keys) AS required_detail_keys,
  fc.is_terminal AS is_terminal,
  COALESCE(fc.description, df.description) AS failure_description,
  CASE WHEN fc.failure_code IS NULL THEN 0 ELSE 1 END AS catalog_resolved,
  CASE WHEN df.finding_code IS NULL THEN 0 ELSE 1 END AS finding_resolved,
  e.data
FROM precheck e
LEFT JOIN bus_failure_code_catalog fc
  ON fc.failure_code = e.failure_code
LEFT JOIN diag_findings_catalog df
  ON df.finding_code = fc.finding_code;
