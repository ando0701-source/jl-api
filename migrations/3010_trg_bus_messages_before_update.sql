-- 3010_trg_bus_messages_before_update.sql
-- Canonical UPDATE trigger for bus_messages Phase-0 protocol guard.
-- Uses the 3010 bus_messages trigger-family prefix while keeping one-trigger-per-file governance.

DROP TRIGGER IF EXISTS trg_bus_messages_phase0_update;

CREATE TRIGGER trg_bus_messages_phase0_update
BEFORE UPDATE OF msg_type, op_id, in_state, state, out_state, bus_json ON bus_messages
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'invalid_op_id')
  WHERE NEW.op_id NOT IN ('JL_PROPOSAL','JL_COMMIT','JL_REJECT');

  SELECT RAISE(ABORT, 'invalid_request_op_in_state')
  WHERE NEW.msg_type = 'REQUEST'
    AND NOT (
      (NEW.op_id = 'JL_PROPOSAL' AND NEW.in_state = 'NUL')
      OR (NEW.op_id = 'JL_COMMIT' AND NEW.in_state = 'PROPOSAL')
      OR (NEW.op_id = 'JL_REJECT' AND NEW.in_state = 'PROPOSAL')
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

  SELECT RAISE(ABORT, 'invalid_response_terminal')
  WHERE NEW.msg_type = 'RESPONSE'
    AND NOT (
      (NEW.op_id = 'JL_PROPOSAL' AND NEW.in_state = 'NUL' AND NEW.state IN ('PROPOSAL','UNRESOLVED','ABEND') AND NEW.out_state = NEW.state)
      OR (NEW.op_id = 'JL_COMMIT' AND NEW.in_state = 'PROPOSAL' AND NEW.state IN ('COMMIT','UNRESOLVED','ABEND') AND NEW.out_state = NEW.state)
      OR (NEW.op_id = 'JL_REJECT' AND NEW.in_state = 'PROPOSAL' AND NEW.state IN ('UNRESOLVED','ABEND') AND NEW.out_state = NEW.state)
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
      (NEW.state = 'PROPOSAL' AND COALESCE((json_type(NEW.bus_json, '$.message.contents.ops') = 'array' AND json_array_length(json_extract(NEW.bus_json, '$.message.contents.ops')) > 0), 0) = 0)
      OR (NEW.state = 'COMMIT' AND json_type(NEW.bus_json, '$.message.contents.result') IS NULL)
      OR (NEW.state = 'UNRESOLVED' AND COALESCE((json_type(NEW.bus_json, '$.message.contents.required_to_resolve') = 'array' AND json_array_length(json_extract(NEW.bus_json, '$.message.contents.required_to_resolve')) > 0), 0) = 0)
      OR (NEW.state = 'ABEND' AND COALESCE(TRIM(CAST(json_extract(NEW.bus_json, '$.message.contents.reason_code') AS TEXT)), '') = '')
    );

  SELECT RAISE(ABORT, 'invalid_artifact_completion')
  WHERE NEW.msg_type = 'RESPONSE'
    AND NEW.state <> 'COMMIT'
    AND json_type(NEW.bus_json, '$.message.contents.result') IS NOT NULL;
END;
