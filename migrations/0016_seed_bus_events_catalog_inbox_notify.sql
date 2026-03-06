-- DDL_D1_77_seed_bus_events_catalog_inbox_notify.sql
-- Extend bus_events_catalog with INBOX_NOTIFY_PUT (owner inbox notification).
-- Target: Cloudflare D1 (SQLite)

INSERT OR IGNORE INTO bus_events_catalog(
  event_code,severity,default_scope_kind,recovery_profile,
  required_data_keys,optional_data_keys,message_template
) VALUES
  ('INBOX_NOTIFY_PUT','INFO','OWNER','NOTIFY',
    '["schema_id","kind","to_owner_id","bus_id"]',
    '["from_owner_id","message","note"]',
    'Inbox notification stored (owner_inbox).'
  );
