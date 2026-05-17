import { HttpError, API_ERROR_CODES } from "./http";
import { BUS_SCHEMA_ID, MESSAGE_SCHEMA_ID } from "./schema";
import {
  MESSAGE_TYPES,
  BusMessageType,
  OpId,
  ProfileDocId,
  defaultProfileDocIdForOpId,
  isBusMessageType,
  isIoMode,
  isOpId,
  isOpKind,
  isProfileDocId,
  isReasonCode,
  OP_KINDS,
  IDENTIFIER_REGEX,
  OWNER_ID_RESERVED_LITERALS,
  LANE_ID_RESERVED_LITERALS,
} from "./transport_literals";

type ResponseTerminal = "PROPOSAL" | "COMMIT" | "UNRESOLVED" | "ABEND";

const REQUEST_DOC_BY_OP_ID: Record<OpId, string> = {
  JL_PROPOSAL: "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL",
  JL_COMMIT: "2PLT_60_IO_CONTRACT_REQUESTER_JL_COMMIT",
  JL_REJECT: "2PLT_60_IO_CONTRACT_REQUESTER_JL_REJECT",
};

const RESPONSE_DOCS_BY_OP_ID: Record<OpId, string[]> = {
  JL_PROPOSAL: [
    "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL",
    "2PLT_60_IO_CONTRACT_RESPONDER_UNRESOLVED_FROM_JL_PROPOSAL",
    "2PLT_60_IO_CONTRACT_RESPONDER_ABEND_FROM_JL_PROPOSAL",
  ],
  JL_COMMIT: [
    "2PLT_60_IO_CONTRACT_RESPONDER_COMMIT",
    "2PLT_60_IO_CONTRACT_RESPONDER_UNRESOLVED_FROM_JL_COMMIT",
    "2PLT_60_IO_CONTRACT_RESPONDER_ABEND_FROM_JL_COMMIT",
  ],
  JL_REJECT: [
    "2PLT_60_IO_CONTRACT_RESPONDER_UNRESOLVED_FROM_JL_REJECT",
    "2PLT_60_IO_CONTRACT_RESPONDER_ABEND_FROM_JL_REJECT",
  ],
};

const IO_CONTRACT_DOC_IDS = new Set<string>([
  "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL",
  "2PLT_60_IO_CONTRACT_REQUESTER_JL_COMMIT",
  "2PLT_60_IO_CONTRACT_REQUESTER_JL_REJECT",
  "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL",
  "2PLT_60_IO_CONTRACT_RESPONDER_COMMIT",
  "2PLT_60_IO_CONTRACT_RESPONDER_UNRESOLVED_FROM_JL_PROPOSAL",
  "2PLT_60_IO_CONTRACT_RESPONDER_UNRESOLVED_FROM_JL_COMMIT",
  "2PLT_60_IO_CONTRACT_RESPONDER_UNRESOLVED_FROM_JL_REJECT",
  "2PLT_60_IO_CONTRACT_RESPONDER_ABEND_FROM_JL_PROPOSAL",
  "2PLT_60_IO_CONTRACT_RESPONDER_ABEND_FROM_JL_COMMIT",
  "2PLT_60_IO_CONTRACT_RESPONDER_ABEND_FROM_JL_REJECT",
]);

const CONTENT_BLOCK_SOURCE_KINDS = new Set(["CURRENT_MESSAGE", "RECEIVED_BLOCK", "DERIVED_BLOCK", "SYSTEM_INJECTED"]);

function responseTerminalForDocId(docId: string): ResponseTerminal | null {
  if (docId === "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL") return "PROPOSAL";
  if (docId === "2PLT_60_IO_CONTRACT_RESPONDER_COMMIT") return "COMMIT";
  if (docId.includes("_UNRESOLVED_")) return "UNRESOLVED";
  if (docId.includes("_ABEND_")) return "ABEND";
  return null;
}

