// Phase1C failure_code literals.
// Canonical metadata is persisted in bus_failure_code_catalog.
// Keep these literals aligned with 2013_seed_bus_failure_code_catalog_proposal_ref.sql
// until vocab-driven generation is introduced.

export const FAILURE_CODES = {
  PROPOSAL_REF_NOT_FOUND: "proposal_ref_not_found",
  PROPOSAL_REF_TARGET_NOT_RESPONSE: "proposal_ref_target_not_response",
  PROPOSAL_REF_TARGET_OP_MISMATCH: "proposal_ref_target_op_mismatch",
  PROPOSAL_REF_TARGET_TERMINAL_MISMATCH: "proposal_ref_target_terminal_mismatch",
  PROPOSAL_REF_FLOW_OWNER_MISMATCH: "proposal_ref_flow_owner_mismatch",
  PROPOSAL_REF_LANE_MISMATCH: "proposal_ref_lane_mismatch",
  PROPOSAL_REF_REQUEST_ID_MISMATCH: "proposal_ref_request_id_mismatch",
  PROPOSAL_REF_ORIGIN_REQUEST_INVALID: "proposal_ref_origin_request_invalid",
  PROPOSAL_REF_ALREADY_CONSUMED: "proposal_ref_already_consumed",
} as const;

export type FailureCode = typeof FAILURE_CODES[keyof typeof FAILURE_CODES];
