-- 2012_seed_bus_events_catalog_proposal_ref_resolution.sql
-- Seed bus_events_catalog event-code metadata.
-- Target: Cloudflare D1 (SQLite)

DELETE FROM bus_events_catalog WHERE event_code IN (
  'PROPOSAL_REF_NOT_FOUND',
  'PROPOSAL_REF_TARGET_NOT_RESPONSE',
  'PROPOSAL_REF_TARGET_OP_MISMATCH',
  'PROPOSAL_REF_TARGET_TERMINAL_MISMATCH',
  'PROPOSAL_REF_FLOW_OWNER_MISMATCH',
  'PROPOSAL_REF_LANE_MISMATCH',
  'PROPOSAL_REF_REQUEST_ID_MISMATCH',
  'PROPOSAL_REF_ORIGIN_REQUEST_INVALID',
  'PROPOSAL_REF_ALREADY_CONSUMED'
);

INSERT OR IGNORE INTO bus_events_catalog(
  event_code,finding_code,event_scope,event_message_template,description,enabled
) VALUES
  ('PROPOSAL_REF_ALREADY_CONSUMED',NULL,'BUS_MESSAGE','proposal_ref target has already been consumed by an accepted JL_COMMIT/JL_REJECT request; Phase1B hard gate','proposal_ref target has already been consumed by an accepted JL_COMMIT/JL_REJECT request; Phase1B hard gate',1),
  ('PROPOSAL_REF_FLOW_OWNER_MISMATCH',NULL,'BUS_MESSAGE','proposal_ref target flow_owner_id does not match the JL_COMMIT/JL_REJECT request','proposal_ref target flow_owner_id does not match the JL_COMMIT/JL_REJECT request',1),
  ('PROPOSAL_REF_LANE_MISMATCH',NULL,'BUS_MESSAGE','proposal_ref target lane_id does not match the JL_COMMIT/JL_REJECT request','proposal_ref target lane_id does not match the JL_COMMIT/JL_REJECT request',1),
  ('PROPOSAL_REF_NOT_FOUND',NULL,'BUS_MESSAGE','proposal_ref.bus_id does not resolve to an existing target row','proposal_ref.bus_id does not resolve to an existing target row',1),
  ('PROPOSAL_REF_ORIGIN_REQUEST_INVALID',NULL,'BUS_MESSAGE','proposal_ref target proposal response does not echo a valid same-scope JL_PROPOSAL request','proposal_ref target proposal response does not echo a valid same-scope JL_PROPOSAL request',1),
  ('PROPOSAL_REF_REQUEST_ID_MISMATCH',NULL,'BUS_MESSAGE','proposal_ref target request_id does not match the JL_COMMIT/JL_REJECT request','proposal_ref target request_id does not match the JL_COMMIT/JL_REJECT request',1),
  ('PROPOSAL_REF_TARGET_NOT_RESPONSE',NULL,'BUS_MESSAGE','proposal_ref.bus_id targets a row that is not a RESPONSE','proposal_ref.bus_id targets a row that is not a RESPONSE',1),
  ('PROPOSAL_REF_TARGET_OP_MISMATCH',NULL,'BUS_MESSAGE','proposal_ref.bus_id must target a JL_PROPOSAL response','proposal_ref.bus_id must target a JL_PROPOSAL response',1),
  ('PROPOSAL_REF_TARGET_TERMINAL_MISMATCH',NULL,'BUS_MESSAGE','proposal_ref.bus_id must target a JL_PROPOSAL response whose contract doc_id is 2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL','proposal_ref.bus_id must target a JL_PROPOSAL response whose contract doc_id is 2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL',1);
