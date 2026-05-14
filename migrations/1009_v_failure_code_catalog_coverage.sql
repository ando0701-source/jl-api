-- 1009_v_failure_code_catalog_coverage.sql
-- Diagnostic view: observed ENQUEUE_PRECHECK_REJECTED failure_codes and whether
-- each code resolves through bus_failure_code_catalog and diag_findings_catalog.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_failure_code_catalog_coverage;

CREATE VIEW v_failure_code_catalog_coverage AS
SELECT
  json_extract(e.data, '$.failure_code') AS failure_code,
  COUNT(*) AS observed_count,
  MIN(e.event_ts) AS first_event_ts,
  MAX(e.event_ts) AS last_event_ts,
  CASE WHEN fc.failure_code IS NULL THEN 0 ELSE 1 END AS catalog_resolved,
  CASE WHEN df.finding_code IS NULL THEN 0 ELSE 1 END AS finding_resolved,
  fc.finding_code,
  COALESCE(fc.severity, df.severity) AS severity,
  df.finding_domain,
  df.effective_recovery_profile,
  df.primary_fix_doc_id,
  df.primary_fix_rule_id,
  df.target_json_path
FROM bus_events e
LEFT JOIN bus_failure_code_catalog fc
  ON fc.failure_code = json_extract(e.data, '$.failure_code')
LEFT JOIN diag_findings_catalog df
  ON df.finding_code = fc.finding_code
WHERE e.event_code = 'ENQUEUE_PRECHECK_REJECTED'
GROUP BY
  json_extract(e.data, '$.failure_code'),
  CASE WHEN fc.failure_code IS NULL THEN 0 ELSE 1 END,
  CASE WHEN df.finding_code IS NULL THEN 0 ELSE 1 END,
  fc.finding_code,
  COALESCE(fc.severity, df.severity),
  df.finding_domain,
  df.effective_recovery_profile,
  df.primary_fix_doc_id,
  df.primary_fix_rule_id,
  df.target_json_path;
