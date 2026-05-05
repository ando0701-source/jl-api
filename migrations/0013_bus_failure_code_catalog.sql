-- 0013_bus_failure_code_catalog.sql
-- Materialized catalog of preflight failure_code metadata.
-- Phase1C: failure_code catalogization for self-repair routing.
-- Canonical source is CODEX/docs/2PLT_40_FAILURE_CODE_CATALOG_ANNEX.json
-- and CODEX/vocab/vocab.tsv entries under bus_failure_code_catalog.*.
-- One object per migration file: bus_failure_code_catalog + indexes.
-- Target: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS bus_failure_code_catalog (
  failure_code TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('INFO','WARN','ERROR','FATAL')),
  effective_recovery_profile TEXT NOT NULL,
  default_scope_kind TEXT NOT NULL CHECK (default_scope_kind IN ('BUS_MESSAGE','OWNER','LANE','REQUEST','GLOBAL')),

  -- Governance hooks for repair routing. The concrete RULE_ID universe is
  -- intentionally allowed to be provisional until the DOC_ID/RULE_ID pass.
  primary_doc_id TEXT,
  primary_fix_doc_id TEXT,
  primary_fix_rule_id TEXT,
  detect_rule_id TEXT,
  verify_query_id TEXT,

  -- Required JSON paths under bus_events.data / bus_events.data.details.
  required_detail_keys TEXT NOT NULL DEFAULT '[]',
  optional_detail_keys TEXT NOT NULL DEFAULT '[]',

  phase_introduced TEXT NOT NULL,
  is_terminal INTEGER NOT NULL DEFAULT 0 CHECK (is_terminal IN (0,1)),
  message_template TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_bus_failure_code_catalog_sev ON bus_failure_code_catalog(severity);
CREATE INDEX IF NOT EXISTS idx_bus_failure_code_catalog_recovery ON bus_failure_code_catalog(effective_recovery_profile);
