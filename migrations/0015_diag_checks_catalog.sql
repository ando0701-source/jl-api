-- 0015_diag_checks_catalog.sql
-- Executable diagnostic check catalog.
-- Phase1E-2F-6W: rebuilt as a check-source table linked to diag_findings_catalog.
-- Target: Cloudflare D1 (SQLite)

DROP TABLE IF EXISTS diag_checks_catalog;

CREATE TABLE IF NOT EXISTS diag_checks_catalog (
  diag_key TEXT PRIMARY KEY,
  finding_code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO','WARN','ERROR','FATAL')),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('HTTP_DIAG','TRIGGER_SMOKE','SCALAR_QUERY','STATIC_DOC','RUNNER','DB_VIEW','TS_CHECK','SCRIPT')),
  expected_value TEXT NOT NULL,
  compare_op TEXT NOT NULL CHECK (compare_op IN ('eq','gte','lte','contains','prefix','not_null')),
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_diag_checks_catalog_finding ON diag_checks_catalog(finding_code, enabled, diag_key);
CREATE INDEX IF NOT EXISTS idx_diag_checks_catalog_severity ON diag_checks_catalog(severity, enabled);
CREATE INDEX IF NOT EXISTS idx_diag_checks_catalog_source ON diag_checks_catalog(source_kind, enabled, diag_key);
