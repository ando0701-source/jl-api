-- 1004_v_proposal_ref_resolution.sql
-- Optional diagnostic view: resolve JL_COMMIT/JL_REJECT REQUEST.contents.proposal.source_bus_id
-- to the target JL_PROPOSAL/PROPOSAL RESPONSE, echoed origin REQUEST, and Phase1B one-shot consumption status.
-- One object per migration file: v_proposal_ref_resolution.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_proposal_ref_resolution;

CREATE VIEW IF NOT EXISTS v_proposal_ref_resolution AS
SELECT
  r.bus_id AS request_bus_id,
  r.bus_ts AS request_bus_ts,
  r.from_owner_id AS request_from_owner_id,
  r.to_owner_id AS request_to_owner_id,
  r.op_id AS request_op_id,
  r.flow_owner_id AS request_flow_owner_id,
  r.lane_id AS request_lane_id,
  r.request_id AS request_request_id,
  CAST(json_extract(r.bus_json, '$.message.contents.proposal.source_bus_id') AS TEXT) AS proposal_ref_bus_id,
  CAST(json_extract(r.bus_json, '$.message.contents.proposal.io_contract_doc_id') AS TEXT) AS proposal_ref_source_op_id,
  CAST(json_extract(r.bus_json, '$.message.contents.proposal.source_terminal') AS TEXT) AS proposal_ref_source_terminal,
  CAST(json_extract(r.bus_json, '$.message.contents.proposal.source_block_name') AS TEXT) AS proposal_ref_resolution_mode,

  p.bus_id AS target_bus_id,
  p.bus_ts AS target_bus_ts,
  p.msg_type AS target_msg_type,
  p.op_id AS target_op_id,
  CAST(json_extract(p.bus_json, '$.doc_id') AS TEXT) AS target_contract_doc_id,
  p.flow_owner_id AS target_flow_owner_id,
  p.lane_id AS target_lane_id,
  p.request_id AS target_request_id,
  CAST(json_extract(p.bus_json, '$.message.contents.make_proposal.source_bus_id') AS TEXT) AS target_request_source_bus_id,

  q.bus_id AS origin_request_bus_id,
  q.msg_type AS origin_msg_type,
  q.op_id AS origin_op_id,
  CAST(json_extract(q.bus_json, '$.doc_id') AS TEXT) AS origin_contract_doc_id,
  q.flow_owner_id AS origin_flow_owner_id,
  q.lane_id AS origin_lane_id,
  q.request_id AS origin_request_id,

  c.bus_id AS consuming_request_bus_id,
  c.bus_ts AS consuming_request_bus_ts,
  c.op_id AS consuming_request_op_id,
  c.flow_owner_id AS consuming_request_flow_owner_id,
  c.lane_id AS consuming_request_lane_id,
  c.request_id AS consuming_request_request_id,
  CASE WHEN c.bus_id IS NULL THEN NULL ELSE 'ACCEPTED_TARGET_REQUEST' END AS consumption_stage,

  CASE
    WHEN COALESCE(TRIM(CAST(json_extract(r.bus_json, '$.message.contents.proposal.source_bus_id') AS TEXT)), '') = '' THEN 'PROPOSAL_REF_NOT_FOUND'
    WHEN p.bus_id IS NULL THEN 'PROPOSAL_REF_NOT_FOUND'
    WHEN p.msg_type <> 'RESPONSE' THEN 'PROPOSAL_REF_TARGET_NOT_RESPONSE'
    WHEN p.op_id <> 'JL_PROPOSAL' THEN 'PROPOSAL_REF_TARGET_OP_MISMATCH'
    WHEN CAST(json_extract(p.bus_json, '$.doc_id') AS TEXT) <> '2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL' THEN 'PROPOSAL_REF_TARGET_TERMINAL_MISMATCH'
    WHEN p.flow_owner_id <> r.flow_owner_id THEN 'PROPOSAL_REF_FLOW_OWNER_MISMATCH'
    WHEN p.lane_id <> r.lane_id THEN 'PROPOSAL_REF_LANE_MISMATCH'
    WHEN p.request_id <> r.request_id THEN 'PROPOSAL_REF_REQUEST_ID_MISMATCH'
    WHEN COALESCE(TRIM(CAST(json_extract(p.bus_json, '$.message.contents.make_proposal.source_bus_id') AS TEXT)), '') = '' THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.bus_id IS NULL THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.msg_type <> 'REQUEST' THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.op_id <> 'JL_PROPOSAL' THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN CAST(json_extract(q.bus_json, '$.doc_id') AS TEXT) <> '2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL' THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.flow_owner_id <> r.flow_owner_id THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.lane_id <> r.lane_id THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.request_id <> r.request_id THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN c.bus_id IS NOT NULL THEN 'PROPOSAL_REF_ALREADY_CONSUMED'
    ELSE 'OK'
  END AS resolution_status

FROM bus_messages r
LEFT JOIN bus_messages p
  ON p.bus_id = CAST(json_extract(r.bus_json, '$.message.contents.proposal.source_bus_id') AS TEXT)
LEFT JOIN bus_messages q
  ON q.bus_id = CAST(json_extract(p.bus_json, '$.message.contents.make_proposal.source_bus_id') AS TEXT)
LEFT JOIN bus_messages c
  ON c.bus_id = (
    SELECT prior_req.bus_id
    FROM bus_messages prior_req
    WHERE prior_req.msg_type = 'REQUEST'
      AND prior_req.op_id IN ('JL_COMMIT','JL_REJECT')
      AND prior_req.bus_id <> r.bus_id
      AND TRIM(CAST(json_extract(prior_req.bus_json, '$.message.contents.proposal.source_bus_id') AS TEXT)) = TRIM(CAST(json_extract(r.bus_json, '$.message.contents.proposal.source_bus_id') AS TEXT))
    ORDER BY prior_req.bus_ts ASC, prior_req.inserted_at ASC, prior_req.bus_id ASC
    LIMIT 1
  )
WHERE r.msg_type = 'REQUEST'
  AND r.op_id IN ('JL_COMMIT','JL_REJECT');