function validateContractDocForMessage(docId: string, msgType: BusMessageType, opId: OpId): ResponseTerminal | null {
  if (msgType === MESSAGE_TYPES.REQUEST) {
    const expected = REQUEST_DOC_BY_OP_ID[opId];
    if (docId !== expected) {
      throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "doc_id does not match request op_id", { doc_id: docId, op_id: opId, expected_doc_id: expected });
    }
    return null;
  }

  const allowed = RESPONSE_DOCS_BY_OP_ID[opId];
  if (!allowed.includes(docId)) {
    throw new HttpError(400, API_ERROR_CODES.TERMINAL_NOT_ALLOWED, "doc_id does not match response op_id", { doc_id: docId, op_id: opId, allowed_doc_ids: allowed });
  }
  const terminal = responseTerminalForDocId(docId);
  if (!terminal) {
    throw new HttpError(400, API_ERROR_CODES.TERMINAL_NOT_ALLOWED, "response doc_id does not resolve to a response terminal", { doc_id: docId, op_id: opId });
  }
  return terminal;
}

export function getPath(obj: any, path: string): any {
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object" || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function requireFields(obj: any, paths: string[]): void {
  const missing: string[] = [];
  for (const path of paths) {
    const v = getPath(obj, path);
    if (v === undefined || v === null || v === "") missing.push(path);
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

    if (kindRaw === OP_KINDS.FS_WRITE && typeof item.content !== "string") {
      throw new HttpError(400, API_ERROR_CODES.INVALID_OPS, "fs.write requires string content", { index, kind: kindRaw });
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

function getContentBlock(contents: Record<string, unknown>, blockName: string): Record<string, unknown> | null {
  const block = contents[blockName];
  return isPlainObject(block) ? block : null;
}

function requireContentBlock(contents: Record<string, unknown>, blockName: string, expectedSourceKind?: string, expectedIoContractDocId?: string): Record<string, unknown> {
  const block = getContentBlock(contents, blockName);
  if (!block) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, `message.contents.${blockName} block is required`, {
      missing: [`message.contents.${blockName}`],
    });
  }
  validateContentBlockFrame(blockName, block, expectedSourceKind, expectedIoContractDocId);
  return block;
}

function validateContentBlockFrame(blockName: string, block: Record<string, unknown>, expectedSourceKind?: string, expectedIoContractDocId?: string): void {
  // Phase1E-2F-6X-2: content block metadata is held directly under the block.
  // Legacy block.source is accepted only as an input shim and is flattened before storage.
  const legacySource = block.source;
  if (isPlainObject(legacySource)) {
    for (const [k, v] of Object.entries(legacySource)) {
      if (block[k] == null) block[k] = v;
    }
    delete block.source;
  }

  if (block.attachment == null && Array.isArray((block as any).attached)) {
    block.attachment = (block as any).attached;
  }
  delete (block as any).attached;

  const sourceKind = block.source_kind;
  if (typeof sourceKind !== "string" || !CONTENT_BLOCK_SOURCE_KINDS.has(sourceKind)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, `message.contents.${blockName}.source_kind is invalid`, {
      field: `message.contents.${blockName}.source_kind`,
      value: sourceKind,
    });
  }
  if (expectedSourceKind && sourceKind !== expectedSourceKind) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, `message.contents.${blockName}.source_kind does not match the contract`, {
      field: `message.contents.${blockName}.source_kind`,
      value: sourceKind,
      expected: expectedSourceKind,
    });
  }
  const ioContractDocId = block.io_contract_doc_id;
  if (typeof ioContractDocId !== "string" || !IO_CONTRACT_DOC_IDS.has(ioContractDocId)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, `message.contents.${blockName}.io_contract_doc_id is invalid`, {
      field: `message.contents.${blockName}.io_contract_doc_id`,
      value: ioContractDocId,
    });
  }
  if (expectedIoContractDocId && ioContractDocId !== expectedIoContractDocId) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, `message.contents.${blockName}.io_contract_doc_id does not match the contract`, {
      field: `message.contents.${blockName}.io_contract_doc_id`,
      value: ioContractDocId,
      expected: expectedIoContractDocId,
    });
  }
  if (sourceKind === "RECEIVED_BLOCK") {
    const sourceBusId = block.source_bus_id;
    const sourceBlockName = block.source_block_name;
    const sourceContentHash = block.source_content_hash;
    const missing: string[] = [];
    if (typeof sourceBusId !== "string" || sourceBusId.trim() === "") missing.push(`message.contents.${blockName}.source_bus_id`);
    if (typeof sourceBlockName !== "string" || sourceBlockName.trim() === "") missing.push(`message.contents.${blockName}.source_block_name`);
    if (typeof sourceContentHash !== "string" || sourceContentHash.trim() === "") missing.push(`message.contents.${blockName}.source_content_hash`);
    if (missing.length) {
      throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, `message.contents.${blockName} is missing received-block source fields`, { missing });
    }
    block.source_bus_id = String(sourceBusId).trim();
    block.source_block_name = String(sourceBlockName).trim();
    block.source_content_hash = String(sourceContentHash).trim();
  }
  if (!isPlainObject(block.body)) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, `message.contents.${blockName}.body is required and must be an object`, {
      missing: [`message.contents.${blockName}.body`],
    });
  }
  if (!Array.isArray(block.attachment)) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, `message.contents.${blockName}.attachment is required and must be an array`, {
      missing: [`message.contents.${blockName}.attachment`],
    });
  }
}

