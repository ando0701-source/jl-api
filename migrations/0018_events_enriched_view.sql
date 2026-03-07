-- DDL_D1_78_events_enriched_view.sql
-- Enriched events view: v_events_all + bus_events_catalog (materialized vocab) -> audit-friendly shape.
-- Keeps /events.txt and ad-hoc SQL aligned: events -> catalog join -> output.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_events_enriched;

CREATE VIEW v_events_enriched AS
SELECT
  e.event_id,
  e.event_code,
  COALESCE(bc.severity, 'UNKNOWN') AS severity,
  COALESCE(bc.message_template, 'UNREGISTERED_EVENT_CODE:' || e.event_code) AS message,
  e.event_ts,
  e.flow_owner_id,
  e.lane_id,
  e.request_id,
  e.op_id,
  e.bus_id,
  e.actor_owner_id,
  e.data,

  -- catalog meta (useful for auditors/agents)
  bc.default_scope_kind AS default_scope_kind,
  bc.recovery_profile AS recovery_profile,
  bc.required_data_keys AS required_data_keys,
  bc.optional_data_keys AS optional_data_keys
FROM v_events_all e
LEFT JOIN bus_events_catalog bc
  ON bc.event_code = e.event_code;
