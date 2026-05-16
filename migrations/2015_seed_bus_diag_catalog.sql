-- 2015_seed_bus_diag_catalog.sql
-- Seed executable diagnostic check expectations.
-- Phase1E-2F-6W bus diagnostic catalog rebuild.
-- Target: Cloudflare D1 (SQLite)

DELETE FROM bus_diag_catalog WHERE diag_key IN (
  'phase1a.trigger.N01_missing_target.failure_code',
  'phase1a.trigger.N02_target_not_response.failure_code',
  'phase1a.trigger.N03_terminal_unresolved.failure_code',
  'phase1a.trigger.N04_terminal_abend.failure_code',
  'phase1a.trigger.N05_lane_mismatch.failure_code',
  'phase1a.trigger.N06_request_id_mismatch.failure_code',
  'phase1a.trigger.N07_flow_owner_mismatch.failure_code',
  'phase1a.trigger.N08_origin_invalid.failure_code',
  'phase1a.trigger.P01_valid_target.failure_code',
  'phase1b.trigger.N01_already_consumed.failure_code',
  'phase1b.trigger.N02_already_consumed.failure_code',
  'phase1b.trigger.N03_already_consumed.failure_code',
  'phase1b.trigger.N04_already_consumed.failure_code',
  'phase1b.trigger.P01_valid_first_consumer.failure_code',
  'phase1c.Q01_catalog_count.value',
  'phase1c.Q02_proposal_ref_catalog_count.value',
  'phase1c.Q03_unresolved_observed_failure_codes.value',
  'phase1c.Q04_catalog_detail_missing_metadata_count.value',
  'phase1c.Q05_observed_failure_code_coverage_unresolved_count.value'
);

INSERT INTO bus_diag_catalog(
  diag_key,finding_code,source_kind,expected_value,compare_op,description,enabled
) VALUES
  ('phase1a.trigger.N01_missing_target.failure_code','bus.proposal_ref.not_found','TRIGGER_SMOKE','proposal_ref_not_found','eq','Missing proposal_ref target must be rejected with proposal_ref_not_found.',1),
  ('phase1a.trigger.N02_target_not_response.failure_code','bus.proposal_ref.target_not_response','TRIGGER_SMOKE','proposal_ref_target_not_response','eq','Request bus_id target must be rejected as not a response.',1),
  ('phase1a.trigger.N03_terminal_unresolved.failure_code','bus.proposal_ref.target_terminal_mismatch','TRIGGER_SMOKE','proposal_ref_target_terminal_mismatch','eq','UNRESOLVED target terminal must be rejected.',1),
  ('phase1a.trigger.N04_terminal_abend.failure_code','bus.proposal_ref.target_terminal_mismatch','TRIGGER_SMOKE','proposal_ref_target_terminal_mismatch','eq','ABEND target terminal must be rejected.',1),
  ('phase1a.trigger.N05_lane_mismatch.failure_code','bus.proposal_ref.lane_mismatch','TRIGGER_SMOKE','proposal_ref_lane_mismatch','eq','Cross-lane proposal_ref target must be rejected.',1),
  ('phase1a.trigger.N06_request_id_mismatch.failure_code','bus.proposal_ref.request_id_mismatch','TRIGGER_SMOKE','proposal_ref_request_id_mismatch','eq','Cross-request proposal_ref target must be rejected.',1),
  ('phase1a.trigger.N07_flow_owner_mismatch.failure_code','bus.proposal_ref.flow_owner_mismatch','TRIGGER_SMOKE','proposal_ref_flow_owner_mismatch','eq','Cross-flow-owner proposal_ref target must be rejected.',1),
  ('phase1a.trigger.N08_origin_invalid.failure_code','bus.proposal_ref.origin_request_invalid','TRIGGER_SMOKE','proposal_ref_origin_request_invalid','eq','Orphan proposal response target must be rejected.',1),
  ('phase1a.trigger.P01_valid_target.failure_code','diag.trigger.expected_ok','TRIGGER_SMOKE','OK','eq','Phase1A positive valid target must pass the D1 trigger hard gate.',1),
  ('phase1b.trigger.N01_already_consumed.failure_code','bus.proposal_ref.already_consumed','TRIGGER_SMOKE','proposal_ref_already_consumed','eq','COMMIT followed by COMMIT must be rejected as already consumed.',1),
  ('phase1b.trigger.N02_already_consumed.failure_code','bus.proposal_ref.already_consumed','TRIGGER_SMOKE','proposal_ref_already_consumed','eq','COMMIT followed by REJECT must be rejected as already consumed.',1),
  ('phase1b.trigger.N03_already_consumed.failure_code','bus.proposal_ref.already_consumed','TRIGGER_SMOKE','proposal_ref_already_consumed','eq','REJECT followed by COMMIT must be rejected as already consumed.',1),
  ('phase1b.trigger.N04_already_consumed.failure_code','bus.proposal_ref.already_consumed','TRIGGER_SMOKE','proposal_ref_already_consumed','eq','REJECT followed by REJECT must be rejected as already consumed.',1),
  ('phase1b.trigger.P01_valid_first_consumer.failure_code','diag.trigger.expected_ok','TRIGGER_SMOKE','OK','eq','First proposal_ref consumer must pass.',1),
  ('phase1c.Q01_catalog_count.value','diag.catalog.bus_failure.row_count','SCALAR_QUERY','9','gte','bus_failure_catalog row count must be at least 9.',1),
  ('phase1c.Q02_proposal_ref_catalog_count.value','diag.catalog.bus_failure.proposal_ref_count','SCALAR_QUERY','9','eq','proposal_ref failure_code catalog row count must be exactly 9.',1),
  ('phase1c.Q03_unresolved_observed_failure_codes.value','diag.catalog.bus_failure.unresolved_observed_code','SCALAR_QUERY','0','eq','Observed ENQUEUE_PRECHECK_REJECTED failure_code values must resolve to catalog rows.',1),
  ('phase1c.Q04_catalog_detail_missing_metadata_count.value','diag.catalog.metadata.missing','SCALAR_QUERY','0','eq','Catalog rows must have finding mappings, valid required_detail_keys JSON, and enabled metadata.',1),
  ('phase1c.Q05_observed_failure_code_coverage_unresolved_count.value','diag.catalog.coverage.unresolved','SCALAR_QUERY','0','eq','v_bus_failure_catalog_coverage must have no unresolved observed failure_code rows.',1);