function validateRequiredToResolveBlock(contents: Record<string, unknown>): void {
  const unresolved = requireContentBlock(contents, "unresolved", "CURRENT_MESSAGE");
  const body = unresolved.body as Record<string, unknown>;
  if (!Array.isArray(body.required_to_resolve) || body.required_to_resolve.length === 0) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "UNRESOLVED response must include non-empty message.contents.unresolved.body.required_to_resolve", {
      missing: ["message.contents.unresolved.body.required_to_resolve"],
    });
  }
  if (body.required_to_resolve.some((item) => !isPlainObject(item))) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "message.contents.unresolved.body.required_to_resolve must be an array of objects");
  }
}

function validateProposalBlockForTargetRequest(opId: OpId, contents: Record<string, unknown>): void {
  if (opId !== "JL_COMMIT" && opId !== "JL_REJECT") return;
  requireContentBlock(contents, "make_proposal", "RECEIVED_BLOCK", "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL");
  const proposal = requireContentBlock(contents, "proposal", "RECEIVED_BLOCK", "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL");
  const sourceTerminal = proposal.source_terminal;
  if (proposal.source_block_name !== "proposal" || sourceTerminal !== "PROPOSAL") {
    throw new HttpError(400, API_ERROR_CODES.INVALID_PROPOSAL_REF, "message.contents.proposal.source must target a PROPOSAL content block from a PROPOSAL response", {
      op_id: opId,
      expected: { source_block_name: "proposal", source_terminal: "PROPOSAL", io_contract_doc_id: "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL" },
      actual: { source_block_name: proposal.source_block_name, source_terminal: sourceTerminal, io_contract_doc_id: proposal.io_contract_doc_id },
    });
  }
  if (opId === "JL_COMMIT") {
    const commitRequest = requireContentBlock(contents, "commit_request", "CURRENT_MESSAGE", "2PLT_60_IO_CONTRACT_REQUESTER_JL_COMMIT");
    const body = commitRequest.body as Record<string, unknown>;
    if (body.target_block_name !== "proposal") {
      throw new HttpError(400, API_ERROR_CODES.INVALID_PROPOSAL_REF, "message.contents.commit_request.body.target_block_name must be proposal", { op_id: opId, target_block_name: body.target_block_name });
    }
  } else {
    const rejectRequest = requireContentBlock(contents, "reject_request", "CURRENT_MESSAGE", "2PLT_60_IO_CONTRACT_REQUESTER_JL_REJECT");
    const body = rejectRequest.body as Record<string, unknown>;
    if (body.target_block_name !== "proposal") {
      throw new HttpError(400, API_ERROR_CODES.INVALID_PROPOSAL_REF, "message.contents.reject_request.body.target_block_name must be proposal", { op_id: opId, target_block_name: body.target_block_name });
    }
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

function validateNonCommitArtifactCompletionGate(terminal: ResponseTerminal, contents: Record<string, unknown>): void {
  if (terminal === "COMMIT") return;
  if (contents.commit != null || contents.result != null) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_ARTIFACT_COMPLETION, "Only COMMIT may carry message.contents.commit or legacy message.contents.result", {
      terminal,
      field: contents.commit != null ? "message.contents.commit" : "message.contents.result",
    });
  }
}

