-- 0015_diag_checks_catalog.sql
-- Diagnostic expectation master table for /diag observations.
-- Phase1D-4B: expected-value catalog for diagnostic key/value results.
-- Target: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS diag_checks_catalog (
  diag_key TEXT PRIMARY KEY,
  expected_value TEXT NOT NULL,
  compare_op TEXT NOT NULL CHECK (compare_op IN ('eq','gte','lte','contains','prefix','not_null')),
  severity TEXT NOT NULL CHECK (severity IN ('INFO','WARN','ERROR')),
  source_kind TEXT NOT NULL,
  phase TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_diag_checks_catalog_phase ON diag_checks_catalog(phase, enabled, diag_key);
CREATE INDEX IF NOT EXISTS idx_diag_checks_catalog_severity ON diag_checks_catalog(severity, enabled);
