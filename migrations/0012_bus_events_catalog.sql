-- DDL_D1_73_bus_events_catalog.sql
-- Materialized catalog of event_code requirements and metadata.
-- Canonical definitions live in vocab.tsv under bus_events.event_code.<EVENT_CODE>.
-- Target: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS bus_events_catalog (
  event_code TEXT PRIMARY KEY,
  severity   TEXT NOT NULL CHECK (severity IN ('INFO','WARN','ERROR')),
  default_scope_kind TEXT NOT NULL CHECK (default_scope_kind IN ('BUS_MESSAGE','OWNER','LANE','QUEUE','GLOBAL')),
  recovery_profile TEXT,
  message_template TEXT NOT NULL,

  -- Optional governance hooks (for self-repair / doc routing)
  detect_rule_id TEXT,
  verify_query_id TEXT,
  primary_doc_id TEXT,
  primary_fix_doc_id TEXT,
  primary_fix_rule_id TEXT,

  -- Optional machine aids
  required_fields TEXT,        -- JSON array of required bus_events columns for this event (optional)
  required_data_keys TEXT,     -- JSON array of required JSON key paths under bus_events.data
  optional_data_keys TEXT,     -- JSON array of optional JSON key paths under bus_events.data
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_bus_events_catalog_sev ON bus_events_catalog(severity);
