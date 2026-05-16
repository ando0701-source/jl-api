-- 0013_bus_failure_catalog.sql
-- Runtime bus failure-code detection catalog.
-- Phase1E-2F-6W: detection-source table linked to bus_findings_catalog.
-- Target: Cloudflare D1 (SQLite)

DROP TABLE IF EXISTS bus_failure_catalog;

CREATE TABLE IF NOT EXISTS bus_failure_catalog (
  failure_code TEXT PRIMARY KEY,
  finding_code TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_bus_failure_catalog_finding ON bus_failure_catalog(finding_code, enabled, failure_code);
