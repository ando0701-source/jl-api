-- 2012_seed_bus_events_catalog_proposal_ref_resolution.sql
-- Seed bus_events_catalog with Phase1A proposal_ref target-resolution derived event codes.
-- Target: Cloudflare D1 (SQLite)

INSERT OR IGNORE INTO bus_events_catalog(
  event_code,severity,default_scope_kind,recovery_profile,
  required_data_keys,optional_data_keys,message_template
) VALUES
  ('PROPOSAL_REF_NOT_FOUND','ERROR','BUS_MESSAGE','RETRY_WITH_VALID_PROPOSAL_REF','[]','["request_bus_id", "request_op_id", "proposal_ref_bus_id", "request_flow_owner_id", "request_lane_id", "request_request_id"]','proposal_ref.bus_id does not resolve to an existing target row'),
  ('PROPOSAL_REF_TARGET_NOT_RESPONSE','ERROR','BUS_MESSAGE','RESELECT_PROPOSAL_RESPONSE_TARGET','[]','["request_bus_id", "request_op_id", "proposal_ref_bus_id", "target_bus_id", "target_msg_type"]','proposal_ref.bus_id targets a row that is not a RESPONSE'),
  ('PROPOSAL_REF_TARGET_OP_MISMATCH','ERROR','BUS_MESSAGE','RESELECT_PROPOSAL_RESPONSE_TARGET','[]','["request_bus_id", "request_op_id", "proposal_ref_bus_id", "target_bus_id", "target_op_id"]','proposal_ref.bus_id must target a JL_PROPOSAL response'),
  ('PROPOSAL_REF_TARGET_TERMINAL_MISMATCH','ERROR','BUS_MESSAGE','RESTART_FROM_JL_PROPOSAL','[]','["request_bus_id", "request_op_id", "proposal_ref_bus_id", "target_bus_id", "target_state", "target_out_state"]','proposal_ref.bus_id must target a JL_PROPOSAL response whose terminal is PROPOSAL'),
  ('PROPOSAL_REF_FLOW_OWNER_MISMATCH','ERROR','BUS_MESSAGE','REPAIR_SCOPE_FLOW_OWNER','[]','["request_bus_id", "request_op_id", "proposal_ref_bus_id", "target_bus_id", "request_flow_owner_id", "target_flow_owner_id"]','proposal_ref target flow_owner_id does not match the JL_COMMIT/JL_REJECT request'),
  ('PROPOSAL_REF_LANE_MISMATCH','ERROR','BUS_MESSAGE','REPAIR_SCOPE_LANE','[]','["request_bus_id", "request_op_id", "proposal_ref_bus_id", "target_bus_id", "request_lane_id", "target_lane_id"]','proposal_ref target lane_id does not match the JL_COMMIT/JL_REJECT request'),
  ('PROPOSAL_REF_REQUEST_ID_MISMATCH','ERROR','BUS_MESSAGE','REPAIR_SCOPE_REQUEST_ID','[]','["request_bus_id", "request_op_id", "proposal_ref_bus_id", "target_bus_id", "request_request_id", "target_request_id"]','proposal_ref target request_id does not match the JL_COMMIT/JL_REJECT request'),
  ('PROPOSAL_REF_ORIGIN_REQUEST_INVALID','ERROR','BUS_MESSAGE','REPAIR_ORIGIN_ECHO_OR_RESTART','[]','["request_bus_id", "request_op_id", "proposal_ref_bus_id", "target_bus_id", "target_echo_request_bus_id", "origin_request_bus_id"]','proposal_ref target proposal response does not echo a valid same-scope JL_PROPOSAL request'),
  ('PROPOSAL_REF_ALREADY_CONSUMED','ERROR','BUS_MESSAGE','RESTART_FROM_JL_PROPOSAL','["consuming_request_bus_id", "consumption_stage"]','["request_bus_id", "request_op_id", "proposal_ref_bus_id", "target_bus_id", "consuming_request_bus_id", "consuming_request_op_id", "consumption_stage"]','proposal_ref target has already been consumed by an accepted JL_COMMIT/JL_REJECT request; Phase1B hard gate');
