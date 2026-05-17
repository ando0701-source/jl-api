import { Env } from "./types";
import { HttpError, API_ERROR_CODES } from "./http";
import { MESSAGE_TYPES, OP_IDS } from "./transport_literals";
import { FAILURE_CODES, FailureCode } from "./failure_codes";

type ValidatedBusForResolution = {
  bus_id: string;
  msg_type: string;
  op_id: string;
  flow_owner_id: string;
  lane_id: string;
  request_id: string;
  bus_obj: any;
};

type ProposalTargetRow = {
  bus_id: string;
  bus_ts: number;
  msg_type: string;
  op_id: string;
  contract_doc_id: string | null;
  flow_owner_id: string;
  lane_id: string;
  request_id: string;
  from_owner_id: string;
  to_owner_id: string;
  echo_request_bus_id: string | null;
};

type OriginRequestRow = {
  bus_id: string;
  msg_type: string;
  op_id: string;
  contract_doc_id: string | null;
  flow_owner_id: string;
  lane_id: string;
  request_id: string;
};

const PROPOSAL_RESPONSE_DOC_ID = "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL";
const ORIGIN_REQUEST_DOC_ID = "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL";

function getProposalRefBusId(x: ValidatedBusForResolution): string | null {
  if (x.msg_type !== MESSAGE_TYPES.REQUEST) return null;
  if (x.op_id !== OP_IDS.JL_COMMIT && x.op_id !== OP_IDS.JL_REJECT) return null;
  const source = x.bus_obj?.message?.contents?.proposal?.source;
  const busId = source?.source_bus_id;
  return typeof busId === "string" && busId.trim() !== "" ? busId.trim() : null;
}

function rejectProposalRef(failureCode: FailureCode, message: string, x: ValidatedBusForResolution, extra: Record<string, unknown> = {}): never {
  throw new HttpError(400, API_ERROR_CODES.INVALID_PROPOSAL_REF, message, {
    failure_code: failureCode,
    bus_id: x.bus_id,
    op_id: x.op_id,
    flow_owner_id: x.flow_owner_id,
    lane_id: x.lane_id,
    request_id: x.request_id,
    ...extra,
  });
}

