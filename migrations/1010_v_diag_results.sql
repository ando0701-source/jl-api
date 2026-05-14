-- 1010_v_diag_results.sql
-- Diagnostic results view joining observed /diag rows with check and finding catalogs.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_diag_results;
CREATE VIEW v_diag_results AS
SELECT
  r.run_id,
  r.bus_id,
  r.diag_key,
  r.diag_value,
  r.status AS observed_status,
  r.note AS observed_note,
  r.created_at,
  c.finding_code,
  df.finding_domain,
  c.expected_value,
  c.compare_op,
  c.severity AS check_severity,
  df.severity AS finding_severity,
  c.source_kind,
  c.enabled AS check_enabled,
  df.enabled AS finding_enabled,
  c.description AS check_description,
  df.description AS finding_description,
  df.primary_fix_doc_id,
  df.primary_fix_rule_id,
  df.target_json_path,
  df.effective_recovery_profile,
  df.required_detail_keys,
  CASE WHEN c.diag_key IS NULL THEN 0 ELSE 1 END AS check_catalog_resolved,
  CASE WHEN df.finding_code IS NULL THEN 0 ELSE 1 END AS finding_catalog_resolved,
  CASE
    WHEN c.diag_key IS NULL THEN 'NO_CHECK_CATALOG'
    WHEN c.enabled <> 1 THEN 'CHECK_DISABLED'
    WHEN df.finding_code IS NULL THEN 'NO_FINDING_CATALOG'
    WHEN df.enabled <> 1 THEN 'FINDING_DISABLED'
    WHEN c.compare_op = 'eq' AND COALESCE(r.diag_value,'') = COALESCE(c.expected_value,'') THEN 'PASS'
    WHEN c.compare_op = 'gte' AND CAST(COALESCE(r.diag_value,'') AS REAL) >= CAST(c.expected_value AS REAL) THEN 'PASS'
    WHEN c.compare_op = 'lte' AND CAST(COALESCE(r.diag_value,'') AS REAL) <= CAST(c.expected_value AS REAL) THEN 'PASS'
    WHEN c.compare_op = 'contains' AND instr(COALESCE(r.diag_value,''), c.expected_value) > 0 THEN 'PASS'
    WHEN c.compare_op = 'prefix' AND substr(COALESCE(r.diag_value,''), 1, length(c.expected_value)) = c.expected_value THEN 'PASS'
    WHEN c.compare_op = 'not_null' AND r.diag_value IS NOT NULL AND r.diag_value <> '' THEN 'PASS'
    ELSE 'FAIL'
  END AS catalog_status,
  CASE
    WHEN c.diag_key IS NULL THEN 0
    WHEN c.enabled <> 1 THEN 1
    WHEN df.finding_code IS NULL THEN 0
    WHEN df.enabled <> 1 THEN 1
    WHEN r.status = (
      CASE
        WHEN c.compare_op = 'eq' AND COALESCE(r.diag_value,'') = COALESCE(c.expected_value,'') THEN 'PASS'
        WHEN c.compare_op = 'gte' AND CAST(COALESCE(r.diag_value,'') AS REAL) >= CAST(c.expected_value AS REAL) THEN 'PASS'
        WHEN c.compare_op = 'lte' AND CAST(COALESCE(r.diag_value,'') AS REAL) <= CAST(c.expected_value AS REAL) THEN 'PASS'
        WHEN c.compare_op = 'contains' AND instr(COALESCE(r.diag_value,''), c.expected_value) > 0 THEN 'PASS'
        WHEN c.compare_op = 'prefix' AND substr(COALESCE(r.diag_value,''), 1, length(c.expected_value)) = c.expected_value THEN 'PASS'
        WHEN c.compare_op = 'not_null' AND r.diag_value IS NOT NULL AND r.diag_value <> '' THEN 'PASS'
        ELSE 'FAIL'
      END
    ) THEN 1
    ELSE 0
  END AS status_match
FROM diag_results r
LEFT JOIN diag_checks_catalog c ON c.diag_key = r.diag_key
LEFT JOIN diag_findings_catalog df ON df.finding_code = c.finding_code;
