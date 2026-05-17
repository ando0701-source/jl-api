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

const REQUEST_DOC_BY_OP_ID: Record<"JL_PROPOSAL" | "JL_COMMIT" | "JL_REJECT", string> = {
  JL_PROPOSAL: "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL",
  JL_COMMIT: "2PLT_60_IO_CONTRACT_REQUESTER_JL_COMMIT",
  JL_REJECT: "2PLT_60_IO_CONTRACT_REQUESTER_JL_REJECT",
};

const RESPONSE_DOCS_BY_OP_ID: Record<"JL_PROPOSAL" | "JL_COMMIT" | "JL_REJECT", string[]> = {
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

const CONTENT_BLOCK_MSG_TYPES = new Set(["REQUEST", "RESPONSE"]);
const CONTENT_BLOCK_OP_IDS = new Set(["JL_PROPOSAL", "JL_COMMIT", "JL_REJECT", "PROPOSAL", "COMMIT", "UNRESOLVED", "ABEND"]);
const CONTENT_BLOCK_IDENTITY: Record<string, { msg_type: string; op_id: string }> = {
  JL_PROPOSAL: { msg_type: "REQUEST", op_id: "JL_PROPOSAL" },
  PROPOSAL: { msg_type: "RESPONSE", op_id: "PROPOSAL" },
  JL_COMMIT: { msg_type: "REQUEST", op_id: "JL_COMMIT" },
  JL_REJECT: { msg_type: "REQUEST", op_id: "JL_REJECT" },
  COMMIT: { msg_type: "RESPONSE", op_id: "COMMIT" },
  UNRESOLVED: { msg_type: "RESPONSE", op_id: "UNRESOLVED" },
  ABEND: { msg_type: "RESPONSE", op_id: "ABEND" },
};

const CONTENT_BLOCK_SEQUENCE_BY_CURRENT: Record<string, string[]> = {
  JL_PROPOSAL: ["JL_PROPOSAL"],
  PROPOSAL: ["JL_PROPOSAL", "PROPOSAL"],
  JL_COMMIT: ["JL_PROPOSAL", "PROPOSAL", "JL_COMMIT"],
  JL_REJECT: ["JL_PROPOSAL", "PROPOSAL", "JL_REJECT"],
  COMMIT: ["JL_PROPOSAL", "PROPOSAL", "JL_COMMIT", "COMMIT"],
};

function expectedContentBlockSequence(msgType: BusMessageType, opId: OpId, terminal: ResponseTerminal | null): string[] {
  if (msgType === MESSAGE_TYPES.REQUEST) return CONTENT_BLOCK_SEQUENCE_BY_CURRENT[opId] ?? [opId];
  if (terminal === "PROPOSAL") return ["JL_PROPOSAL", "PROPOSAL"];
  if (terminal === "COMMIT") return ["JL_PROPOSAL", "PROPOSAL", "JL_COMMIT", "COMMIT"];
  if (terminal === "UNRESOLVED") return opId === "JL_PROPOSAL" ? ["JL_PROPOSAL", "UNRESOLVED"] : ["JL_PROPOSAL", "PROPOSAL", opId, "UNRESOLVED"];
  if (terminal === "ABEND") return opId === "JL_PROPOSAL" ? ["JL_PROPOSAL", "ABEND"] : ["JL_PROPOSAL", "PROPOSAL", opId, "ABEND"];
  return [opId];
}

function msgTypeForOpId(opId: OpId): BusMessageType {
  return (opId === "JL_PROPOSAL" || opId === "JL_COMMIT" || opId === "JL_REJECT") ? MESSAGE_TYPES.REQUEST : MESSAGE_TYPES.RESPONSE;
}

function responseTerminalForDocId(docId: string): ResponseTerminal | null {
  if (docId === "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL") return "PROPOSAL";
  if (docId === "2PLT_60_IO_CONTRACT_RESPONDER_COMMIT") return "COMMIT";
  if (docId.includes("_UNRESOLVED_")) return "UNRESOLVED";
  if (docId.includes("_ABEND_")) return "ABEND";
  return null;
}

function responseRequestOpIdForDocId(docId: string): "JL_PROPOSAL" | "JL_COMMIT" | "JL_REJECT" | null {
  if (docId === "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL") return "JL_PROPOSAL";
  if (docId === "2PLT_60_IO_CONTRACT_RESPONDER_COMMIT") return "JL_COMMIT";
  if (docId.endsWith("_FROM_JL_PROPOSAL")) return "JL_PROPOSAL";
  if (docId.endsWith("_FROM_JL_COMMIT")) return "JL_COMMIT";
  if (docId.endsWith("_FROM_JL_REJECT")) return "JL_REJECT";
  return null;
}

function validateContractDocForMessage(docId: string, msgType: BusMessageType, opId: OpId): ResponseTerminal | null {
  if (msgType === MESSAGE_TYPES.REQUEST) {
    if (opId !== "JL_PROPOSAL" && opId !== "JL_COMMIT" && opId !== "JL_REJECT") {
      throw new HttpError(400, API_ERROR_CODES.INVALID_OP_ID, "REQUEST message.op_id must be a requester op_id", { doc_id: docId, op_id: opId });
    }
    const expected = REQUEST_DOC_BY_OP_ID[opId];
    if (docId !== expected) {
      throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "doc_id does not match request op_id", { doc_id: docId, op_id: opId, expected_doc_id: expected });
    }
    return null;
  }

  const terminal = responseTerminalForDocId(docId);
  if (!terminal) {
    throw new HttpError(400, API_ERROR_CODES.TERMINAL_NOT_ALLOWED, "response doc_id does not resolve to a response terminal", { doc_id: docId, op_id: opId });
  }
  if (opId !== terminal) {
    throw new HttpError(400, API_ERROR_CODES.TERMINAL_NOT_ALLOWED, "RESPONSE message.op_id must match response terminal / message.sequence[-1]", { doc_id: docId, op_id: opId, expected_op_id: terminal });
  }
  if (!responseRequestOpIdForDocId(docId)) {
    throw new HttpError(400, API_ERROR_CODES.TERMINAL_NOT_ALLOWED, "response doc_id does not resolve to a source request op_id", { doc_id: docId, op_id: opId });
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
    throw new HttpError(400, API_ERROR_CODES.INVALID_OP_ID, `${fieldPath} must be a canonical Layer 60 op_id`, { field: fieldPath, value });
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

function requireContentBlock(contents: Record<string, unknown>, blockName: string, expectedIoContractDocId?: string): Record<string, unknown> {
  const block = getContentBlock(contents, blockName);
  if (!block) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, `message.contents.${blockName} block is required`, {
      missing: [`message.contents.${blockName}`],
    });
  }
  validateContentBlockFrame(blockName, block, expectedIoContractDocId);
  return block;
}

