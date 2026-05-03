import { HttpError, API_ERROR_CODES } from "./http";
import { BUS_SCHEMA_ID, MESSAGE_SCHEMA_ID } from "./schema";
import {
  MESSAGE_TYPES,
  BusMessageType,
  FlowState,
  OpId,
  ProfileDocId,
  TerminalState,
  defaultProfileDocIdForOpId,
  isAllowedRequestInState,
  isAllowedResponseTerminal,
  isBusMessageType,
  isFlowState,
  isIoMode,
  isOpId,
  isOpKind,
  isProfileDocId,
  isReasonCode,
  isTerminalState,
  OP_KINDS,
  IDENTIFIER_REGEX,
  OWNER_ID_RESERVED_LITERALS,
  LANE_ID_RESERVED_LITERALS,
} from "./transport_literals";

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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function validateRepoRelativePath(pathRaw: unknown, details: Record<string, unknown>): string {
  if (typeof pathRaw !== "string" || pathRaw.trim() === "") {
    throw new HttpError(400, API_ERROR_CODES.INVALID_OP_PATH, "ops item path must be a non-empty repo-relative POSIX path", details);
  }
  const path = pathRaw.trim();
  if (path.startsWith("/")) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_OP_PATH, "ops item path must not start with /", { ...details, path });
  }
  const segments = path.split("/");
  if (segments.some((seg) => seg === "..")) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_OP_PATH, "ops item path must not contain .. segments", { ...details, path });
  }
  return path;
}

function validateOpsArray(opsRaw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(opsRaw)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_OPS, "message.contents.ops must be an array of operation objects");
  }
  const ops = opsRaw as Record<string, unknown>[];
  ops.forEach((item, index) => {
    if (!isPlainObject(item)) {
      throw new HttpError(400, API_ERROR_CODES.INVALID_OPS, "each message.contents.ops item must be an object", { index });
    }
    const kindRaw = item.kind;
    if (typeof kindRaw !== "string" || !isOpKind(kindRaw)) {
      throw new HttpError(400, API_ERROR_CODES.INVALID_OP_KIND, "ops item kind must be one of the closed-world op kinds", { index, kind: kindRaw });
    }
    item.kind = kindRaw;
    item.path = validateRepoRelativePath(item.path, { index, kind: kindRaw });

    if (kindRaw === OP_KINDS.FS_WRITE) {
      if (typeof item.content !== "string") {
        throw new HttpError(400, API_ERROR_CODES.INVALID_OPS, "fs.write requires string content", { index, kind: kindRaw });
      }
    }
    if (kindRaw === OP_KINDS.FS_PATCH_UNIFIED) {
      if (!Array.isArray(item.unified_diff_lines) || item.unified_diff_lines.some((v) => typeof v !== "string")) {
        throw new HttpError(400, API_ERROR_CODES.INVALID_OPS, "fs.patch_unified requires unified_diff_lines as string array", { index, kind: kindRaw });
      }
    }
  });
  return ops;
}

function validateOwnerId(value: string, fieldPath: string): string {
  if (!IDENTIFIER_REGEX.test(value)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_OWNER_ID, `${fieldPath} must match ^[A-Za-z][A-Za-z0-9_]{0,31}$`, { field: fieldPath, value });
  }
  if (OWNER_ID_RESERVED_LITERALS.has(value.toUpperCase())) {
    throw new HttpError(400, API_ERROR_CODES.OWNER_ID_RESERVED, `${fieldPath} must not use a reserved OWNER_ID literal`, { field: fieldPath, value });
  }
  return value;
}

function validateLaneId(value: string, fieldPath: string): string {
  if (!IDENTIFIER_REGEX.test(value)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_LANE_ID, `${fieldPath} must match ^[A-Za-z][A-Za-z0-9_]{0,31}$`, { field: fieldPath, value });
  }
  if (LANE_ID_RESERVED_LITERALS.has(value.toUpperCase())) {
    throw new HttpError(400, API_ERROR_CODES.LANE_ID_RESERVED, `${fieldPath} must not use a reserved LANE_ID literal`, { field: fieldPath, value });
  }
  return value;
}

function validateOpIdLiteral(value: unknown, fieldPath: string): OpId {
  const v = String(value);
  if (!isOpId(v)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_OP_ID, `${fieldPath} must be one of JL_PROPOSAL, JL_COMMIT, JL_REJECT`, { field: fieldPath, value });
  }
  return v;
}

function validateFlowStateLiteral(value: unknown, fieldPath: string): FlowState {
  const v = String(value);
  if (!isFlowState(v)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_IN_STATE, `${fieldPath} must be one of NUL, PROPOSAL, COMMIT, UNRESOLVED, ABEND`, { field: fieldPath, value });
  }
  return v;
}

function validateTerminalStateLiteral(value: unknown, fieldPath: string): TerminalState {
  const v = String(value);
  if (!isTerminalState(v)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_TERMINAL_STATE, `${fieldPath} must be one of PROPOSAL, COMMIT, UNRESOLVED, ABEND`, { field: fieldPath, value });
  }
  return v;
}

