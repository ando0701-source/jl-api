-- 2013_seed_bus_failure_code_catalog_proposal_ref.sql
-- Seed Phase1C bus_failure_code_catalog with proposal_ref preflight failure codes.
-- Source of truth: 2PLT_40_FAILURE_CODE_CATALOG_ANNEX + vocab.tsv preview rows.
-- Target: Cloudflare D1 (SQLite)

DELETE FROM bus_failure_code_catalog where failure_code in (
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

INSERT OR IGNORE INTO bus_failure_code_catalog(
  failure_code,severity,effective_recovery_profile,default_scope_kind,
  primary_doc_id,primary_fix_doc_id,primary_fix_rule_id,detect_rule_id,verify_query_id,
  required_detail_keys,optional_detail_keys,phase_introduced,is_terminal,message_template,notes
) VALUES
  ('proposal_ref_not_found','ERROR','RETRY_WITH_VALID_PROPOSAL_REF','BUS_MESSAGE','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_001_PROPOSAL_REF_BUS_ID_EXISTS','AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED',NULL,'["proposal_ref_bus_id"]','["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]','PHASE1A',1,'proposal_ref.bus_id does not resolve to an existing bus_messages row','Target request must be retried with an existing JL_PROPOSAL/PROPOSAL response bus_id.'),
  ('proposal_ref_target_not_response','ERROR','RESELECT_PROPOSAL_RESPONSE_TARGET','BUS_MESSAGE','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_002_TARGET_IS_RESPONSE','AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED',NULL,'["proposal_ref_bus_id", "target_msg_type"]','["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]','PHASE1A',1,'proposal_ref.bus_id targets a row that is not a RESPONSE','The caller likely used a JL_PROPOSAL request bus_id instead of the Worker PROPOSAL response bus_id.'),
  ('proposal_ref_target_op_mismatch','ERROR','RESELECT_PROPOSAL_RESPONSE_TARGET','BUS_MESSAGE','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_003_TARGET_OP_IS_JL_PROPOSAL','AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED',NULL,'["proposal_ref_bus_id", "target_op_id"]','["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]','PHASE1A',1,'proposal_ref.bus_id must target a JL_PROPOSAL response','The target row exists but belongs to the wrong operation family.'),
  ('proposal_ref_target_terminal_mismatch','ERROR','RESTART_FROM_JL_PROPOSAL','BUS_MESSAGE','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_004_TARGET_TERMINAL_IS_PROPOSAL','AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED',NULL,'["proposal_ref_bus_id", "target_contract_doc_id"]','["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]','PHASE1A',1,'proposal_ref.bus_id must target a JL_PROPOSAL response whose contract doc_id is 2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL','A JL_PROPOSAL response using a non-PROPOSAL response contract cannot be committed or rejected.'),
  ('proposal_ref_flow_owner_mismatch','ERROR','REPAIR_SCOPE_FLOW_OWNER','BUS_MESSAGE','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_005_TARGET_SAME_FLOW_OWNER','AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED',NULL,'["proposal_ref_bus_id", "target_flow_owner_id"]','["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]','PHASE1A',1,'proposal_ref target flow_owner_id does not match the JL_COMMIT/JL_REJECT request','Repair the request scope or restart JL_PROPOSAL in the intended flow.'),
  ('proposal_ref_lane_mismatch','ERROR','REPAIR_SCOPE_LANE','BUS_MESSAGE','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_006_TARGET_SAME_LANE','AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED',NULL,'["proposal_ref_bus_id", "target_lane_id"]','["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]','PHASE1A',1,'proposal_ref target lane_id does not match the JL_COMMIT/JL_REJECT request','Repair the lane_id or restart JL_PROPOSAL in the intended lane.'),
  ('proposal_ref_request_id_mismatch','ERROR','REPAIR_SCOPE_REQUEST_ID','BUS_MESSAGE','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_007_TARGET_SAME_REQUEST_ID','AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED',NULL,'["proposal_ref_bus_id", "target_request_id"]','["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]','PHASE1A',1,'proposal_ref target request_id does not match the JL_COMMIT/JL_REJECT request','Repair request_id or restart JL_PROPOSAL for the target request.'),
  ('proposal_ref_origin_request_invalid','ERROR','REPAIR_ORIGIN_ECHO_OR_RESTART','BUS_MESSAGE','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1A_008_TARGET_ECHOES_VALID_ORIGIN_REQUEST','AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED',NULL,'["proposal_ref_bus_id"]','["echo_request_bus_id", "origin_found", "origin_msg_type", "origin_op_id", "origin_flow_owner_id", "origin_lane_id", "origin_request_id"]','PHASE1A',1,'proposal_ref target proposal response does not echo a valid same-scope JL_PROPOSAL request','Target proposal response is orphaned or its echo_request_bus_id points to an invalid origin request.'),
  ('proposal_ref_already_consumed','ERROR','RESTART_FROM_JL_PROPOSAL','BUS_MESSAGE','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX','TR_P1B_001_PROPOSAL_REF_ONE_SHOT_CONSUMPTION','AUDIT_CHECK_E20_PROPOSAL_REF_ALREADY_CONSUMED',NULL,'["proposal_ref_bus_id", "consuming_request_bus_id", "consumption_stage"]','["consuming_request_op_id", "consuming_request_flow_owner_id", "consuming_request_lane_id", "consuming_request_request_id"]','PHASE1B',1,'proposal_ref target has already been consumed by an accepted JL_COMMIT/JL_REJECT request','Phase1B one-shot consumption prevents double commit/reject of the same proposal response.');

UPDATE bus_failure_code_catalog SET
  severity='ERROR', effective_recovery_profile='RETRY_WITH_VALID_PROPOSAL_REF', default_scope_kind='BUS_MESSAGE',
  primary_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_rule_id='TR_P1A_001_PROPOSAL_REF_BUS_ID_EXISTS', detect_rule_id='AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED', verify_query_id=NULL,
  required_detail_keys='["proposal_ref_bus_id"]', optional_detail_keys='["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]', phase_introduced='PHASE1A', is_terminal=1,
  message_template='proposal_ref.bus_id does not resolve to an existing bus_messages row', notes='Target request must be retried with an existing JL_PROPOSAL/PROPOSAL response bus_id.'
WHERE failure_code='proposal_ref_not_found';

UPDATE bus_failure_code_catalog SET
  severity='ERROR', effective_recovery_profile='RESELECT_PROPOSAL_RESPONSE_TARGET', default_scope_kind='BUS_MESSAGE',
  primary_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_rule_id='TR_P1A_002_TARGET_IS_RESPONSE', detect_rule_id='AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED', verify_query_id=NULL,
  required_detail_keys='["proposal_ref_bus_id", "target_msg_type"]', optional_detail_keys='["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]', phase_introduced='PHASE1A', is_terminal=1,
  message_template='proposal_ref.bus_id targets a row that is not a RESPONSE', notes='The caller likely used a JL_PROPOSAL request bus_id instead of the Worker PROPOSAL response bus_id.'
WHERE failure_code='proposal_ref_target_not_response';

UPDATE bus_failure_code_catalog SET
  severity='ERROR', effective_recovery_profile='RESELECT_PROPOSAL_RESPONSE_TARGET', default_scope_kind='BUS_MESSAGE',
  primary_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_rule_id='TR_P1A_003_TARGET_OP_IS_JL_PROPOSAL', detect_rule_id='AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED', verify_query_id=NULL,
  required_detail_keys='["proposal_ref_bus_id", "target_op_id"]', optional_detail_keys='["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]', phase_introduced='PHASE1A', is_terminal=1,
  message_template='proposal_ref.bus_id must target a JL_PROPOSAL response', notes='The target row exists but belongs to the wrong operation family.'
WHERE failure_code='proposal_ref_target_op_mismatch';

UPDATE bus_failure_code_catalog SET
  severity='ERROR', effective_recovery_profile='RESTART_FROM_JL_PROPOSAL', default_scope_kind='BUS_MESSAGE',
  primary_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_rule_id='TR_P1A_004_TARGET_TERMINAL_IS_PROPOSAL', detect_rule_id='AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED', verify_query_id=NULL,
  required_detail_keys='["proposal_ref_bus_id", "target_contract_doc_id"]', optional_detail_keys='["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]', phase_introduced='PHASE1A', is_terminal=1,
  message_template='proposal_ref.bus_id must target a JL_PROPOSAL response whose contract doc_id is 2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL', notes='A JL_PROPOSAL response using a non-PROPOSAL response contract cannot be committed or rejected.'
WHERE failure_code='proposal_ref_target_terminal_mismatch';

UPDATE bus_failure_code_catalog SET
  severity='ERROR', effective_recovery_profile='REPAIR_SCOPE_FLOW_OWNER', default_scope_kind='BUS_MESSAGE',
  primary_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_rule_id='TR_P1A_005_TARGET_SAME_FLOW_OWNER', detect_rule_id='AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED', verify_query_id=NULL,
  required_detail_keys='["proposal_ref_bus_id", "target_flow_owner_id"]', optional_detail_keys='["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]', phase_introduced='PHASE1A', is_terminal=1,
  message_template='proposal_ref target flow_owner_id does not match the JL_COMMIT/JL_REJECT request', notes='Repair the request scope or restart JL_PROPOSAL in the intended flow.'
WHERE failure_code='proposal_ref_flow_owner_mismatch';

UPDATE bus_failure_code_catalog SET
  severity='ERROR', effective_recovery_profile='REPAIR_SCOPE_LANE', default_scope_kind='BUS_MESSAGE',
  primary_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_rule_id='TR_P1A_006_TARGET_SAME_LANE', detect_rule_id='AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED', verify_query_id=NULL,
  required_detail_keys='["proposal_ref_bus_id", "target_lane_id"]', optional_detail_keys='["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]', phase_introduced='PHASE1A', is_terminal=1,
  message_template='proposal_ref target lane_id does not match the JL_COMMIT/JL_REJECT request', notes='Repair the lane_id or restart JL_PROPOSAL in the intended lane.'
WHERE failure_code='proposal_ref_lane_mismatch';

UPDATE bus_failure_code_catalog SET
  severity='ERROR', effective_recovery_profile='REPAIR_SCOPE_REQUEST_ID', default_scope_kind='BUS_MESSAGE',
  primary_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_rule_id='TR_P1A_007_TARGET_SAME_REQUEST_ID', detect_rule_id='AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED', verify_query_id=NULL,
  required_detail_keys='["proposal_ref_bus_id", "target_request_id"]', optional_detail_keys='["bus_id", "op_id", "flow_owner_id", "lane_id", "request_id"]', phase_introduced='PHASE1A', is_terminal=1,
  message_template='proposal_ref target request_id does not match the JL_COMMIT/JL_REJECT request', notes='Repair request_id or restart JL_PROPOSAL for the target request.'
WHERE failure_code='proposal_ref_request_id_mismatch';

UPDATE bus_failure_code_catalog SET
  severity='ERROR', effective_recovery_profile='REPAIR_ORIGIN_ECHO_OR_RESTART', default_scope_kind='BUS_MESSAGE',
  primary_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_rule_id='TR_P1A_008_TARGET_ECHOES_VALID_ORIGIN_REQUEST', detect_rule_id='AUDIT_CHECK_E10_ENQUEUE_PRECHECK_REJECTED', verify_query_id=NULL,
  required_detail_keys='["proposal_ref_bus_id"]', optional_detail_keys='["echo_request_bus_id", "origin_found", "origin_msg_type", "origin_op_id", "origin_flow_owner_id", "origin_lane_id", "origin_request_id"]', phase_introduced='PHASE1A', is_terminal=1,
  message_template='proposal_ref target proposal response does not echo a valid same-scope JL_PROPOSAL request', notes='Target proposal response is orphaned or its echo_request_bus_id points to an invalid origin request.'
WHERE failure_code='proposal_ref_origin_request_invalid';

UPDATE bus_failure_code_catalog SET
  severity='ERROR', effective_recovery_profile='RESTART_FROM_JL_PROPOSAL', default_scope_kind='BUS_MESSAGE',
  primary_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_doc_id='2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX', primary_fix_rule_id='TR_P1B_001_PROPOSAL_REF_ONE_SHOT_CONSUMPTION', detect_rule_id='AUDIT_CHECK_E20_PROPOSAL_REF_ALREADY_CONSUMED', verify_query_id=NULL,
  required_detail_keys='["proposal_ref_bus_id", "consuming_request_bus_id", "consumption_stage"]', optional_detail_keys='["consuming_request_op_id", "consuming_request_flow_owner_id", "consuming_request_lane_id", "consuming_request_request_id"]', phase_introduced='PHASE1B', is_terminal=1,
  message_template='proposal_ref target has already been consumed by an accepted JL_COMMIT/JL_REJECT request', notes='Phase1B one-shot consumption prevents double commit/reject of the same proposal response.'
WHERE failure_code='proposal_ref_already_consumed';