function validateContentBlockFrame(blockName: string, block: Record<string, unknown>, expectedIoContractDocId?: string): void {
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

  if (block.bus_id == null && typeof (block as any).source_bus_id === "string") block.bus_id = (block as any).source_bus_id;
  if (block.content_hash == null && typeof (block as any).source_content_hash === "string") block.content_hash = (block as any).source_content_hash;
  delete (block as any).source_bus_id;
  delete (block as any).source_content_hash;
  delete (block as any).source_kind;
  delete (block as any).source_block_name;
  delete (block as any).source_terminal;

  const expectedIdentity = CONTENT_BLOCK_IDENTITY[blockName];
  if (expectedIdentity && block.msg_type == null) block.msg_type = expectedIdentity.msg_type;
  if (expectedIdentity && block.op_id == null) block.op_id = expectedIdentity.op_id;
  const blockMsgType = block.msg_type;
  if (typeof blockMsgType !== "string" || !CONTENT_BLOCK_MSG_TYPES.has(blockMsgType)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, `message.contents.${blockName}.msg_type is invalid`, {
      field: `message.contents.${blockName}.msg_type`,
      value: blockMsgType,
    });
  }
  if (expectedIdentity && blockMsgType !== expectedIdentity.msg_type) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, `message.contents.${blockName}.msg_type does not match the block`, {
      field: `message.contents.${blockName}.msg_type`,
      value: blockMsgType,
      expected: expectedIdentity.msg_type,
    });
  }
  const blockOpId = block.op_id;
  if (typeof blockOpId !== "string" || !CONTENT_BLOCK_OP_IDS.has(blockOpId)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, `message.contents.${blockName}.op_id is invalid`, {
      field: `message.contents.${blockName}.op_id`,
      value: blockOpId,
    });
  }
  if (expectedIdentity && blockOpId !== expectedIdentity.op_id) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, `message.contents.${blockName}.op_id does not match the block`, {
      field: `message.contents.${blockName}.op_id`,
      value: blockOpId,
      expected: expectedIdentity.op_id,
    });
  }

  const blockDocId = block.doc_id;
  if (typeof blockDocId !== "string" || !IO_CONTRACT_DOC_IDS.has(blockDocId)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, `message.contents.${blockName}.doc_id is invalid`, {
      field: `message.contents.${blockName}.doc_id`,
      value: blockDocId,
    });
  }
  if (expectedIoContractDocId && blockDocId !== expectedIoContractDocId) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, `message.contents.${blockName}.doc_id does not match the contract`, {
      field: `message.contents.${blockName}.doc_id`,
      value: blockDocId,
      expected: expectedIoContractDocId,
    });
  }
  const blockBusId = block.bus_id;
  const blockContentHash = block.content_hash;
  const missing: string[] = [];
  if (typeof blockBusId !== "string" || blockBusId.trim() === "") missing.push(`message.contents.${blockName}.bus_id`);
  if (typeof blockContentHash !== "string" || blockContentHash.trim() === "") missing.push(`message.contents.${blockName}.content_hash`);
  if (missing.length) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, `message.contents.${blockName} is missing block origin fields`, { missing });
  }
  block.bus_id = String(blockBusId).trim();
  block.content_hash = String(blockContentHash).trim();
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
  const unresolved = requireContentBlock(contents, "UNRESOLVED");
  const body = unresolved.body as Record<string, unknown>;
  if (!Array.isArray(body.required_to_resolve) || body.required_to_resolve.length === 0) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "UNRESOLVED response must include non-empty message.contents.UNRESOLVED.body.required_to_resolve", {
      missing: ["message.contents.UNRESOLVED.body.required_to_resolve"],
    });
  }
  if (body.required_to_resolve.some((item) => !isPlainObject(item))) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "message.contents.UNRESOLVED.body.required_to_resolve must be an array of objects");
  }
}

