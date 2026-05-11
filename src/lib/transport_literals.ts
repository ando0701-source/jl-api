export const BUS_QUEUE_STATES = {
  PENDING: "PENDING",
  DONE: "DONE",
  DEAD: "DEAD",
} as const;

export type BusQueueState = typeof BUS_QUEUE_STATES[keyof typeof BUS_QUEUE_STATES];
export type BusFinalQueueState = typeof BUS_QUEUE_STATES.DONE | typeof BUS_QUEUE_STATES.DEAD;

export const MESSAGE_TYPES = {
  REQUEST: "REQUEST",
  RESPONSE: "RESPONSE",
} as const;

export type BusMessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];

export const IO_MODES = {
  GIT: "GIT",
  ZIP: "ZIP",
  INLINE_ONLY: "INLINE_ONLY",
  NONE: "NONE",
} as const;

export type IoMode = typeof IO_MODES[keyof typeof IO_MODES];

export const OP_KINDS = {
  FS_MKDIR: "fs.mkdir",
  FS_WRITE: "fs.write",
  FS_DELETE: "fs.delete",
  FS_PATCH_UNIFIED: "fs.patch_unified",
} as const;

export type OpKind = typeof OP_KINDS[keyof typeof OP_KINDS];

export const OP_IDS = {
  JL_PROPOSAL: "JL_PROPOSAL",
  JL_COMMIT: "JL_COMMIT",
  JL_REJECT: "JL_REJECT",
} as const;

export type OpId = typeof OP_IDS[keyof typeof OP_IDS];



export const PROFILE_DOC_IDS = {
  JL_PROPOSAL: "2PLT_50_PROFILE_JUDGEMENT_LOG_PROPOSAL",
  JL_COMMIT: "2PLT_50_PROFILE_JUDGEMENT_LOG_COMMIT",
  JL_REJECT: "2PLT_50_PROFILE_JUDGEMENT_LOG_REJECT",
} as const;

export type ProfileDocId = typeof PROFILE_DOC_IDS[keyof typeof PROFILE_DOC_IDS];

export const REASON_CODES = {
  ARTIFACT_GENERATION_FAILED: "ARTIFACT_GENERATION_FAILED",
  EXECUTION_IMPOSSIBLE: "EXECUTION_IMPOSSIBLE",
  INPUT_INSUFFICIENT_BUT_PERSISTENCE_REQUIRED: "INPUT_INSUFFICIENT_BUT_PERSISTENCE_REQUIRED",
  INPUT_MISSING: "INPUT_MISSING",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  LANE_ID_INVALID: "LANE_ID_INVALID",
  LANE_ID_MISSING: "LANE_ID_MISSING",
  LANE_ID_RESERVED: "LANE_ID_RESERVED",
  LOG_PERSISTENCE_FAILED: "LOG_PERSISTENCE_FAILED",
  MANAGER_REJECTED_PROPOSAL: "MANAGER_REJECTED_PROPOSAL",
  OWNER_ID_INVALID: "OWNER_ID_INVALID",
  OWNER_ID_MISSING: "OWNER_ID_MISSING",
  OWNER_ID_RESERVED: "OWNER_ID_RESERVED",
  POLICY_CONFLICT: "POLICY_CONFLICT",
  POLICY_VIOLATION: "POLICY_VIOLATION",
  PROPOSAL_ARTIFACT_VIOLATION: "PROPOSAL_ARTIFACT_VIOLATION",
  PROTOCOL_VIOLATION: "PROTOCOL_VIOLATION",
  REJECT_TARGET_NOT_FOUND: "REJECT_TARGET_NOT_FOUND",
  REQUEST_ID_INVALID: "REQUEST_ID_INVALID",
  REQUEST_ID_MISSING: "REQUEST_ID_MISSING",
  REQUEST_ID_RESERVED: "REQUEST_ID_RESERVED",
  SCHEMA_MISSING_REQUIRED: "SCHEMA_MISSING_REQUIRED",
  TRIGGER_INVALID: "TRIGGER_INVALID",
  WRITE_SCOPE_VIOLATION: "WRITE_SCOPE_VIOLATION",
} as const;

export type ReasonCode = typeof REASON_CODES[keyof typeof REASON_CODES];

export const IDENTIFIER_REGEX = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

export const OWNER_ID_RESERVED_LITERALS = new Set([
  "SYSTEM",
  "DEFAULT",
  "ROOT",
  "GLOBAL",
  "UNKNOWN",
  "AUTO",
  "NONE",
  "NULL",
  "requester",
  "WORKER",
].map((v) => v.toUpperCase()));

export const LANE_ID_RESERVED_LITERALS = new Set([
  "SYSTEM",
  "DEFAULT",
  "ROOT",
  "GLOBAL",
  "UNKNOWN",
  "AUTO",
  "NONE",
  "NULL",
].map((v) => v.toUpperCase()));

export const CHANNEL_KINDS = {
  D1: "D1",
  WEBHOOK: "WEBHOOK",
} as const;

export type ChannelKind = typeof CHANNEL_KINDS[keyof typeof CHANNEL_KINDS];

export const BUS_ACK_KINDS = {
  AUTO_FINALIZE_ACK: "AUTO_FINALIZE_ACK",
} as const;

export type BusAckKind = typeof BUS_ACK_KINDS[keyof typeof BUS_ACK_KINDS];

export function isBusFinalQueueState(v: string): v is BusFinalQueueState {
  return v === BUS_QUEUE_STATES.DONE || v === BUS_QUEUE_STATES.DEAD;
}

export function isBusMessageType(v: string): v is BusMessageType {
  return v === MESSAGE_TYPES.REQUEST || v === MESSAGE_TYPES.RESPONSE;
}

export function coerceChannelKind(v: unknown): ChannelKind {
  return v === CHANNEL_KINDS.WEBHOOK ? CHANNEL_KINDS.WEBHOOK : CHANNEL_KINDS.D1;
}

export function isIoMode(v: string): v is IoMode {
  return v === IO_MODES.GIT || v === IO_MODES.ZIP || v === IO_MODES.INLINE_ONLY || v === IO_MODES.NONE;
}

export function isOpKind(v: string): v is OpKind {
  return v === OP_KINDS.FS_MKDIR || v === OP_KINDS.FS_WRITE || v === OP_KINDS.FS_DELETE || v === OP_KINDS.FS_PATCH_UNIFIED;
}

export function isOpId(v: string): v is OpId {
  return v === OP_IDS.JL_PROPOSAL || v === OP_IDS.JL_COMMIT || v === OP_IDS.JL_REJECT;
}



export function isProfileDocId(v: string): v is ProfileDocId {
  return v === PROFILE_DOC_IDS.JL_PROPOSAL || v === PROFILE_DOC_IDS.JL_COMMIT || v === PROFILE_DOC_IDS.JL_REJECT;
}

export function isReasonCode(v: string): v is ReasonCode {
  return Object.values(REASON_CODES).includes(v as ReasonCode);
}

export function defaultProfileDocIdForOpId(opId: OpId): ProfileDocId {
  switch (opId) {
    case OP_IDS.JL_PROPOSAL:
      return PROFILE_DOC_IDS.JL_PROPOSAL;
    case OP_IDS.JL_COMMIT:
      return PROFILE_DOC_IDS.JL_COMMIT;
    case OP_IDS.JL_REJECT:
      return PROFILE_DOC_IDS.JL_REJECT;
  }
}


