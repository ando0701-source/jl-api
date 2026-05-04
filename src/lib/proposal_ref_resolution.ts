import { Env } from "./types";
import { HttpError, API_ERROR_CODES } from "./http";
import { MESSAGE_TYPES, OP_IDS, TERMINAL_STATES } from "./transport_literals";

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
  flow_owner_id: string;
  lane_id: string;
  request_id: string;
  in_state: string;
  state: string | null;
  out_state: string | null;
  from_owner_id: string;
  to_owner_id: string;
  echo_request_bus_id: string | null;
};

type OriginRequestRow = {
  bus_id: string;
  msg_type: string;
  op_id: string;
  flow_owner_id: string;
  lane_id: string;
  request_id: string;
  in_state: string;
  state: string | null;
  out_state: string | null;
};

function getProposalRefBusId(x: ValidatedBusForResolution): string | null {
  if (x.msg_type !== MESSAGE_TYPES.REQUEST) return null;
  if (x.op_id !== OP_IDS.JL_COMMIT && x.op_id !== OP_IDS.JL_REJECT) return null;
  const ref = x.bus_obj?.message?.contents?.proposal_ref;
  const busId = ref?.bus_id;
  return typeof busId === "string" && busId.trim() !== "" ? busId.trim() : null;
}

function rejectProposalRef(failureCode: string, message: string, x: ValidatedBusForResolution, extra: Record<string, unknown> = {}): never {
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
       bus_id,bus_ts,msg_type,op_id,flow_owner_id,lane_id,request_id,in_state,state,out_state,
       from_owner_id,to_owner_id,
       CAST(json_extract(bus_json, '$.message.contents.meta.echo_request_bus_id') AS TEXT) AS echo_request_bus_id
     FROM bus_messages
     WHERE bus_id = ?
     LIMIT 1`
  ).bind(proposalRefBusId).first<ProposalTargetRow>();

  if (!target) {
    rejectProposalRef(
      "proposal_ref_not_found",
      "message.contents.proposal_ref.bus_id does not resolve to an existing bus_messages row",
      x,
      { proposal_ref_bus_id: proposalRefBusId }
    );
  }

  if (target.msg_type !== MESSAGE_TYPES.RESPONSE) {
    rejectProposalRef(
      "proposal_ref_target_not_response",
      "message.contents.proposal_ref.bus_id must target a RESPONSE row",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_msg_type: target.msg_type }
    );
  }

  if (target.op_id !== OP_IDS.JL_PROPOSAL) {
    rejectProposalRef(
      "proposal_ref_target_op_mismatch",
      "message.contents.proposal_ref.bus_id must target a JL_PROPOSAL response",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_op_id: target.op_id }
    );
  }

  if (target.state !== TERMINAL_STATES.PROPOSAL || target.out_state !== TERMINAL_STATES.PROPOSAL) {
    rejectProposalRef(
      "proposal_ref_target_terminal_mismatch",
      "message.contents.proposal_ref.bus_id must target a JL_PROPOSAL response whose terminal is PROPOSAL",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_state: target.state, target_out_state: target.out_state }
    );
  }

  if (target.flow_owner_id !== x.flow_owner_id) {
    rejectProposalRef(
      "proposal_ref_flow_owner_mismatch",
      "message.contents.proposal_ref.bus_id must target a proposal response in the same flow_owner_id",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_flow_owner_id: target.flow_owner_id }
    );
  }

  if (target.lane_id !== x.lane_id) {
    rejectProposalRef(
      "proposal_ref_lane_mismatch",
      "message.contents.proposal_ref.bus_id must target a proposal response in the same lane_id",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_lane_id: target.lane_id }
    );
  }

  if (target.request_id !== x.request_id) {
    rejectProposalRef(
      "proposal_ref_request_id_mismatch",
      "message.contents.proposal_ref.bus_id must target a proposal response with the same request_id",
      x,
      { proposal_ref_bus_id: proposalRefBusId, target_request_id: target.request_id }
    );
  }

  const echoRequestBusId = (target.echo_request_bus_id ?? "").trim();
  if (!echoRequestBusId) {
    rejectProposalRef(
      "proposal_ref_origin_request_invalid",
      "target proposal response must carry contents.meta.echo_request_bus_id",
      x,
      { proposal_ref_bus_id: proposalRefBusId }
    );
  }

  const origin = await env.DB.prepare(
    `SELECT bus_id,msg_type,op_id,flow_owner_id,lane_id,request_id,in_state,state,out_state
     FROM bus_messages
     WHERE bus_id = ?
     LIMIT 1`
  ).bind(echoRequestBusId).first<OriginRequestRow>();

  if (!origin
    || origin.msg_type !== MESSAGE_TYPES.REQUEST
    || origin.op_id !== OP_IDS.JL_PROPOSAL
    || origin.flow_owner_id !== x.flow_owner_id
    || origin.lane_id !== x.lane_id
    || origin.request_id !== x.request_id
    || origin.in_state !== "NUL"
    || origin.state !== null
    || origin.out_state !== null
  ) {
    rejectProposalRef(
      "proposal_ref_origin_request_invalid",
      "target proposal response must echo a same-flow/same-lane/same-request JL_PROPOSAL request",
      x,
      {
        proposal_ref_bus_id: proposalRefBusId,
        echo_request_bus_id: echoRequestBusId,
        origin_found: !!origin,
        origin_msg_type: origin?.msg_type ?? null,
        origin_op_id: origin?.op_id ?? null,
        origin_flow_owner_id: origin?.flow_owner_id ?? null,
        origin_lane_id: origin?.lane_id ?? null,
        origin_request_id: origin?.request_id ?? null,
      }
    );
  }
}
