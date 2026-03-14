import { HttpError, API_ERROR_CODES } from "./http";
import { BUS_SCHEMA_ID, MESSAGE_SCHEMA_ID } from "./schema";
import { MESSAGE_TYPES, BusMessageType, isBusMessageType } from "./transport_literals";

export function getPath(obj: any, path: string): any {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function requireFields(obj: any, paths: string[]): void {
  const missing: string[] = [];
  for (const p of paths) {
    const v = getPath(obj, p);
    if (v === undefined || v === null || v === "") missing.push(p);
  }
  if (missing.length) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "Missing required fields", { missing });
  }
}

export function normalizeBusTs(busTs: unknown): number {
  // Accept:
  // - epoch seconds (number)
  // - epoch milliseconds (number, >= 1e12)
  // - numeric string
  // - ISO-8601 string
  if (typeof busTs === "number" && Number.isFinite(busTs)) {
    if (busTs >= 1e12) return Math.floor(busTs / 1000);
    return Math.floor(busTs);
  }
  if (typeof busTs === "string") {
    const t = busTs.trim();
    if (!t) throw new HttpError(400, API_ERROR_CODES.INVALID_BUS_TS, "bus_ts is empty");
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (!Number.isFinite(n)) throw new HttpError(400, API_ERROR_CODES.INVALID_BUS_TS, "bus_ts is not a valid number");
      if (n >= 1e12) return Math.floor(n / 1000);
      return Math.floor(n);
    }
    const ms = Date.parse(t);
    if (!Number.isFinite(ms)) throw new HttpError(400, API_ERROR_CODES.INVALID_BUS_TS, "bus_ts is not a valid ISO-8601 datetime");
    return Math.floor(ms / 1000);
  }
  throw new HttpError(400, API_ERROR_CODES.INVALID_BUS_TS, "bus_ts must be number or string");
}

export function validateBusLoose(bus: any): {
  schema_id: string;
  bus_id: string;
  bus_ts: number;
  from_owner_id: string;
  to_owner_id: string;
  message_schema_id: string;
  msg_type: BusMessageType;
  op_id: string;
  flow_owner_id: string;
  lane_id: string;
  request_id: string;
  in_state: string;
  state: string | null;
  out_state: string | null;
  bus_obj: any;
  bus_json: string;
} {
  if (bus == null || typeof bus !== "object") {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "Body must be a JSON object");
  }

  // Required for DB extraction
  requireFields(bus, [
    "schema_id",
    "bus_id",
    "bus_ts",
    "routing.from_owner_id",
    "routing.to_owner_id",
    "message.schema_id",
    "message.msg_type",
    "message.op_id",
    "message.flow.owner_id",
    "message.flow.lane_id",
    "message.request_id",
    "message.in_state",
  ]);

  const schema_id = String(bus.schema_id);
  if (schema_id !== BUS_SCHEMA_ID) throw new HttpError(400, API_ERROR_CODES.INVALID_SCHEMA_ID, `schema_id must be ${BUS_SCHEMA_ID}`);

  const bus_id = String(bus.bus_id);
  const bus_ts = normalizeBusTs(bus.bus_ts);
  (bus as any).bus_ts = bus_ts; // canonicalize

  const from_owner_id = String(bus.routing.from_owner_id);
  const to_owner_id = String(bus.routing.to_owner_id);

  const message_schema_id = String(bus.message.schema_id);
  if (message_schema_id !== MESSAGE_SCHEMA_ID) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_MESSAGE_SCHEMA_ID, `message.schema_id must be ${MESSAGE_SCHEMA_ID}`);
  }

  const msg_type_raw = String(bus.message.msg_type);
  if (!isBusMessageType(msg_type_raw)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_MSG_TYPE, `message.msg_type must be ${MESSAGE_TYPES.REQUEST} or ${MESSAGE_TYPES.RESPONSE}`);
  }
  const msg_type = msg_type_raw as BusMessageType;

  const op_id = String(bus.message.op_id);
  const flow_owner_id = String(bus.message.flow.owner_id);
  const lane_id = String(bus.message.flow.lane_id);
  const request_id = String(bus.message.request_id);
  const in_state = String(bus.message.in_state);

  // Canonicalize inner message payload field: prefer `contents` (DOC_ID 2PLT_20_MESSAGE_SCHEMA_VOCAB)
  if ((bus.message as any).contents == null && (bus.message as any).payload != null) {
    (bus.message as any).contents = (bus.message as any).payload;
    delete (bus.message as any).payload;
  }
  if ((bus.message as any).contents == null || typeof (bus.message as any).contents !== "object") {
    throw new HttpError(400, API_ERROR_CODES.MISSING_CONTENTS, "message.contents is required (object)");
  }

  // Normalize response-only fields for DB constraints
  let state: string | null = null;
  let out_state: string | null = null;

  if (msg_type === MESSAGE_TYPES.REQUEST) {
    // Enforce DB CHECK: state/out_state must be NULL for REQUEST
    if (bus.message.state != null) delete bus.message.state;
    if (bus.message.out_state != null) delete bus.message.out_state;
    state = null;
    out_state = null;

    // Optional minimal consistency: request's to_owner should match flow.owner
    if (to_owner_id !== flow_owner_id) {
      throw new HttpError(400, API_ERROR_CODES.ROUTING_FLOW_MISMATCH, "routing.to_owner_id must match message.flow.owner_id for REQUEST", {
        to_owner_id,
        flow_owner_id,
      });
    }
  } else {
    // RESPONSE: state required, out_state must equal state per DB check.
    requireFields(bus, ["message.state"]);
    state = String(bus.message.state);
    if (bus.message.out_state == null) {
      bus.message.out_state = state;
    }
    out_state = String(bus.message.out_state);
    if (out_state !== state) {
      throw new HttpError(400, API_ERROR_CODES.OUT_STATE_MISMATCH, "message.out_state must equal message.state for RESPONSE", {
        state,
        out_state,
      });
    }
  }

  // Preserve unknown fields in bus_json (after normalization)
  const bus_json = JSON.stringify(bus);

  return {
    schema_id,
    bus_id,
    bus_ts,
    from_owner_id,
    to_owner_id,
    message_schema_id,
    msg_type,
    op_id,
    flow_owner_id,
    lane_id,
    request_id,
    in_state,
    state,
    out_state,
    bus_obj: bus,
    bus_json,
  };
}
