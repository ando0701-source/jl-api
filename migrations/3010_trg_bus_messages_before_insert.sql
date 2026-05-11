-- 3010_trg_bus_messages_before_insert.sql
-- Canonical INSERT trigger for bus_messages after removing redundant concrete message status fields.
-- Uses doc_id and bus_json content checks instead of message in/out/status columns.
-- Target: Cloudflare D1 (SQLite)

DROP TRIGGER IF EXISTS trg_bus_messages_phase0_insert;

CREATE TRIGGER trg_bus_messages_phase0_insert
BEFORE INSERT ON bus_messages
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'invalid_op_id')
  WHERE NEW.op_id NOT IN ('JL_PROPOSAL','JL_COMMIT','JL_REJECT');

  SELECT RAISE(ABORT, 'invalid_contract_doc_id')
  WHERE COALESCE(TRIM(CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT)), '') = '';

  SELECT RAISE(ABORT, 'invalid_request_contract_doc_id')
  WHERE NEW.msg_type = 'REQUEST'
    AND NOT (
      (NEW.op_id = 'JL_PROPOSAL' AND CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT) = '2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL')
      OR (NEW.op_id = 'JL_COMMIT' AND CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT) = '2PLT_60_IO_CONTRACT_REQUESTER_JL_COMMIT')
      OR (NEW.op_id = 'JL_REJECT' AND CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT) = '2PLT_60_IO_CONTRACT_REQUESTER_JL_REJECT')
    );

  SELECT RAISE(ABORT, 'invalid_response_contract_doc_id')
  WHERE NEW.msg_type = 'RESPONSE'
    AND NOT (
      (NEW.op_id = 'JL_PROPOSAL' AND CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT) IN (
        '2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL',
        '2PLT_60_IO_CONTRACT_RESPONDER_UNRESOLVED_FROM_JL_PROPOSAL',
        '2PLT_60_IO_CONTRACT_RESPONDER_ABEND_FROM_JL_PROPOSAL'
      ))
      OR (NEW.op_id = 'JL_COMMIT' AND CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT) IN (
        '2PLT_60_IO_CONTRACT_RESPONDER_COMMIT',
        '2PLT_60_IO_CONTRACT_RESPONDER_UNRESOLVED_FROM_JL_COMMIT',
        '2PLT_60_IO_CONTRACT_RESPONDER_ABEND_FROM_JL_COMMIT'
      ))
      OR (NEW.op_id = 'JL_REJECT' AND CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT) IN (
        '2PLT_60_IO_CONTRACT_RESPONDER_UNRESOLVED_FROM_JL_REJECT',
        '2PLT_60_IO_CONTRACT_RESPONDER_ABEND_FROM_JL_REJECT'
      ))
    );

  SELECT RAISE(ABORT, 'invalid_proposal_ref')
  WHERE NEW.msg_type = 'REQUEST'
    AND NEW.op_id IN ('JL_COMMIT','JL_REJECT')
    AND (
      COALESCE(TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT)), '') = ''
      OR COALESCE(TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.source_op_id') AS TEXT)), '') <> 'JL_PROPOSAL'
      OR COALESCE(TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.source_terminal') AS TEXT)), '') <> 'PROPOSAL'
      OR COALESCE(TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.resolution_mode') AS TEXT)), '') <> 'EXPLICIT_BUS_ID'
    );

  SELECT RAISE(ABORT, 'proposal_ref_not_found')
  WHERE NEW.msg_type = 'REQUEST'
    AND NEW.op_id IN ('JL_COMMIT','JL_REJECT')
    AND NOT EXISTS (
      SELECT 1
      FROM bus_messages p
      WHERE p.bus_id = TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT))
    );

  SELECT RAISE(ABORT, 'proposal_ref_target_not_response')
  WHERE NEW.msg_type = 'REQUEST'
    AND NEW.op_id IN ('JL_COMMIT','JL_REJECT')
    AND EXISTS (
      SELECT 1
      FROM bus_messages p
      WHERE p.bus_id = TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT))
        AND p.msg_type <> 'RESPONSE'
    );

  SELECT RAISE(ABORT, 'proposal_ref_target_op_mismatch')
  WHERE NEW.msg_type = 'REQUEST'
    AND NEW.op_id IN ('JL_COMMIT','JL_REJECT')
    AND EXISTS (
      SELECT 1
      FROM bus_messages p
      WHERE p.bus_id = TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT))
        AND p.msg_type = 'RESPONSE'
        AND p.op_id <> 'JL_PROPOSAL'
    );

  SELECT RAISE(ABORT, 'proposal_ref_target_terminal_mismatch')
  WHERE NEW.msg_type = 'REQUEST'
    AND NEW.op_id IN ('JL_COMMIT','JL_REJECT')
    AND EXISTS (
      SELECT 1
      FROM bus_messages p
      WHERE p.bus_id = TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT))
        AND p.msg_type = 'RESPONSE'
        AND p.op_id = 'JL_PROPOSAL'
        AND CAST(json_extract(p.bus_json, '$.doc_id') AS TEXT) <> '2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL'
    );

  SELECT RAISE(ABORT, 'proposal_ref_flow_owner_mismatch')
  WHERE NEW.msg_type = 'REQUEST'
    AND NEW.op_id IN ('JL_COMMIT','JL_REJECT')
    AND EXISTS (
      SELECT 1
      FROM bus_messages p
      WHERE p.bus_id = TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT))
        AND p.msg_type = 'RESPONSE'
        AND p.op_id = 'JL_PROPOSAL'
        AND CAST(json_extract(p.bus_json, '$.doc_id') AS TEXT) = '2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL'
        AND p.flow_owner_id <> NEW.flow_owner_id
    );

  SELECT RAISE(ABORT, 'proposal_ref_lane_mismatch')
  WHERE NEW.msg_type = 'REQUEST'
    AND NEW.op_id IN ('JL_COMMIT','JL_REJECT')
    AND EXISTS (
      SELECT 1
      FROM bus_messages p
      WHERE p.bus_id = TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT))
        AND p.msg_type = 'RESPONSE'
        AND p.op_id = 'JL_PROPOSAL'
        AND CAST(json_extract(p.bus_json, '$.doc_id') AS TEXT) = '2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL'
        AND p.flow_owner_id = NEW.flow_owner_id
        AND p.lane_id <> NEW.lane_id
    );

  SELECT RAISE(ABORT, 'proposal_ref_request_id_mismatch')
  WHERE NEW.msg_type = 'REQUEST'
    AND NEW.op_id IN ('JL_COMMIT','JL_REJECT')
    AND EXISTS (
      SELECT 1
      FROM bus_messages p
      WHERE p.bus_id = TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT))
        AND p.msg_type = 'RESPONSE'
        AND p.op_id = 'JL_PROPOSAL'
        AND CAST(json_extract(p.bus_json, '$.doc_id') AS TEXT) = '2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL'
        AND p.flow_owner_id = NEW.flow_owner_id
        AND p.lane_id = NEW.lane_id
        AND p.request_id <> NEW.request_id
    );

  SELECT RAISE(ABORT, 'proposal_ref_origin_request_invalid')
  WHERE NEW.msg_type = 'REQUEST'
    AND NEW.op_id IN ('JL_COMMIT','JL_REJECT')
    AND EXISTS (
      SELECT 1
      FROM bus_messages p
      LEFT JOIN bus_messages q
        ON q.bus_id = CAST(json_extract(p.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT)
      WHERE p.bus_id = TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT))
        AND p.msg_type = 'RESPONSE'
        AND p.op_id = 'JL_PROPOSAL'
        AND CAST(json_extract(p.bus_json, '$.doc_id') AS TEXT) = '2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL'
        AND p.flow_owner_id = NEW.flow_owner_id
        AND p.lane_id = NEW.lane_id
        AND p.request_id = NEW.request_id
        AND (
          COALESCE(TRIM(CAST(json_extract(p.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT)), '') = ''
          OR q.bus_id IS NULL
          OR q.msg_type <> 'REQUEST'
          OR q.op_id <> 'JL_PROPOSAL'
          OR CAST(json_extract(q.bus_json, '$.doc_id') AS TEXT) <> '2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL'
          OR q.flow_owner_id <> NEW.flow_owner_id
          OR q.lane_id <> NEW.lane_id
          OR q.request_id <> NEW.request_id
        )
    );

  SELECT RAISE(ABORT, 'proposal_ref_already_consumed')
  WHERE NEW.msg_type = 'REQUEST'
    AND NEW.op_id IN ('JL_COMMIT','JL_REJECT')
    AND EXISTS (
      SELECT 1
      FROM bus_messages prior_req
      WHERE prior_req.msg_type = 'REQUEST'
        AND prior_req.op_id IN ('JL_COMMIT','JL_REJECT')
        AND prior_req.bus_id <> NEW.bus_id
        AND TRIM(CAST(json_extract(prior_req.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT)) = TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT))
    );

  SELECT RAISE(ABORT, 'missing_echo_request_bus_id')
  WHERE NEW.msg_type = 'RESPONSE'
    AND COALESCE(TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT)), '') = '';

  SELECT RAISE(ABORT, 'invalid_profile_doc_id')
  WHERE json_extract(NEW.bus_json, '$.message.contents.profile_doc_id') IS NOT NULL
    AND (
      (NEW.op_id = 'JL_PROPOSAL' AND json_extract(NEW.bus_json, '$.message.contents.profile_doc_id') <> '2PLT_50_PROFILE_JUDGEMENT_LOG_PROPOSAL')
      OR (NEW.op_id = 'JL_COMMIT' AND json_extract(NEW.bus_json, '$.message.contents.profile_doc_id') <> '2PLT_50_PROFILE_JUDGEMENT_LOG_COMMIT')
      OR (NEW.op_id = 'JL_REJECT' AND json_extract(NEW.bus_json, '$.message.contents.profile_doc_id') <> '2PLT_50_PROFILE_JUDGEMENT_LOG_REJECT')
    );

  SELECT RAISE(ABORT, 'invalid_recommended_next_profile_doc_id')
  WHERE json_extract(NEW.bus_json, '$.message.contents.recommended_next_profile_doc_id') IS NOT NULL
    AND json_extract(NEW.bus_json, '$.message.contents.recommended_next_profile_doc_id') NOT IN (
      '2PLT_50_PROFILE_JUDGEMENT_LOG_PROPOSAL',
      '2PLT_50_PROFILE_JUDGEMENT_LOG_COMMIT',
      '2PLT_50_PROFILE_JUDGEMENT_LOG_REJECT'
    );

  SELECT RAISE(ABORT, 'invalid_request_payload')
  WHERE NEW.msg_type = 'REQUEST'
    AND NEW.op_id = 'JL_PROPOSAL'
    AND (
      COALESCE((json_type(NEW.bus_json, '$.message.contents.ops') = 'array' AND json_array_length(json_extract(NEW.bus_json, '$.message.contents.ops')) > 0), 0)
      OR COALESCE((json_type(NEW.bus_json, '$.message.contents.patch_intent') = 'array' AND json_array_length(json_extract(NEW.bus_json, '$.message.contents.patch_intent')) > 0), 0)
    ) = 0;

  SELECT RAISE(ABORT, 'invalid_response_payload')
  WHERE NEW.msg_type = 'RESPONSE'
    AND (
      (CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT) = '2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL'
        AND COALESCE((json_type(NEW.bus_json, '$.message.contents.ops') = 'array' AND json_array_length(json_extract(NEW.bus_json, '$.message.contents.ops')) > 0), 0) = 0)
      OR (CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT) = '2PLT_60_IO_CONTRACT_RESPONDER_COMMIT'
        AND json_type(NEW.bus_json, '$.message.contents.result') IS NULL)
      OR (CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT) LIKE '%_UNRESOLVED_%'
        AND COALESCE((json_type(NEW.bus_json, '$.message.contents.required_to_resolve') = 'array' AND json_array_length(json_extract(NEW.bus_json, '$.message.contents.required_to_resolve')) > 0), 0) = 0)
      OR (CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT) LIKE '%_ABEND_%'
        AND COALESCE(TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.reason_code') AS TEXT)), '') = '')
    );

  SELECT RAISE(ABORT, 'invalid_artifact_completion')
  WHERE NEW.msg_type = 'RESPONSE'
    AND CAST(json_extract(NEW.bus_json, '$.doc_id') AS TEXT) <> '2PLT_60_IO_CONTRACT_RESPONDER_COMMIT'
    AND json_type(NEW.bus_json, '$.message.contents.result') IS NOT NULL;
END;