function validateProfileDocIdLiteral(value: unknown, fieldPath: string): ProfileDocId {
  const v = String(value);
  if (!isProfileDocId(v)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_PROFILE_DOC_ID, `${fieldPath} must be a canonical PROFILE_DOC_ID`, { field: fieldPath, value });
  }
  return v;
}

function validateIoMode(ioRaw: unknown): void {
  if (ioRaw == null) return;
  if (!isPlainObject(ioRaw)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_IO_MODE, "message.io must be an object when present");
  }
  if (ioRaw.mode == null) return;
  const mode = String(ioRaw.mode);
  if (!isIoMode(mode)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_IO_MODE, "message.io.mode must be one of GIT, ZIP, INLINE_ONLY, NONE", { mode });
  }
  ioRaw.mode = mode;
}

function validateProfileSelection(contents: Record<string, unknown>, opId: OpId): void {
  if (contents.profile_doc_id != null) {
    const profileDocId = validateProfileDocIdLiteral(contents.profile_doc_id, "message.contents.profile_doc_id");
    contents.profile_doc_id = profileDocId;
    const expected = defaultProfileDocIdForOpId(opId);
    if (profileDocId !== expected) {
      throw new HttpError(400, API_ERROR_CODES.PROFILE_DOC_ID_OP_MISMATCH, "message.contents.profile_doc_id conflicts with default profile selection for op_id", {
        op_id: opId,
        profile_doc_id: profileDocId,
        expected_profile_doc_id: expected,
      });
    }
  }
  if (contents.recommended_next_profile_doc_id != null) {
    contents.recommended_next_profile_doc_id = validateProfileDocIdLiteral(contents.recommended_next_profile_doc_id, "message.contents.recommended_next_profile_doc_id");
  }
}

function validateReasonCodeIfPresent(contents: Record<string, unknown>, fieldPath = "message.contents.reason_code"): void {
  if (contents.reason_code == null) return;
  const reasonCode = String(contents.reason_code);
  if (!isReasonCode(reasonCode)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_REASON_CODE, `${fieldPath} must be a canonical REASON_CODE`, { field: fieldPath, value: contents.reason_code });
  }
  contents.reason_code = reasonCode;
}

function validateRequiredToResolve(contents: Record<string, unknown>): void {
  if (!Array.isArray(contents.required_to_resolve) || contents.required_to_resolve.length === 0) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "UNRESOLVED response must include non-empty message.contents.required_to_resolve", {
      missing: ["message.contents.required_to_resolve"],
    });
  }
  if (contents.required_to_resolve.some((item) => !isPlainObject(item))) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "message.contents.required_to_resolve must be an array of objects");
  }
}


function validateResponseCorrelation(contents: Record<string, unknown>): void {
  const meta = contents.meta;
  if (!isPlainObject(meta)) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "RESPONSE must include message.contents.meta.echo_request_bus_id", {
      missing: ["message.contents.meta.echo_request_bus_id"],
    });
  }
  const echo = meta.echo_request_bus_id;
  if (typeof echo !== "string" || echo.trim() === "") {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "RESPONSE must include non-empty message.contents.meta.echo_request_bus_id", {
      missing: ["message.contents.meta.echo_request_bus_id"],
    });
  }
  meta.echo_request_bus_id = echo.trim();
}

function validateNonCommitArtifactCompletionGate(state: TerminalState, contents: Record<string, unknown>): void {
  if (state === "COMMIT") return;
  if (contents.result != null) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_ARTIFACT_COMPLETION, "Only COMMIT may carry message.contents.result or claim deterministic artifact completion", {
      state,
      field: "message.contents.result",
    });
  }
}

function validateRequestProfile(msgType: BusMessageType, opId: OpId, inState: FlowState, contents: Record<string, unknown>, toOwnerId: string, flowOwnerId: string): void {
  if (msgType !== MESSAGE_TYPES.REQUEST) return;

  if (!isAllowedRequestInState(opId, inState)) {
    throw new HttpError(400, API_ERROR_CODES.OP_ID_IN_STATE_MISMATCH, "REQUEST in_state is not allowed for op_id", {
      op_id: opId,
      in_state: inState,
      allowed: opId === "JL_PROPOSAL" ? ["NUL"] : ["PROPOSAL"],
    });
  }

  if (toOwnerId !== flowOwnerId) {
    throw new HttpError(400, API_ERROR_CODES.ROUTING_FLOW_MISMATCH, "routing.to_owner_id must match message.flow.owner_id for REQUEST", {
      to_owner_id: toOwnerId,
      flow_owner_id: flowOwnerId,
    });
  }

  if (opId === "JL_PROPOSAL") {
    const hasOps = Array.isArray(contents.ops) && contents.ops.length > 0;
    const hasPatchIntent = Array.isArray(contents.patch_intent) && contents.patch_intent.length > 0;
    if (!hasOps && !hasPatchIntent) {
      throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "JL_PROPOSAL request must include non-empty message.contents.ops or non-empty message.contents.patch_intent", {
        missing_any_of: ["message.contents.ops", "message.contents.patch_intent"],
      });
    }
  }
}

