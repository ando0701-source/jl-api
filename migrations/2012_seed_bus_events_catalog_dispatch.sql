-- 2012_seed_bus_events_catalog_dispatch.sql
-- Extends bus_events_catalog with dispatch lifecycle event codes.
-- Safe for manual application after bus_events_catalog exists.

DELETE FROM bus_events_catalog where event_code in (
  'DISPATCH_REQUESTED',
  'DISPATCH_ROUTE_NOT_FOUND',
  'DISPATCH_ROUTE_DISABLED',
  'DISPATCH_DELIVERY_SUCCEEDED',
  'DISPATCH_DELIVERY_FAILED'
);

INSERT OR IGNORE INTO bus_events_catalog(
  event_code,severity,default_scope_kind,recovery_profile,
  message_template,required_data_keys,optional_data_keys,notes
) VALUES
('DISPATCH_REQUESTED','INFO','BUS_MESSAGE',NULL,'dispatch requested for bus_id={bus_id} to_owner_id={to_owner_id}','["schema_id","bus_id","to_owner_id"]','["from_owner_id","dispatch_url"]','Emitted immediately before route lookup / delivery attempt.'),
('DISPATCH_ROUTE_NOT_FOUND','WARN','BUS_MESSAGE',NULL,'dispatch route not found for to_owner_id={to_owner_id}','["schema_id","bus_id","to_owner_id"]','["from_owner_id"]','Emitted when owner_dispatch_routes has no exact owner_id row.'),
('DISPATCH_ROUTE_DISABLED','WARN','BUS_MESSAGE',NULL,'dispatch route disabled for to_owner_id={to_owner_id}','["schema_id","bus_id","to_owner_id","dispatch_url"]','["from_owner_id"]','Emitted when route row exists but is_enabled=0.'),
('DISPATCH_DELIVERY_SUCCEEDED','INFO','BUS_MESSAGE',NULL,'dispatch delivery succeeded for bus_id={bus_id} to_owner_id={to_owner_id}','["schema_id","bus_id","to_owner_id","dispatch_url"]','["from_owner_id","http_status"]','Emitted after successful POST to owner receive endpoint.'),
('DISPATCH_DELIVERY_FAILED','ERROR','BUS_MESSAGE',NULL,'dispatch delivery failed for bus_id={bus_id} to_owner_id={to_owner_id}','["schema_id","bus_id","to_owner_id","dispatch_url"]','["from_owner_id","http_status","error_name","error_message"]','Emitted when POST to owner receive endpoint fails or returns non-success.');