export async function validateProposalRefTargetPreflight(env: Env, x: ValidatedBusForResolution): Promise<void> {
  const proposalRefBusId = getProposalRefBusId(x);
  if (!proposalRefBusId) return;

  const target = await env.DB.prepare(
    `SELECT
       bus_id,bus_ts,msg_type,op_id,
       CAST(json_extract(bus_json, '$.doc_id') AS TEXT) AS contract_doc_id,
       flow_owner_id,lane_id,request_id,
       from_owner_id,to_owner_id,
       CAST(json_extract(bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT) AS echo_request_bus_id
     FROM bus_messages
     WHERE bus_id = ?
     LIMIT 1`
  ).bind(proposalRefBusId).first<ProposalTargetRow>();

  if (!target) {
    rejectProposalRef(
      FAILURE_CODES.PROPOSAL_REF_NOT_FOUND,
      "message.contents.proposal.source.source_bus_id does not resolve to an existing bus_messages row",
      x,
      { proposal_ref_bus_id: proposalRefBusId }
    );
  }

  if (target.msg_type !== MESSAGE_TYPES.RESPONSE) {
    rejectProposalRef(
      FAILURE_CODES.PROPOSAL_REF_TARGET_NOT_RESPONSE,
      "message.contents.proposal.source.source_bus_id must target a RESPONSE row",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_msg_type: target.msg_type }
    );
  }

  if (target.op_id !== OP_IDS.JL_PROPOSAL) {
    rejectProposalRef(
      FAILURE_CODES.PROPOSAL_REF_TARGET_OP_MISMATCH,
      "message.contents.proposal.source.source_bus_id must target a JL_PROPOSAL response",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_op_id: target.op_id }
    );
  }

  if (target.contract_doc_id !== PROPOSAL_RESPONSE_DOC_ID) {
    rejectProposalRef(
      FAILURE_CODES.PROPOSAL_REF_TARGET_TERMINAL_MISMATCH,
      "message.contents.proposal.source.source_bus_id must target a JL_PROPOSAL proposal response contract",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_contract_doc_id: target.contract_doc_id }
    );
  }

  if (target.flow_owner_id !== x.flow_owner_id) {
    rejectProposalRef(
      FAILURE_CODES.PROPOSAL_REF_FLOW_OWNER_MISMATCH,
      "message.contents.proposal.source.source_bus_id must target a proposal response in the same flow_owner_id",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_flow_owner_id: target.flow_owner_id }
    );
  }

  if (target.lane_id !== x.lane_id) {
    rejectProposalRef(
      FAILURE_CODES.PROPOSAL_REF_LANE_MISMATCH,
      "message.contents.proposal.source.source_bus_id must target a proposal response in the same lane_id",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_lane_id: target.lane_id }
    );
  }

  if (target.request_id !== x.request_id) {
    rejectProposalRef(
      FAILURE_CODES.PROPOSAL_REF_REQUEST_ID_MISMATCH,
      "message.contents.proposal.source.source_bus_id must target a proposal response with the same request_id",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_request_id: target.request_id }
    );
  }

  const echoRequestBusId = (target.echo_request_bus_id ?? "").trim();
  if (!echoRequestBusId) {
    rejectProposalRef(
      FAILURE_CODES.PROPOSAL_REF_ORIGIN_REQUEST_INVALID,
      "target proposal response must carry contents.meta.echo_request_bus_id",
      x,
      { proposal_ref_bus_id: proposalRefBusId }
    );
  }

  const origin = await env.DB.prepare(
    `SELECT
       bus_id,msg_type,op_id,
       CAST(json_extract(bus_json, '$.doc_id') AS TEXT) AS contract_doc_id,
       flow_owner_id,lane_id,request_id
     FROM bus_messages
     WHERE bus_id = ?
     LIMIT 1`
  ).bind(echoRequestBusId).first<OriginRequestRow>();

  if (!origin
    || origin.msg_type !== MESSAGE_TYPES.REQUEST
    || origin.op_id !== OP_IDS.JL_PROPOSAL
    || origin.contract_doc_id !== ORIGIN_REQUEST_DOC_ID
    || origin.flow_owner_id !== x.flow_owner_id
    || origin.lane_id !== x.lane_id
    || origin.request_id !== x.request_id
  ) {
    rejectProposalRef(
      FAILURE_CODES.PROPOSAL_REF_ORIGIN_REQUEST_INVALID,
      "target proposal response must echo a same-flow/same-lane/same-request JL_PROPOSAL request",
      x,
      {
        proposal_ref_bus_id: proposalRefBusId,
        echo_request_bus_id: echoRequestBusId,
        origin_found: !!origin,
        origin_msg_type: origin?.msg_type ?? null,
        origin_op_id: origin?.op_id ?? null,
        origin_contract_doc_id: origin?.contract_doc_id ?? null,
        origin_flow_owner_id: origin?.flow_owner_id ?? null,
        origin_lane_id: origin?.lane_id ?? null,
        origin_request_id: origin?.request_id ?? null,
      }
    );
  }

  const priorConsumer = await env.DB.prepare(
    `SELECT
       bus_id,op_id,flow_owner_id,lane_id,request_id,bus_ts,q_state
     FROM bus_messages
     WHERE msg_type = 'REQUEST'
       AND op_id IN ('JL_COMMIT','JL_REJECT')
       AND bus_id <> ?
       AND TRIM(CAST(json_extract(bus_json, '$.message.contents.proposal.source.source_bus_id') AS TEXT)) = ?
     ORDER BY bus_ts ASC, inserted_at ASC, bus_id ASC
     LIMIT 1`
  ).bind(x.bus_id, proposalRefBusId).first<any>();

  if (priorConsumer) {
    rejectProposalRef(
      FAILURE_CODES.PROPOSAL_REF_ALREADY_CONSUMED,
      "message.contents.proposal.source.source_bus_id has already been targeted by an accepted JL_COMMIT/JL_REJECT request",
      x,
      {
        proposal_ref_bus_id: proposalRefBusId,
        consuming_request_bus_id: priorConsumer.bus_id,
        consuming_request_op_id: priorConsumer.op_id,
        consuming_request_flow_owner_id: priorConsumer.flow_owner_id,
        consuming_request_lane_id: priorConsumer.lane_id,
        consuming_request_request_id: priorConsumer.request_id,
        consumption_stage: "accepted_target_request",
      }
    );
  }
}