function validateProposalBlockForTargetRequest(opId: OpId, contents: Record<string, unknown>): void {
  if (opId !== "JL_COMMIT" && opId !== "JL_REJECT") return;
  requireContentBlock(contents, "JL_PROPOSAL", "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL");
  const proposal = requireContentBlock(contents, "PROPOSAL", "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL");
  if (proposal.msg_type !== "RESPONSE" || proposal.op_id !== "PROPOSAL") {
    throw new HttpError(400, API_ERROR_CODES.INVALID_PROPOSAL_REF, "message.contents.PROPOSAL must identify a PROPOSAL response content block", {
      op_id: opId,
      expected: { msg_type: "RESPONSE", op_id: "PROPOSAL", doc_id: "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL" },
      actual: { msg_type: proposal.msg_type, op_id: proposal.op_id, doc_id: proposal.doc_id },
    });
  }
  if (opId === "JL_COMMIT") {
    requireContentBlock(contents, "JL_COMMIT", "2PLT_60_IO_CONTRACT_REQUESTER_JL_COMMIT");
  } else {
    requireContentBlock(contents, "JL_REJECT", "2PLT_60_IO_CONTRACT_REQUESTER_JL_REJECT");
  }
}

function responseRequestBlockNameForOpId(opId: "JL_PROPOSAL" | "JL_COMMIT" | "JL_REJECT"): "JL_PROPOSAL" | "JL_COMMIT" | "JL_REJECT" {
  return opId;
}

function responseRequestContractDocIdForOpId(opId: "JL_PROPOSAL" | "JL_COMMIT" | "JL_REJECT"): string {
  return REQUEST_DOC_BY_OP_ID[opId];
}

