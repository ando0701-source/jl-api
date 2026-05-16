-- 0012_bus_events_catalog.sql
-- Materialized catalog of event_code metadata.
-- Canonical definitions live in vocab.tsv under bus_events.event_code.<EVENT_CODE>.
-- One object per migration file: bus_events_catalog + dedicated indexes.
-- Target: Cloudflare D1 (SQLite)

DROP TABLE IF EXISTS bus_events_catalog;

CREATE TABLE IF NOT EXISTS bus_events_catalog (
  event_code TEXT PRIMARY KEY,
  finding_code TEXT,          -- Optional bus_findings_catalog finding_code for event-code-level self-repair routing
  event_scope TEXT NOT NULL CHECK (event_scope IN ('BUS_MESSAGE','OWNER','LANE','QUEUE','GLOBAL')),
  event_message_template TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_bus_events_catalog_finding ON bus_events_catalog(finding_code, enabled, event_code);
CREATE INDEX IF NOT EXISTS idx_bus_events_catalog_scope ON bus_events_catalog(event_scope, enabled, event_code);
