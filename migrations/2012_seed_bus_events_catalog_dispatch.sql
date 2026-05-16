-- 2012_seed_bus_events_catalog_dispatch.sql
-- Seed bus_events_catalog event-code metadata.
-- Target: Cloudflare D1 (SQLite)

DELETE FROM bus_events_catalog WHERE event_code IN (
  'DISPATCH_REQUESTED',
  'DISPATCH_ROUTE_NOT_FOUND',
  'DISPATCH_ROUTE_DISABLED',
  'DISPATCH_DELIVERY_SUCCEEDED',
  'DISPATCH_DELIVERY_FAILED'
);

INSERT OR IGNORE INTO bus_events_catalog(
  event_code,finding_code,event_scope,event_message_template,description,enabled
) VALUES
  ('DISPATCH_DELIVERY_FAILED',NULL,'BUS_MESSAGE','dispatch delivery failed for bus_id={bus_id} to_owner_id={to_owner_id}','Emitted when POST to owner receive endpoint fails or returns non-success.',1),
  ('DISPATCH_DELIVERY_SUCCEEDED',NULL,'BUS_MESSAGE','dispatch delivery succeeded for bus_id={bus_id} to_owner_id={to_owner_id}','Emitted after successful POST to owner receive endpoint.',1),
  ('DISPATCH_REQUESTED',NULL,'BUS_MESSAGE','dispatch requested for bus_id={bus_id} to_owner_id={to_owner_id}','Emitted immediately before route lookup / delivery attempt.',1),
  ('DISPATCH_ROUTE_DISABLED',NULL,'BUS_MESSAGE','dispatch route disabled for to_owner_id={to_owner_id}','Emitted when route row exists but is_enabled=0.',1),
  ('DISPATCH_ROUTE_NOT_FOUND',NULL,'BUS_MESSAGE','dispatch route not found for to_owner_id={to_owner_id}','Emitted when owner_dispatch_routes has no exact owner_id row.',1);