function validateResponseCorrelation(sourceRequestOpId: "JL_PROPOSAL" | "JL_COMMIT" | "JL_REJECT", contents: Record<string, unknown>): void {
  const blockName = responseRequestBlockNameForOpId(sourceRequestOpId);
  const requestBlock = requireContentBlock(contents, blockName, responseRequestContractDocIdForOpId(sourceRequestOpId));
  const sourceBusId = requestBlock.bus_id;
  if (typeof sourceBusId !== "string" || sourceBusId.trim() === "") {
    throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, `RESPONSE must include non-empty message.contents.${blockName}.bus_id`, {
      missing: [`message.contents.${blockName}.bus_id`],
    });
  }
  requestBlock.bus_id = sourceBusId.trim();
}

function validateNonCommitArtifactCompletionGate(terminal: ResponseTerminal, contents: Record<string, unknown>): void {
  if (terminal === "COMMIT") return;
  if (contents.COMMIT != null || contents.result != null) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_ARTIFACT_COMPLETION, "Only COMMIT may carry message.contents.COMMIT or legacy message.contents.result", {
      terminal,
      field: contents.COMMIT != null ? "message.contents.COMMIT" : "message.contents.result",
    });
  }
}

function validateResponseProfile(sourceRequestOpId: "JL_PROPOSAL" | "JL_COMMIT" | "JL_REJECT", terminal: ResponseTerminal, contents: Record<string, unknown>): void {
  validateResponseCorrelation(sourceRequestOpId, contents);
  validateNonCommitArtifactCompletionGate(terminal, contents);

  switch (terminal) {
    case "PROPOSAL": {
      requireContentBlock(contents, "JL_PROPOSAL", "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL");
      const proposal = requireContentBlock(contents, "PROPOSAL", "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL");
      const body = proposal.body as Record<string, unknown>;
      if (body.ops != null) body.ops = validateOpsArray(body.ops);
      break;
    }
    case "COMMIT":
      requireContentBlock(contents, "JL_PROPOSAL", "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL");
      requireContentBlock(contents, "PROPOSAL", "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL");
      requireContentBlock(contents, "JL_COMMIT", "2PLT_60_IO_CONTRACT_REQUESTER_JL_COMMIT");
      requireContentBlock(contents, "COMMIT", "2PLT_60_IO_CONTRACT_RESPONDER_COMMIT");
      break;
    case "UNRESOLVED":
      validateRequiredToResolveBlock(contents);
      break;
    case "ABEND": {
      const abend = requireContentBlock(contents, "ABEND");
      const body = abend.body as Record<string, unknown>;
      if (body.reason_code == null || body.reason_code === "") {
        throw new HttpError(400, API_ERROR_CODES.MISSING_FIELDS, "ABEND response must include message.contents.ABEND.body.reason_code", {
          missing: ["message.contents.ABEND.body.reason_code"],
        });
      }
      validateReasonCodeIfPresent(body, "message.contents.ABEND.body.reason_code");
      break;
    }
  }
}

function materializedSourceContentHash(busId: string, blockName: string): string {
  return `MATERIALIZED_BLOCK_CONTENT_HASH:${busId}:${blockName}`;
}

