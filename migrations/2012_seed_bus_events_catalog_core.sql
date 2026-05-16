-- 2012_seed_bus_events_catalog_core.sql
-- Seed bus_events_catalog event-code metadata.
-- Target: Cloudflare D1 (SQLite)

DELETE FROM bus_events_catalog WHERE event_code IN (
  'AUTO_FINALIZE_ACK',
  'BUS_RECOVERY_START',
  'BUS_STALL_CLEARED',
  'BUS_STALL_DETECTED',
  'BUS_STALL_NOT_CLEARED',
  'CLAIM_RECLAIMED',
  'ECHO_REQUEST_NOT_FOUND',
  'ENQUEUE_CONSTRAINT_FAILED',
  'ENQUEUE_DUPLICATE',
  'ENQUEUE_PRECHECK_REJECTED',
  'LANE_MISMATCH',
  'MISSING_ECHO_REQUEST_BUS_ID',
  'REQUEST_ID_MISMATCH'
);

INSERT OR IGNORE INTO bus_events_catalog(
  event_code,finding_code,event_scope,event_message_template,description,enabled
) VALUES
  ('AUTO_FINALIZE_ACK',NULL,'BUS_MESSAGE','Auto-finalize ACK executed safely for one message (bus_id).','Auto-finalize ACK executed safely for one message (bus_id).',1),
  ('BUS_RECOVERY_START',NULL,'OWNER','Recovery started for incident_id={incident_id} profile={recovery_profile}.','Recovery started for incident_id={incident_id} profile={recovery_profile}.',1),
  ('BUS_STALL_CLEARED',NULL,'OWNER','Stall cleared for incident_id={incident_id}.','Stall cleared for incident_id={incident_id}.',1),
  ('BUS_STALL_DETECTED',NULL,'OWNER','Bus stall detected for scope={scope_kind}:{scope_owner_id}{:scope_lane_id}.','Bus stall detected for scope={scope_kind}:{scope_owner_id}{:scope_lane_id}.',1),
  ('BUS_STALL_NOT_CLEARED',NULL,'OWNER','Stall NOT cleared for incident_id={incident_id}; manual_required={manual_required}.','Stall NOT cleared for incident_id={incident_id}; manual_required={manual_required}.',1),
  ('CLAIM_RECLAIMED',NULL,'BUS_MESSAGE','TTL reclaim cleared an expired claim for bus_id={bus_id} (claim fields may have been overwritten)','TTL reclaim cleared an expired claim for bus_id={bus_id} (claim fields may have been overwritten)',1),
  ('ECHO_REQUEST_NOT_FOUND','bus.response.echo_request_not_found','BUS_MESSAGE','RESPONSE echo_request_bus_id not found in bus_messages','RESPONSE echo_request_bus_id not found in bus_messages',1),
  ('ENQUEUE_CONSTRAINT_FAILED',NULL,'BUS_MESSAGE','enqueue failed by DB constraint (non-duplicate): bus_id={bus_id}','enqueue failed by DB constraint (non-duplicate): bus_id={bus_id}',1),
  ('ENQUEUE_DUPLICATE',NULL,'BUS_MESSAGE','enqueue ignored because bus_id already exists (idempotent duplicate): bus_id={bus_id}','enqueue ignored because bus_id already exists (idempotent duplicate): bus_id={bus_id}',1),
  ('ENQUEUE_PRECHECK_REJECTED',NULL,'BUS_MESSAGE','enqueue rejected before DB insert by request-local or DB-backed preflight: bus_id={bus_id}','enqueue rejected before DB insert by request-local or DB-backed preflight: bus_id={bus_id}',1),
  ('LANE_MISMATCH',NULL,'BUS_MESSAGE','RESPONSE lane_id does not match REQUEST lane_id referenced by echo_request_bus_id','RESPONSE lane_id does not match REQUEST lane_id referenced by echo_request_bus_id',1),
  ('MISSING_ECHO_REQUEST_BUS_ID',NULL,'BUS_MESSAGE','RESPONSE is missing contentsmetaecho_request_bus_id','RESPONSE is missing contentsmetaecho_request_bus_id',1),
  ('REQUEST_ID_MISMATCH',NULL,'BUS_MESSAGE','RESPONSE request_id does not match REQUEST request_id referenced by echo_request_bus_id','RESPONSE request_id does not match REQUEST request_id referenced by echo_request_bus_id',1);