function materializedSourceContentHash(busId: string, blockName: string): string {
  return `MATERIALIZED_SOURCE_HASH:${busId}:${blockName}`;
}

function fillCurrentContentBlockSourceFields(contents: Record<string, unknown>, busId: string, terminal: ResponseTerminal | null): void {
  for (const [blockName, rawBlock] of Object.entries(contents)) {
    if (!isPlainObject(rawBlock)) continue;
    const block = rawBlock as Record<string, unknown>;
    if (block.source_kind !== "CURRENT_MESSAGE") continue;
    if (typeof block.source_bus_id !== "string" || block.source_bus_id.trim() === "") block.source_bus_id = busId;
    if (typeof block.source_block_name !== "string" || block.source_block_name.trim() === "") block.source_block_name = blockName;
    if (terminal && (typeof block.source_terminal !== "string" || block.source_terminal.trim() === "")) block.source_terminal = terminal;
    if (typeof block.source_content_hash !== "string" || block.source_content_hash.trim() === "") block.source_content_hash = materializedSourceContentHash(String(block.source_bus_id), String(block.source_block_name));
  }
}

function validateRequestProfile(msgType: BusMessageType, opId: OpId, contents: Record<string, unknown>, toOwnerId: string, flowOwnerId: string): void {
  if (msgType !== MESSAGE_TYPES.REQUEST) return;

  if (toOwnerId !== flowOwnerId) {
    throw new HttpError(400, API_ERROR_CODES.ROUTING_FLOW_MISMATCH, "to_owner_id must match message.owner_id for REQUEST", {
      to_owner_id: toOwnerId,
      message_owner_id: flowOwnerId,
    });
  }

  if (opId === "JL_PROPOSAL") {
    requireContentBlock(contents, "make_proposal", "CURRENT_MESSAGE", "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL");
  }

  validateProposalBlockForTargetRequest(opId, contents);
}

