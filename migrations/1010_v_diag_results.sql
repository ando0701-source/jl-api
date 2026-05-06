-- 1010_v_diag_results.sql
-- Diagnostic results view joining observed /diag rows with expected-value catalog rows.
-- Phase1D-4B: expose catalog-resolved status without requiring HTTP clients to compare values.
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
  c.expected_value,
  c.compare_op,
  c.severity,
  c.phase,
  c.source_kind,
  c.enabled,
  c.note AS expected_note,
  CASE WHEN c.diag_key IS NULL THEN 0 ELSE 1 END AS catalog_resolved,
  CASE
    WHEN c.diag_key IS NULL THEN 'NO_CATALOG'
    WHEN c.enabled <> 1 THEN 'DISABLED'
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
LEFT JOIN diag_checks_catalog c ON c.diag_key = r.diag_key;
