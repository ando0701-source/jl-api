-- 0015_bus_diag_catalog.sql
-- Executable diagnostic check catalog.
-- Phase1E-2F-6W: check-source table linked to bus_findings_catalog.
-- Target: Cloudflare D1 (SQLite)

DROP TABLE IF EXISTS bus_diag_catalog;

CREATE TABLE IF NOT EXISTS bus_diag_catalog (
  diag_key TEXT PRIMARY KEY,
  finding_code TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('HTTP_DIAG','TRIGGER_SMOKE','SCALAR_QUERY','STATIC_DOC','RUNNER','DB_VIEW','TS_CHECK','SCRIPT')),
  expected_value TEXT NOT NULL,
  compare_op TEXT NOT NULL CHECK (compare_op IN ('eq','gte','lte','contains','prefix','not_null')),
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_bus_diag_catalog_finding ON bus_diag_catalog(finding_code, enabled, diag_key);
CREATE INDEX IF NOT EXISTS idx_bus_diag_catalog_source ON bus_diag_catalog(source_kind, enabled, diag_key);
