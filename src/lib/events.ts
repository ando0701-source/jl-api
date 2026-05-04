import { Env } from "./types";
import { nowEpochSec } from "./util";

function uuid(): string {
  // Cloudflare Workers supports crypto.randomUUID().
  // Fallback is time+random to avoid hard failure.
  try {
    // @ts-ignore
    return crypto.randomUUID();
  } catch {
    const ts = nowEpochSec();
    return `${ts}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  }
}

export const BUS_EVENT_CODES = {
  CLAIM_RECLAIMED: "CLAIM_RECLAIMED",
  AUTO_FINALIZE_ACK: "AUTO_FINALIZE_ACK",
  ENQUEUE_DUPLICATE: "ENQUEUE_DUPLICATE",
  ENQUEUE_CONSTRAINT_FAILED: "ENQUEUE_CONSTRAINT_FAILED",
  ENQUEUE_PRECHECK_REJECTED: "ENQUEUE_PRECHECK_REJECTED",
} as const;

export const CLAIM_RECLAIM_REASONS = ["CLAIM_TTL_EXPIRED"] as const;
export type ClaimReclaimReason = typeof CLAIM_RECLAIM_REASONS[number];

export const ENQUEUE_DUPLICATE_REASONS = ["BUS_ID_ALREADY_EXISTS"] as const;
export type EnqueueDuplicateReason = typeof ENQUEUE_DUPLICATE_REASONS[number];

export const ENQUEUE_CONSTRAINT_KINDS = ["DB_CONSTRAINT"] as const;
export type EnqueueConstraintKind = typeof ENQUEUE_CONSTRAINT_KINDS[number];

export type BusEventInput = {
  event_code: string;
  bus_id?: string | null;
  flow_owner_id?: string | null;
  lane_id?: string | null;
  request_id?: string | null;
  op_id?: string | null;
  actor_owner_id?: string | null;
  data?: unknown | null;
  event_ts?: number | null;
};

export async function appendBusEvent(env: Env, e: BusEventInput): Promise<void> {
  try {
    const event_id = uuid();
    const event_ts = (e.event_ts != null) ? Math.floor(Number(e.event_ts)) : nowEpochSec();
    const data = (e.data === undefined || e.data === null) ? null : JSON.stringify(e.data);

    await env.DB.prepare(
      `INSERT INTO bus_events(event_id,event_ts,event_code,bus_id,flow_owner_id,lane_id,request_id,op_id,actor_owner_id,data)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      event_id,
      event_ts,
      String(e.event_code),
      e.bus_id ?? null,
      e.flow_owner_id ?? null,
      e.lane_id ?? null,
      e.request_id ?? null,
      e.op_id ?? null,
      e.actor_owner_id ?? null,
      data
    ).run();
  } catch {
    // best-effort: never fail the main request
  }
}
