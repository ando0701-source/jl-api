-- 2015_seed_diag_checks_catalog_phase1d4.sql
-- Seed /diag expected-value master rows for Phase1A/Phase1B trigger checks and Phase1C scalar checks.
-- Source of truth: 2PLT_40_DIAG_RESULTS_PHASE1D4_ANNEX and HTTP /diag implementation.
-- Target: Cloudflare D1 (SQLite)

DELETE FROM diag_checks_catalog WHERE diag_key IN (
  'phase1a.trigger.P01_valid_target.failure_code',
  'phase1a.trigger.N01_missing_target.failure_code',
  'phase1a.trigger.N02_target_not_response.failure_code',
  'phase1a.trigger.N03_terminal_unresolved.failure_code',
  'phase1a.trigger.N04_terminal_abend.failure_code',
  'phase1a.trigger.N05_lane_mismatch.failure_code',
  'phase1a.trigger.N06_request_id_mismatch.failure_code',
  'phase1a.trigger.N07_flow_owner_mismatch.failure_code',
  'phase1a.trigger.N08_origin_invalid.failure_code',
  'phase1b.trigger.P01_valid_first_consumer.failure_code',
  'phase1b.trigger.N01_already_consumed.failure_code',
  'phase1b.trigger.N02_already_consumed.failure_code',
  'phase1b.trigger.N03_already_consumed.failure_code',
  'phase1b.trigger.N04_already_consumed.failure_code',
  'phase1c.Q01_catalog_count.value',
  'phase1c.Q02_proposal_ref_catalog_count.value',
  'phase1c.Q03_unresolved_observed_failure_codes.value',
  'phase1c.Q04_catalog_detail_missing_metadata_count.value',
  'phase1c.Q05_observed_failure_code_coverage_unresolved_count.value'
);

INSERT INTO diag_checks_catalog(
  diag_key, expected_value, compare_op, severity, source_kind, phase, note
) VALUES
  ('phase1a.trigger.P01_valid_target.failure_code','OK','eq','ERROR','trigger_smoke','PHASE1A','Phase1A positive valid target must pass the D1 trigger hard gate.'),
  ('phase1a.trigger.N01_missing_target.failure_code','proposal_ref_not_found','eq','ERROR','trigger_smoke','PHASE1A','Missing proposal_ref target must be rejected with proposal_ref_not_found.'),
  ('phase1a.trigger.N02_target_not_response.failure_code','proposal_ref_target_not_response','eq','ERROR','trigger_smoke','PHASE1A','Request bus_id target must be rejected as not a response.'),
  ('phase1a.trigger.N03_terminal_unresolved.failure_code','proposal_ref_target_terminal_mismatch','eq','ERROR','trigger_smoke','PHASE1A','UNRESOLVED target terminal must be rejected.'),
  ('phase1a.trigger.N04_terminal_abend.failure_code','proposal_ref_target_terminal_mismatch','eq','ERROR','trigger_smoke','PHASE1A','ABEND target terminal must be rejected.'),
  ('phase1a.trigger.N05_lane_mismatch.failure_code','proposal_ref_lane_mismatch','eq','ERROR','trigger_smoke','PHASE1A','Cross-lane proposal_ref target must be rejected.'),
  ('phase1a.trigger.N06_request_id_mismatch.failure_code','proposal_ref_request_id_mismatch','eq','ERROR','trigger_smoke','PHASE1A','Cross-request proposal_ref target must be rejected.'),
  ('phase1a.trigger.N07_flow_owner_mismatch.failure_code','proposal_ref_flow_owner_mismatch','eq','ERROR','trigger_smoke','PHASE1A','Cross-flow-owner proposal_ref target must be rejected.'),
  ('phase1a.trigger.N08_origin_invalid.failure_code','proposal_ref_origin_request_invalid','eq','ERROR','trigger_smoke','PHASE1A','Orphan proposal response target must be rejected.'),
  ('phase1b.trigger.P01_valid_first_consumer.failure_code','OK','eq','ERROR','trigger_smoke','PHASE1B','First proposal_ref consumer must pass.'),
  ('phase1b.trigger.N01_already_consumed.failure_code','proposal_ref_already_consumed','eq','ERROR','trigger_smoke','PHASE1B','COMMIT followed by COMMIT must be rejected as already consumed.'),
  ('phase1b.trigger.N02_already_consumed.failure_code','proposal_ref_already_consumed','eq','ERROR','trigger_smoke','PHASE1B','COMMIT followed by REJECT must be rejected as already consumed.'),
  ('phase1b.trigger.N03_already_consumed.failure_code','proposal_ref_already_consumed','eq','ERROR','trigger_smoke','PHASE1B','REJECT followed by COMMIT must be rejected as already consumed.'),
  ('phase1b.trigger.N04_already_consumed.failure_code','proposal_ref_already_consumed','eq','ERROR','trigger_smoke','PHASE1B','REJECT followed by REJECT must be rejected as already consumed.'),
  ('phase1c.Q01_catalog_count.value','9','gte','ERROR','scalar_query','PHASE1C','bus_failure_code_catalog row count must be at least 9.'),
  ('phase1c.Q02_proposal_ref_catalog_count.value','9','eq','ERROR','scalar_query','PHASE1C','proposal_ref failure_code catalog row count must be exactly 9.'),
  ('phase1c.Q03_unresolved_observed_failure_codes.value','0','eq','ERROR','scalar_query','PHASE1C','Observed ENQUEUE_PRECHECK_REJECTED failure_code values must resolve to catalog rows.'),
  ('phase1c.Q04_catalog_detail_missing_metadata_count.value','0','eq','ERROR','scalar_query','PHASE1C','Catalog rows must have repair routing metadata and valid required_detail_keys JSON.'),
  ('phase1c.Q05_observed_failure_code_coverage_unresolved_count.value','0','eq','ERROR','scalar_query','PHASE1C','v_failure_code_catalog_coverage must have no unresolved observed failure_code rows.');