function fillCurrentContentBlockSourceFields(contents: Record<string, unknown>, busId: string, currentBlockName: string): void {
  const rawBlock = contents[currentBlockName];
  if (!isPlainObject(rawBlock)) return;
  // The current message block is materialized by the current bus message itself.
  // Fixture/static values are overwritten so DBMS correlation never depends on pre-mutation IDs.
  rawBlock.bus_id = busId;
  rawBlock.content_hash = materializedSourceContentHash(busId, currentBlockName);
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
    requireContentBlock(contents, "JL_PROPOSAL", "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL");
  }

  validateProposalBlockForTargetRequest(opId, contents);
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
    "message.op_id",
    "message.owner_id",
    "message.lane_id",
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

  const op_id = validateOpIdLiteral(bus.message.op_id, "message.op_id");
  const msg_type = msgTypeForOpId(op_id);
  // Phase1E-2F-6X-8: message.msg_type is derived from message.op_id and removed from stored bus_json.
  delete (bus.message as any).msg_type;
  const flow_owner_id = validateOwnerId(String((bus.message as any).owner_id), "message.owner_id");
  const lane_id = validateLaneId(String((bus.message as any).lane_id), "message.lane_id");
  (bus.message as any).owner_id = flow_owner_id;
  (bus.message as any).lane_id = lane_id;
  delete (bus.message as any).flow;
  delete (bus.message as any).io;
  if ((bus.message as any).contents == null && (bus.message as any).payload != null) {
    (bus.message as any).contents = (bus.message as any).payload;
    delete (bus.message as any).payload;
  }
  if ((bus.message as any).contents == null || typeof (bus.message as any).contents !== "object" || Array.isArray((bus.message as any).contents)) {
    throw new HttpError(400, API_ERROR_CODES.MISSING_CONTENTS, "message.contents is required (object)");
  }

  const contents = (bus.message as any).contents as Record<string, unknown>;
  // Phase1E-2F-6X-4: response correlation is carried by the received request block
  // bus_id. Legacy response metadata block is ignored and removed before storing.
  delete (contents as any).meta;
  const responseTerminal = validateContractDocForMessage(doc_id, msg_type, op_id);
  const sourceRequestOpId = msg_type === MESSAGE_TYPES.RESPONSE ? responseRequestOpIdForDocId(doc_id) : null;
  const sequenceOpId = sourceRequestOpId ?? op_id;
  const expectedSequence = expectedContentBlockSequence(msg_type, sequenceOpId as OpId, responseTerminal);
  if ((bus.message as any).sequence == null) {
    (bus.message as any).sequence = expectedSequence;
  }
  if (!Array.isArray((bus.message as any).sequence) || (bus.message as any).sequence.some((v: unknown) => typeof v !== "string")) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "message.sequence must be an array of content block names", { field: "message.sequence" });
  }
  const sequence = ((bus.message as any).sequence as string[]).map((v) => String(v));
  if (JSON.stringify(sequence) !== JSON.stringify(expectedSequence)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "message.sequence does not match op_id/doc_id", { op_id, doc_id, sequence, expected_sequence: expectedSequence });
  }
  (bus.message as any).sequence = sequence;
  const makeProposalBlockForRequestId = getContentBlock(contents, "JL_PROPOSAL");
  const request_id = typeof makeProposalBlockForRequestId?.bus_id === "string" && makeProposalBlockForRequestId.bus_id.trim() ? makeProposalBlockForRequestId.bus_id.trim() : bus_id;
  // Phase1E-2F-6X-8: message.request_id is replaced by message.contents.JL_PROPOSAL.bus_id.
  delete (bus.message as any).request_id;
  const makeProposalBlock = getContentBlock(contents, "JL_PROPOSAL");
  if (makeProposalBlock && isPlainObject(makeProposalBlock.body)) {
    const body = makeProposalBlock.body as Record<string, unknown>;
    if (body.ops != null) body.ops = validateOpsArray(body.ops);
  }
  const currentBlockName = responseTerminal ?? op_id;
  fillCurrentContentBlockSourceFields(contents, bus_id, currentBlockName);
  const currentBlock = requireContentBlock(contents, currentBlockName);
  if (doc_id !== currentBlock.doc_id) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "envelope doc_id must match current content block doc_id", {
      doc_id,
      current_block: currentBlockName,
      current_block_doc_id: currentBlock.doc_id,
    });
  }
  if (bus_id !== currentBlock.bus_id) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "envelope bus_id must match current content block bus_id", {
      bus_id,
      current_block: currentBlockName,
      current_block_bus_id: currentBlock.bus_id,
    });
  }
  const contentKeys = Object.keys(contents).sort();
  const sequenceKeys = [...sequence].sort();
  if (JSON.stringify(contentKeys) !== JSON.stringify(sequenceKeys)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "message.sequence must exactly match message.contents keys", {
      contents_keys: contentKeys,
      sequence,
    });
  }

  if (msg_type === MESSAGE_TYPES.REQUEST) {
    validateRequestProfile(msg_type, op_id, contents, to_owner_id, flow_owner_id);
  } else {
    validateResponseProfile(sourceRequestOpId as "JL_PROPOSAL" | "JL_COMMIT" | "JL_REJECT", responseTerminal as ResponseTerminal, contents);
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
