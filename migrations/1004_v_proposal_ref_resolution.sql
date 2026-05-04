-- 1004_v_proposal_ref_resolution.sql
-- Optional diagnostic view: resolve JL_COMMIT/JL_REJECT REQUEST.contents.proposal_ref.bus_id
-- to the target JL_PROPOSAL/PROPOSAL RESPONSE and its echoed origin REQUEST.
-- One object per migration file: v_proposal_ref_resolution.
-- Target: Cloudflare D1 (SQLite)

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
  CAST(json_extract(r.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT) AS proposal_ref_bus_id,
  CAST(json_extract(r.bus_json, '$.message.contents.proposal_ref.source_op_id') AS TEXT) AS proposal_ref_source_op_id,
  CAST(json_extract(r.bus_json, '$.message.contents.proposal_ref.source_terminal') AS TEXT) AS proposal_ref_source_terminal,
  CAST(json_extract(r.bus_json, '$.message.contents.proposal_ref.resolution_mode') AS TEXT) AS proposal_ref_resolution_mode,

  p.bus_id AS target_bus_id,
  p.bus_ts AS target_bus_ts,
  p.msg_type AS target_msg_type,
  p.op_id AS target_op_id,
  p.state AS target_state,
  p.out_state AS target_out_state,
  p.flow_owner_id AS target_flow_owner_id,
  p.lane_id AS target_lane_id,
  p.request_id AS target_request_id,
  CAST(json_extract(p.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT) AS target_echo_request_bus_id,

  q.bus_id AS origin_request_bus_id,
  q.msg_type AS origin_msg_type,
  q.op_id AS origin_op_id,
  q.in_state AS origin_in_state,
  q.flow_owner_id AS origin_flow_owner_id,
  q.lane_id AS origin_lane_id,
  q.request_id AS origin_request_id,

  CASE
    WHEN COALESCE(TRIM(CAST(json_extract(r.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT)), '') = '' THEN 'PROPOSAL_REF_NOT_FOUND'
    WHEN p.bus_id IS NULL THEN 'PROPOSAL_REF_NOT_FOUND'
    WHEN p.msg_type <> 'RESPONSE' THEN 'PROPOSAL_REF_TARGET_NOT_RESPONSE'
    WHEN p.op_id <> 'JL_PROPOSAL' THEN 'PROPOSAL_REF_TARGET_OP_MISMATCH'
    WHEN p.state <> 'PROPOSAL' OR p.out_state <> 'PROPOSAL' THEN 'PROPOSAL_REF_TARGET_TERMINAL_MISMATCH'
    WHEN p.flow_owner_id <> r.flow_owner_id THEN 'PROPOSAL_REF_FLOW_OWNER_MISMATCH'
    WHEN p.lane_id <> r.lane_id THEN 'PROPOSAL_REF_LANE_MISMATCH'
    WHEN p.request_id <> r.request_id THEN 'PROPOSAL_REF_REQUEST_ID_MISMATCH'
    WHEN COALESCE(TRIM(CAST(json_extract(p.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT)), '') = '' THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.bus_id IS NULL THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.msg_type <> 'REQUEST' THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.op_id <> 'JL_PROPOSAL' THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.in_state <> 'NUL' THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.state IS NOT NULL OR q.out_state IS NOT NULL THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.flow_owner_id <> r.flow_owner_id THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.lane_id <> r.lane_id THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN q.request_id <> r.request_id THEN 'PROPOSAL_REF_ORIGIN_REQUEST_INVALID'
    WHEN EXISTS (
      SELECT 1
      FROM bus_messages prior_req
      JOIN bus_messages prior_resp
        ON prior_resp.msg_type = 'RESPONSE'
       AND prior_resp.op_id = 'JL_COMMIT'
       AND prior_resp.state = 'COMMIT'
       AND prior_resp.out_state = 'COMMIT'
       AND CAST(json_extract(prior_resp.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT) = prior_req.bus_id
      WHERE prior_req.msg_type = 'REQUEST'
        AND prior_req.op_id = 'JL_COMMIT'
        AND prior_req.bus_id <> r.bus_id
        AND CAST(json_extract(prior_req.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT) = CAST(json_extract(r.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT)
    ) THEN 'PROPOSAL_REF_ALREADY_CONSUMED'
    ELSE 'OK'
  END AS resolution_status

FROM bus_messages r
LEFT JOIN bus_messages p
  ON p.bus_id = CAST(json_extract(r.bus_json, '$.message.contents.proposal_ref.bus_id') AS TEXT)
LEFT JOIN bus_messages q
  ON q.bus_id = CAST(json_extract(p.bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT)
WHERE r.msg_type = 'REQUEST'
  AND r.op_id IN ('JL_COMMIT','JL_REJECT');