function validateResponseProfile(opId: OpId, inState: FlowState, state: TerminalState, contents: Record<string, unknown>): void {
  if (!isAllowedResponseTerminal(opId, inState, state)) {
    const allowed = opId === "JL_PROPOSAL"
      ? ["PROPOSAL", "UNRESOLVED", "ABEND"]
      : opId === "JL_COMMIT"
        ? ["COMMIT", "UNRESOLVED", "ABEND"]
        : ["UNRESOLVED", "ABEND"];
    throw new HttpError(400, API_ERROR_CODES.TERMINAL_NOT_ALLOWED, "RESPONSE terminal state is not allowed for op_id and in_state", {
      op_id: opId,
      in_state: inState,
      state,
      allowed,
    });
  }

  validateResponseCorrelation(contents);
  validateNonCommitArtifactCompletionGate(state, contents);

  switch (state) {
    case "PROPOSAL":
      if (!Array.isArray(contents.ops) || contents.ops.length === 0) {
        throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "PROPOSAL response must include non-empty message.contents.ops", {
          missing: ["message.contents.ops"],
        });
      }
      break;
    case "COMMIT":
      if (contents.result == null || contents.result === "") {
        throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "COMMIT response must include message.contents.result", {
          missing: ["message.contents.result"],
        });
      }
      break;
    case "UNRESOLVED":
      validateRequiredToResolve(contents);
      break;
    case "ABEND":
      if (contents.reason_code == null || contents.reason_code === "") {
        throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "ABEND response must include message.contents.reason_code", {
          missing: ["message.contents.reason_code"],
        });
      }
      validateReasonCodeIfPresent(contents);
      break;
  }
}

export function normalizeBusTs(busTs: unknown): number {
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
  op_id: OpId;
  flow_owner_id: string;
  lane_id: string;
  request_id: string;
  in_state: FlowState;
  state: TerminalState | null;
  out_state: TerminalState | null;
  bus_obj: any;
  bus_json: string;
} {
  if (bus == null || typeof bus !== "object") {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "Body must be a JSON object");
  }

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
  (bus as any).bus_ts = bus_ts;

  const from_owner_id = validateOwnerId(String(bus.routing.from_owner_id), "routing.from_owner_id");
  const to_owner_id = validateOwnerId(String(bus.routing.to_owner_id), "routing.to_owner_id");

  const message_schema_id = String(bus.message.schema_id);
  if (message_schema_id !== MESSAGE_SCHEMA_ID) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_MESSAGE_SCHEMA_ID, `message.schema_id must be ${MESSAGE_SCHEMA_ID}`);
  }

  const msg_type_raw = String(bus.message.msg_type);
  if (!isBusMessageType(msg_type_raw)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_MSG_TYPE, `message.msg_type must be ${MESSAGE_TYPES.REQUEST} or ${MESSAGE_TYPES.RESPONSE}`);
  }
  const msg_type = msg_type_raw as BusMessageType;

  const op_id = validateOpIdLiteral(bus.message.op_id, "message.op_id");
  const flow_owner_id = validateOwnerId(String(bus.message.flow.owner_id), "message.flow.owner_id");
  const lane_id = validateLaneId(String(bus.message.flow.lane_id), "message.flow.lane_id");
  const request_id = String(bus.message.request_id);
  const in_state = validateFlowStateLiteral(bus.message.in_state, "message.in_state");

  if ((bus.message as any).contents == null && (bus.message as any).payload != null) {
    (bus.message as any).contents = (bus.message as any).payload;
    delete (bus.message as any).payload;
  }
  if ((bus.message as any).contents == null || typeof (bus.message as any).contents !== "object" || Array.isArray((bus.message as any).contents)) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_CONTENTS, "message.contents is required (object)");
  }

  validateIoMode((bus.message as any).io);

  const contents = (bus.message as any).contents as Record<string, unknown>;
  if (contents.ops != null) {
    contents.ops = validateOpsArray(contents.ops);
  }
  validateProfileSelection(contents, op_id);
  validateReasonCodeIfPresent(contents);

  let state: TerminalState | null = null;
  let out_state: TerminalState | null = null;

  if (msg_type === MESSAGE_TYPES.REQUEST) {
    if (bus.message.state != null) delete bus.message.state;
    if (bus.message.out_state != null) delete bus.message.out_state;
    state = null;
    out_state = null;
    validateRequestProfile(msg_type, op_id, in_state, contents, to_owner_id, flow_owner_id);
  } else {
    requireFields(bus, ["message.state"]);
    state = validateTerminalStateLiteral(bus.message.state, "message.state");
    if (bus.message.out_state == null) {
      bus.message.out_state = state;
    }
    out_state = validateTerminalStateLiteral(bus.message.out_state, "message.out_state");
    if (out_state !== state) {
      throw new HttpError(400, API_ERROR_CODES.OUT_STATE_MISMATCH, "message.out_state must equal message.state for RESPONSE", {
        state,
        out_state,
      });
    }
    validateResponseProfile(op_id, in_state, state, contents);
  }

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