function validateResponseProfile(opId: OpId, terminal: ResponseTerminal, contents: Record<string, unknown>): void {
  validateResponseCorrelation(contents);
  validateNonCommitArtifactCompletionGate(terminal, contents);

  switch (terminal) {
    case "PROPOSAL": {
      requireContentBlock(contents, "make_proposal", "RECEIVED_BLOCK", "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL");
      const proposal = requireContentBlock(contents, "proposal", "CURRENT_MESSAGE", "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL");
      const body = proposal.body as Record<string, unknown>;
      if (body.ops != null) body.ops = validateOpsArray(body.ops);
      break;
    }
    case "COMMIT":
      requireContentBlock(contents, "make_proposal", "RECEIVED_BLOCK", "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL");
      requireContentBlock(contents, "proposal", "RECEIVED_BLOCK", "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL");
      requireContentBlock(contents, "commit_request", "RECEIVED_BLOCK", "2PLT_60_IO_CONTRACT_REQUESTER_JL_COMMIT");
      requireContentBlock(contents, "commit", "CURRENT_MESSAGE", "2PLT_60_IO_CONTRACT_RESPONDER_COMMIT");
      break;
    case "UNRESOLVED":
      validateRequiredToResolveBlock(contents);
      break;
    case "ABEND": {
      const abend = requireContentBlock(contents, "abend", "CURRENT_MESSAGE");
      const body = abend.body as Record<string, unknown>;
      if (body.reason_code == null || body.reason_code === "") {
        throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "ABEND response must include message.contents.abend.body.reason_code", {
          missing: ["message.contents.abend.body.reason_code"],
        });
      }
      validateReasonCodeIfPresent(body, "message.contents.abend.body.reason_code");
      break;
    }
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
  doc_id: string;
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
  bus_obj: any;
  bus_json: string;
} {
  if (bus == null || typeof bus !== "object") {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "Body must be a JSON object");
  }

  // Phase1E-2F-6X-2 canonical envelope: owner routing is top-level and
  // lane ownership is directly under message. Legacy routing/flow are accepted
  // as input shims and removed before storing bus_json.
  if (isPlainObject(bus.routing)) {
    if ((bus as any).from_owner_id == null) (bus as any).from_owner_id = (bus.routing as any).from_owner_id;
    if ((bus as any).to_owner_id == null) (bus as any).to_owner_id = (bus.routing as any).to_owner_id;
  }
  if (isPlainObject((bus as any).message) && isPlainObject((bus as any).message.flow)) {
    const msgAny = (bus as any).message;
    if (msgAny.owner_id == null) msgAny.owner_id = msgAny.flow.owner_id;
    if (msgAny.lane_id == null) msgAny.lane_id = msgAny.flow.lane_id;
  }

  requireFields(bus, [
    "schema_id",
    "doc_id",
    "bus_id",
    "bus_ts",
    "from_owner_id",
    "to_owner_id",
    "message.schema_id",
    "message.msg_type",
    "message.op_id",
    "message.owner_id",
    "message.lane_id",
    "message.request_id",
  ]);

  const schema_id = String(bus.schema_id);
  if (schema_id !== BUS_SCHEMA_ID) throw new HttpError(400, API_ERROR_CODES.INVALID_SCHEMA_ID, `schema_id must be ${BUS_SCHEMA_ID}`);
  const doc_id = String(bus.doc_id);

  const bus_id = String(bus.bus_id);
  const bus_ts = normalizeBusTs(bus.bus_ts);
  (bus as any).bus_ts = bus_ts;

  const from_owner_id = validateOwnerId(String((bus as any).from_owner_id), "from_owner_id");
  const to_owner_id = validateOwnerId(String((bus as any).to_owner_id), "to_owner_id");
  (bus as any).from_owner_id = from_owner_id;
  (bus as any).to_owner_id = to_owner_id;
  delete (bus as any).routing;

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
  const flow_owner_id = validateOwnerId(String((bus.message as any).owner_id), "message.owner_id");
  const lane_id = validateLaneId(String((bus.message as any).lane_id), "message.lane_id");
  (bus.message as any).owner_id = flow_owner_id;
  (bus.message as any).lane_id = lane_id;
  delete (bus.message as any).flow;
  delete (bus.message as any).io;
  const request_id = String(bus.message.request_id);

  if ((bus.message as any).contents == null && (bus.message as any).payload != null) {
    (bus.message as any).contents = (bus.message as any).payload;
    delete (bus.message as any).payload;
  }
  if ((bus.message as any).contents == null || typeof (bus.message as any).contents !== "object" || Array.isArray((bus.message as any).contents)) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_CONTENTS, "message.contents is required (object)");
  }

  const contents = (bus.message as any).contents as Record<string, unknown>;
  const makeProposalBlock = getContentBlock(contents, "make_proposal");
  if (makeProposalBlock && isPlainObject(makeProposalBlock.body)) {
    const body = makeProposalBlock.body as Record<string, unknown>;
    if (body.ops != null) body.ops = validateOpsArray(body.ops);
  }
  const responseTerminal = validateContractDocForMessage(doc_id, msg_type, op_id);
  fillCurrentContentBlockSourceFields(contents, bus_id, responseTerminal);

  if (msg_type === MESSAGE_TYPES.REQUEST) {
    validateRequestProfile(msg_type, op_id, contents, to_owner_id, flow_owner_id);
  } else {
    validateResponseProfile(op_id, responseTerminal as ResponseTerminal, contents);
  }

  const bus_json = JSON.stringify(bus);

  return {
    schema_id,
    doc_id,
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
    bus_obj: bus,
    bus_json,
  };
}
