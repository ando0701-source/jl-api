-- 1011_v_bus_findings_enriched.sql
-- Unified finding-source view for failure_code, diag_key, and event_code entries.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_bus_findings_enriched;

CREATE VIEW v_bus_findings_enriched AS
SELECT
  'BUS_FAILURE' AS source_kind,
  f.failure_code AS source_code,
  f.finding_code,
  bf.finding_domain,
  bf.severity,
  bf.finding_message_template,
  bf.primary_fix_doc_id,
  bf.primary_fix_rule_id,
  bf.target_json_path,
  bf.effective_recovery_profile,
  bf.required_detail_keys,
  f.description AS source_description,
  bf.description AS finding_description,
  f.enabled AS source_enabled,
  bf.enabled AS finding_enabled
FROM bus_failure_catalog f
LEFT JOIN bus_findings_catalog bf
  ON bf.finding_code = f.finding_code
UNION ALL
SELECT
  'BUS_DIAG' AS source_kind,
  d.diag_key AS source_code,
  d.finding_code,
  bf.finding_domain,
  bf.severity,
  bf.finding_message_template,
  bf.primary_fix_doc_id,
  bf.primary_fix_rule_id,
  bf.target_json_path,
  bf.effective_recovery_profile,
  bf.required_detail_keys,
  d.description AS source_description,
  bf.description AS finding_description,
  d.enabled AS source_enabled,
  bf.enabled AS finding_enabled
FROM bus_diag_catalog d
LEFT JOIN bus_findings_catalog bf
  ON bf.finding_code = d.finding_code
UNION ALL
SELECT
  'BUS_EVENT' AS source_kind,
  e.event_code AS source_code,
  e.finding_code,
  bf.finding_domain,
  bf.severity,
  bf.finding_message_template,
  bf.primary_fix_doc_id,
  bf.primary_fix_rule_id,
  bf.target_json_path,
  bf.effective_recovery_profile,
  bf.required_detail_keys,
  e.description AS source_description,
  bf.description AS finding_description,
  e.enabled AS source_enabled,
  bf.enabled AS finding_enabled
FROM bus_events_catalog e
LEFT JOIN bus_findings_catalog bf
  ON bf.finding_code = e.finding_code
WHERE e.finding_code IS NOT NULL;
