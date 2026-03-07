-- DDL_D1_seed_owner_inbox_events_catalog.sql
-- Seed owner_inbox_events_catalog with inbox event_code definitions.
-- Canonical source: CODEX/vocab/vocab.tsv (owner_inbox_events.event_code.<EVENT_CODE>)
-- Target: Cloudflare D1 (SQLite)

INSERT OR IGNORE INTO owner_inbox_events_catalog(
  event_code,severity,default_scope_kind,recovery_profile,
  required_data_keys,optional_data_keys,message_template
) VALUES
  ('INBOX_ACK','INFO','OWNER','NOTIFY','["ack_state", "bus_id", "schema_id", "to_owner_id"]','["inbox_id", "note"]','Inbox item acknowledged (processed).'),
  ('INBOX_NOTIFY_PUT','INFO','OWNER','NOTIFY','["bus_id", "kind", "schema_id", "to_owner_id"]','["from_owner_id", "message", "note"]','Inbox notification stored (owner_inbox).'),
  ('INBOX_POLL_EMPTY','INFO','OWNER','NOTIFY','["schema_id", "to_owner_id"]','["note", "poll_seq", "wait_ms"]','Inbox poll found no messages.'),
  ('INBOX_TAKE','INFO','OWNER','NOTIFY','["bus_id", "schema_id", "to_owner_id"]','["from_owner_id", "inbox_id", "note", "take_mode"]','Inbox item taken (consume).');
