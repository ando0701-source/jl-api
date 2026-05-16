-- 0016_bus_findings_catalog.sql
-- Parent catalog for diagnostic and repair findings.
-- Phase1E-2F-6W: diagnostic catalog rebuild.
-- Target: Cloudflare D1 (SQLite)

DROP TABLE IF EXISTS bus_findings_catalog;

CREATE TABLE IF NOT EXISTS bus_findings_catalog (
  finding_code TEXT PRIMARY KEY,
  finding_domain TEXT NOT NULL CHECK (finding_domain IN ('BUS_FAILURE','BUS_EVENT','DIAG_CHECK','LAYER60_RULE_DOC','LAYER60_TEMPLATE','DBMS_SCHEMA','TS_SYNC','VOCAB_SYNC')),
  severity TEXT NOT NULL CHECK (severity IN ('INFO','WARN','ERROR','FATAL')),
  finding_message_template TEXT NOT NULL,
  primary_fix_doc_id TEXT,
  primary_fix_rule_id TEXT,
  target_json_path TEXT NOT NULL,
  effective_recovery_profile TEXT NOT NULL,
  required_detail_keys TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_bus_findings_catalog_domain ON bus_findings_catalog(finding_domain, enabled, finding_code);
CREATE INDEX IF NOT EXISTS idx_bus_findings_catalog_severity ON bus_findings_catalog(severity, enabled);
