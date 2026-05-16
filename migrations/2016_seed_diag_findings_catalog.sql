-- 2016_seed_diag_findings_catalog.sql
-- Seed parent diagnostic findings for runtime failures and executable diagnostic checks.
-- Phase1E-2F-6W diagnostic catalog rebuild.
-- Target: Cloudflare D1 (SQLite)

DELETE FROM diag_findings_catalog WHERE finding_code IN (
  'bus.proposal_ref.not_found',
  'bus.proposal_ref.target_not_response',
  'bus.proposal_ref.target_op_mismatch',
  'bus.proposal_ref.target_terminal_mismatch',
  'bus.proposal_ref.flow_owner_mismatch',
  'bus.proposal_ref.lane_mismatch',
  'bus.proposal_ref.request_id_mismatch',
  'bus.proposal_ref.origin_request_invalid',
  'bus.proposal_ref.already_consumed',
  'bus.response.echo_request_not_found',
  'diag.trigger.expected_ok',
  'diag.catalog.bus_failure.row_count',
  'diag.catalog.bus_failure.proposal_ref_count',
  'diag.catalog.bus_failure.unresolved_observed_code',
  'diag.catalog.metadata.missing',
  'diag.catalog.coverage.unresolved'
);

INSERT INTO diag_findings_catalog(
  finding_code,finding_domain,severity,primary_fix_doc_id,primary_fix_rule_id,target_json_path,effective_recovery_profile,required_detail_keys,description,enabled
) VALUES
  ('bus.proposal_ref.not_found','BUS_FAILURE','ERROR','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_001_PROPOSAL_REF_BUS_ID_EXISTS','$.message.contents.proposal_ref','RETRY_WITH_VALID_PROPOSAL_REF','["proposal_ref_bus_id"]','proposal_ref.bus_id does not resolve to an existing bus_messages row',1),
  ('bus.proposal_ref.target_not_response','BUS_FAILURE','ERROR','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_002_TARGET_IS_RESPONSE','$.message.contents.proposal_ref','RESELECT_PROPOSAL_RESPONSE_TARGET','["proposal_ref_bus_id","target_msg_type"]','proposal_ref.bus_id targets a row that is not a RESPONSE',1),
  ('bus.proposal_ref.target_op_mismatch','BUS_FAILURE','ERROR','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_003_TARGET_OP_IS_JL_PROPOSAL','$.message.contents.proposal_ref','RESELECT_PROPOSAL_RESPONSE_TARGET','["proposal_ref_bus_id","target_op_id"]','proposal_ref.bus_id must target a JL_PROPOSAL response',1),
  ('bus.proposal_ref.target_terminal_mismatch','BUS_FAILURE','ERROR','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_004_TARGET_TERMINAL_IS_PROPOSAL','$.message.contents.proposal_ref','RESTART_FROM_JL_PROPOSAL','["proposal_ref_bus_id","target_contract_doc_id"]','proposal_ref.bus_id must target the responder PROPOSAL contract doc_id',1),
  ('bus.proposal_ref.flow_owner_mismatch','BUS_FAILURE','ERROR','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_005_TARGET_SAME_FLOW_OWNER','$.message.contents.proposal_ref','REPAIR_SCOPE_FLOW_OWNER','["proposal_ref_bus_id","target_flow_owner_id"]','proposal_ref target flow_owner_id does not match the JL_COMMIT/JL_REJECT request',1),
  ('bus.proposal_ref.lane_mismatch','BUS_FAILURE','ERROR','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_006_TARGET_SAME_LANE','$.message.contents.proposal_ref','REPAIR_SCOPE_LANE','["proposal_ref_bus_id","target_lane_id"]','proposal_ref target lane_id does not match the JL_COMMIT/JL_REJECT request',1),
  ('bus.proposal_ref.request_id_mismatch','BUS_FAILURE','ERROR','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_007_TARGET_SAME_REQUEST_ID','$.message.contents.proposal_ref','REPAIR_SCOPE_REQUEST_ID','["proposal_ref_bus_id","target_request_id"]','proposal_ref target request_id does not match the JL_COMMIT/JL_REJECT request',1),
  ('bus.proposal_ref.origin_request_invalid','BUS_FAILURE','ERROR','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_008_TARGET_ECHO_REQUEST_EXISTS','$.message.contents.proposal_ref','REPAIR_ORIGIN_ECHO_OR_RESTART','["proposal_ref_bus_id"]','proposal_ref target proposal response does not echo a valid same-scope JL_PROPOSAL request',1),
  ('bus.proposal_ref.already_consumed','BUS_FAILURE','ERROR','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1B_001_PROPOSAL_ONE_SHOT_CONSUMPTION','$.message.contents.proposal_ref','RESTART_FROM_JL_PROPOSAL','["proposal_ref_bus_id","consuming_request_bus_id","consumption_stage"]','proposal_ref target has already been consumed by an accepted JL_COMMIT/JL_REJECT request',1),
  ('bus.response.echo_request_not_found','BUS_FAILURE','ERROR','2PLT_40_PROTOCOL_FREEZE_PHASE0_ANNEX','PF_RULE_RESPONSE_ECHO_REQUEST_BUS_ID_REQUIRED','$.message.contents.meta.echo_request_bus_id','REPAIR_RESPONSE_ECHO_REQUEST_CORRELATION','["response_bus_id","echo_request_bus_id"]','RESPONSE echo_request_bus_id does not resolve to an existing REQUEST bus_messages row',1),
  ('diag.trigger.expected_ok','DIAG_CHECK','ERROR','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX.diag.trigger.execution.prepared_statements',NULL,'INSPECT_TRIGGER_SMOKE_CASE','[]','A positive trigger smoke check did not pass as expected.',1),
  ('diag.catalog.bus_failure.row_count','DIAG_CHECK','ERROR','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX.diag_findings_catalog.parent_finding',NULL,'REPAIR_DIAGNOSTIC_CATALOG_SEED','[]','bus_failure_code_catalog does not contain the expected minimum row count.',1),
  ('diag.catalog.bus_failure.proposal_ref_count','DIAG_CHECK','ERROR','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX.diag_checks_catalog.expected_values',NULL,'REPAIR_BUS_FAILURE_CODE_CATALOG','[]','proposal_ref failure_code catalog row count is not the expected value.',1),
  ('diag.catalog.bus_failure.unresolved_observed_code','DIAG_CHECK','ERROR','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX.v_diag_results.catalog_resolution',NULL,'REPAIR_BUS_FAILURE_CODE_CATALOG','[]','Observed ENQUEUE_PRECHECK_REJECTED failure codes do not resolve through bus_failure_code_catalog.',1),
  ('diag.catalog.metadata.missing','DIAG_CHECK','ERROR','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX.diag_findings_catalog.parent_finding',NULL,'REPAIR_DIAGNOSTIC_CATALOG_METADATA','[]','Diagnostic catalog metadata is incomplete or invalid.',1),
  ('diag.catalog.coverage.unresolved','DIAG_CHECK','ERROR','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX','2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX.v_diag_results.catalog_resolution',NULL,'REPAIR_BUS_FAILURE_CODE_CATALOG','[]','v_failure_code_catalog_coverage reports unresolved observed failure codes.',1);
