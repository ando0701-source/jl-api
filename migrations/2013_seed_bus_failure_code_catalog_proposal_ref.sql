-- 2013_seed_bus_failure_code_catalog_proposal_ref.sql
-- Seed proposal_ref runtime failure-code mappings.
-- Phase1E-2F-6W diagnostic catalog rebuild.
-- Target: Cloudflare D1 (SQLite)

DELETE FROM bus_failure_code_catalog WHERE failure_code IN (
  'proposal_ref_not_found',
  'proposal_ref_target_not_response',
  'proposal_ref_target_op_mismatch',
  'proposal_ref_target_terminal_mismatch',
  'proposal_ref_flow_owner_mismatch',
  'proposal_ref_lane_mismatch',
  'proposal_ref_request_id_mismatch',
  'proposal_ref_origin_request_invalid',
  'proposal_ref_already_consumed'
);

INSERT INTO bus_failure_code_catalog(
  failure_code,finding_code,severity,is_terminal,required_detail_keys,description,enabled
) VALUES
  ('proposal_ref_not_found','bus.proposal_ref.not_found','ERROR',1,'["proposal_ref_bus_id"]','proposal_ref.bus_id does not resolve to an existing bus_messages row',1),
  ('proposal_ref_target_not_response','bus.proposal_ref.target_not_response','ERROR',1,'["proposal_ref_bus_id","target_msg_type"]','proposal_ref.bus_id targets a row that is not a RESPONSE',1),
  ('proposal_ref_target_op_mismatch','bus.proposal_ref.target_op_mismatch','ERROR',1,'["proposal_ref_bus_id","target_op_id"]','proposal_ref.bus_id must target a JL_PROPOSAL response',1),
  ('proposal_ref_target_terminal_mismatch','bus.proposal_ref.target_terminal_mismatch','ERROR',1,'["proposal_ref_bus_id","target_contract_doc_id"]','proposal_ref.bus_id must target the responder PROPOSAL contract doc_id',1),
  ('proposal_ref_flow_owner_mismatch','bus.proposal_ref.flow_owner_mismatch','ERROR',1,'["proposal_ref_bus_id","target_flow_owner_id"]','proposal_ref target flow_owner_id does not match the JL_COMMIT/JL_REJECT request',1),
  ('proposal_ref_lane_mismatch','bus.proposal_ref.lane_mismatch','ERROR',1,'["proposal_ref_bus_id","target_lane_id"]','proposal_ref target lane_id does not match the JL_COMMIT/JL_REJECT request',1),
  ('proposal_ref_request_id_mismatch','bus.proposal_ref.request_id_mismatch','ERROR',1,'["proposal_ref_bus_id","target_request_id"]','proposal_ref target request_id does not match the JL_COMMIT/JL_REJECT request',1),
  ('proposal_ref_origin_request_invalid','bus.proposal_ref.origin_request_invalid','ERROR',1,'["proposal_ref_bus_id"]','proposal_ref target proposal response does not echo a valid same-scope JL_PROPOSAL request',1),
  ('proposal_ref_already_consumed','bus.proposal_ref.already_consumed','ERROR',1,'["proposal_ref_bus_id","consuming_request_bus_id","consumption_stage"]','proposal_ref target has already been consumed by an accepted JL_COMMIT/JL_REJECT request',1);
