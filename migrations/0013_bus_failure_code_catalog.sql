-- 0013_bus_failure_code_catalog.sql
-- Runtime bus failure-code detection catalog.
-- Phase1E-2F-6W: rebuilt as a detection-source table linked to diag_findings_catalog.
-- Target: Cloudflare D1 (SQLite)

DROP TABLE IF EXISTS bus_failure_code_catalog;

CREATE TABLE IF NOT EXISTS bus_failure_code_catalog (
  failure_code TEXT PRIMARY KEY,
  finding_code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO','WARN','ERROR','FATAL')),
  is_terminal INTEGER NOT NULL DEFAULT 0 CHECK (is_terminal IN (0,1)),
  required_detail_keys TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_bus_failure_code_catalog_finding ON bus_failure_code_catalog(finding_code, enabled, failure_code);
CREATE INDEX IF NOT EXISTS idx_bus_failure_code_catalog_severity ON bus_failure_code_catalog(severity, enabled);
