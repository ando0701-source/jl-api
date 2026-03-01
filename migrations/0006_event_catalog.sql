-- DDL_D1_60_event_catalog.sql
-- Minimal event catalog (definitions only; does not pollute bus_messages).
-- Target: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS event_catalog (
  event_code TEXT PRIMARY KEY,
  severity   TEXT NOT NULL CHECK (severity IN ('INFO','WARN','ERROR')),
  message    TEXT NOT NULL
);

INSERT OR IGNORE INTO event_catalog(event_code, severity, message) VALUES
  ('LANE_MISMATCH', 'ERROR', 'RESPONSE lane_id does not match REQUEST lane_id referenced by echo_request_bus_id'),
  ('REQUEST_ID_MISMATCH', 'ERROR', 'RESPONSE request_id does not match REQUEST request_id referenced by echo_request_bus_id'),
  ('MISSING_ECHO_REQUEST_BUS_ID', 'ERROR', 'RESPONSE is missing contents.meta.echo_request_bus_id'),
  ('ECHO_REQUEST_NOT_FOUND', 'ERROR', 'RESPONSE echo_request_bus_id does not exist in bus_messages');
