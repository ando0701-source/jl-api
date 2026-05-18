import { jsonResponse } from "../lib/http";
import { Env } from "../lib/types";
import { nowEpochSec } from "../lib/util";

type DiagStatus = "PASS" | "FAIL" | "WARN" | "INFO";

type DiagResult = {
  run_id: string;
  bus_id: string | null;
  key: string;
  value: string | null;
  status: DiagStatus;
  note: string | null;
  created_at: number;
};

type TriggerCase = {
  phase: "phase1a" | "phase1b";
  caseId: string;
  expected: "OK" | string;
  targetBusId: string;
  sql: string;
};

type ScalarCheck = {
  key: string;
  sql: string;
  compare: "eq" | "gte";
  expected: number;
  note: string;
};

const MANAGER = "ManagerA";
const WORKER = "WorkerA";
const OTHER_WORKER = "WorkerB";
const LANE = "LaneA";
const OTHER_LANE = "LaneB";
const REQUEST_DOC_BY_OP_ID: Record<"JL_PROPOSAL" | "JL_COMMIT" | "JL_REJECT", string> = {
  JL_PROPOSAL: "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL",
  JL_COMMIT: "2PLT_60_IO_CONTRACT_REQUESTER_JL_COMMIT",
  JL_REJECT: "2PLT_60_IO_CONTRACT_REQUESTER_JL_REJECT",
};

const PROPOSAL_RESPONSE_DOC_BY_TERMINAL: Record<"PROPOSAL" | "UNRESOLVED" | "ABEND", string> = {
  PROPOSAL: "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL",
  UNRESOLVED: "2PLT_60_IO_CONTRACT_RESPONDER_UNRESOLVED_FROM_JL_PROPOSAL",
  ABEND: "2PLT_60_IO_CONTRACT_RESPONDER_ABEND_FROM_JL_PROPOSAL",
};


const KNOWN_TRIGGER_FAILURE_CODES = [
  "proposal_ref_not_found",
  "proposal_ref_target_not_response",
  "proposal_ref_target_op_mismatch",
  "proposal_ref_target_terminal_mismatch",
  "proposal_ref_flow_owner_mismatch",
  "proposal_ref_lane_mismatch",
  "proposal_ref_request_id_mismatch",
  "proposal_ref_origin_request_invalid",
  "proposal_ref_already_consumed",
] as const;

function runId(): string {
  const compact = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  let suffix = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
  try {
    // @ts-ignore Cloudflare Workers supports crypto.randomUUID().
    suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  } catch {
    // keep random fallback
  }
  return `DIAG_${compact}_${suffix}`;
}

function sqlQuote(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}


function messageTypeForOpId(op_id: string): "REQUEST" | "RESPONSE" {
  return op_id === "JL_PROPOSAL" || op_id === "JL_COMMIT" || op_id === "JL_REJECT" ? "REQUEST" : "RESPONSE";
}

function sequenceForDocId(doc_id: string, op_id: string): string[] {
  if (doc_id === "2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL") return ["JL_PROPOSAL"];
  if (doc_id === "2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL") return ["JL_PROPOSAL", "PROPOSAL"];
  if (doc_id === "2PLT_60_IO_CONTRACT_REQUESTER_JL_COMMIT") return ["JL_PROPOSAL", "PROPOSAL", "JL_COMMIT"];
  if (doc_id === "2PLT_60_IO_CONTRACT_REQUESTER_JL_REJECT") return ["JL_PROPOSAL", "PROPOSAL", "JL_REJECT"];
  if (doc_id === "2PLT_60_IO_CONTRACT_RESPONDER_COMMIT") return ["JL_PROPOSAL", "PROPOSAL", "JL_COMMIT", "COMMIT"];
  if (doc_id.includes("_UNRESOLVED_FROM_JL_PROPOSAL")) return ["JL_PROPOSAL", "UNRESOLVED"];
  if (doc_id.includes("_UNRESOLVED_FROM_JL_COMMIT")) return ["JL_PROPOSAL", "PROPOSAL", "JL_COMMIT", "UNRESOLVED"];
  if (doc_id.includes("_UNRESOLVED_FROM_JL_REJECT")) return ["JL_PROPOSAL", "PROPOSAL", "JL_REJECT", "UNRESOLVED"];
  if (doc_id.includes("_ABEND_FROM_JL_PROPOSAL")) return ["JL_PROPOSAL", "ABEND"];
  if (doc_id.includes("_ABEND_FROM_JL_COMMIT")) return ["JL_PROPOSAL", "PROPOSAL", "JL_COMMIT", "ABEND"];
  if (doc_id.includes("_ABEND_FROM_JL_REJECT")) return ["JL_PROPOSAL", "PROPOSAL", "JL_REJECT", "ABEND"];
  return [op_id];
}

function rootRequestId(obj: any): string {
  return String(obj?.message?.contents?.JL_PROPOSAL?.bus_id ?? obj?.bus_id ?? "");
}

function compactJson(obj: unknown): string {
  return JSON.stringify(obj);
}

function busJsonSql(obj: unknown): string {
  return sqlQuote(compactJson(obj));
}

function insertBusSql(obj: any): string {
  const m = obj.message;
  return `INSERT INTO bus_messages(schema_id,bus_id,bus_ts,q_state,from_owner_id,to_owner_id,claimed_by,claimed_at,done_at,message_schema_id,msg_type,op_id,flow_owner_id,lane_id,request_id,bus_json)
VALUES('2PLT_BUS/v1',${sqlQuote(obj.bus_id)},${Number(obj.bus_ts)},'PENDING',${sqlQuote(obj.from_owner_id)},${sqlQuote(obj.to_owner_id)},NULL,NULL,NULL,'2PLT_MESSAGE/v1',${sqlQuote(messageTypeForOpId(m.op_id))},${sqlQuote(m.op_id)},${sqlQuote(m.owner_id)},${sqlQuote(m.lane_id)},${sqlQuote(rootRequestId(obj))},${busJsonSql(obj)});`;
}

function requestEnvelope(
  bus_id: string,
  op_id: "JL_PROPOSAL" | "JL_COMMIT" | "JL_REJECT",
  owner: string,
  lane_id: string,
  request_id: string,
  contents: Record<string, unknown>,
  bus_ts: number,
): any {
  return {
    schema_id: "2PLT_BUS/v1",
    doc_id: REQUEST_DOC_BY_OP_ID[op_id],
    bus_id,
    bus_ts,
    q_state: "PENDING",
    claimed_by: null,
    claimed_at: null,
    done_at: null,
    from_owner_id: MANAGER,
    to_owner_id: owner,
    message: {
      schema_id: "2PLT_MESSAGE/v1",
      op_id,
      sequence: sequenceForDocId(REQUEST_DOC_BY_OP_ID[op_id], op_id),
      owner_id: owner,
      lane_id,
      contents,
    },
  };
}


function materializedContentHash(bus_id: string, block_name: string): string {
  return `DIAG_BLOCK_CONTENT_HASH:${bus_id}:${block_name}`;
}

function contentBlockIdentity(block_name: string): { msg_type: string; op_id: string } {
  const map: Record<string, { msg_type: string; op_id: string }> = {
    JL_PROPOSAL: { msg_type: "REQUEST", op_id: "JL_PROPOSAL" },
    PROPOSAL: { msg_type: "RESPONSE", op_id: "PROPOSAL" },
    JL_COMMIT: { msg_type: "REQUEST", op_id: "JL_COMMIT" },
    JL_REJECT: { msg_type: "REQUEST", op_id: "JL_REJECT" },
    COMMIT: { msg_type: "RESPONSE", op_id: "COMMIT" },
    UNRESOLVED: { msg_type: "RESPONSE", op_id: "UNRESOLVED" },
    ABEND: { msg_type: "RESPONSE", op_id: "ABEND" },
  };
  return map[block_name] ?? { msg_type: "REQUEST", op_id: "JL_PROPOSAL" };
}

function currentBlock(doc_id: string, bus_id: string, block_name: string, body: Record<string, unknown> = {}): Record<string, unknown> {
  const identity = contentBlockIdentity(block_name);
  return { msg_type: identity.msg_type, op_id: identity.op_id, body, attachment: [], doc_id, bus_id, content_hash: materializedContentHash(bus_id, block_name) };
}

function receivedBlock(doc_id: string, bus_id: string, block_name: string, body: Record<string, unknown> = {}): Record<string, unknown> {
  const identity = contentBlockIdentity(block_name);
  return { msg_type: identity.msg_type, op_id: identity.op_id, body, attachment: [], doc_id, bus_id, content_hash: materializedContentHash(bus_id, block_name) };
}

function makeProposalBody(task: string): Record<string, unknown> {
  return {
    patch_intent: [{
      intent_id: "PI_DIAG_TRIGGER_SMOKE",
      target_hint: "CODEX/docs/2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX.json",
      operation: "diag_trigger_smoke",
      required_authority: "2PLT_40_TARGET_RESOLUTION_PHASE1_ANNEX",
    }],
    task_brief: task,
  };
}

function proposalRequest(bus_id: string, owner: string, lane_id: string, request_id: string, bus_ts: number): any {
  return requestEnvelope(bus_id, "JL_PROPOSAL", owner, lane_id, request_id, {
    JL_PROPOSAL: currentBlock("2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL", bus_id, "JL_PROPOSAL", makeProposalBody("HTTP /diag trigger smoke setup")),
  }, bus_ts);
}

function proposalResponse(
  bus_id: string,
  owner: string,
  lane_id: string,
  request_id: string,
  terminal: "PROPOSAL" | "UNRESOLVED" | "ABEND",
  request_bus_id: string,
  bus_ts: number,
): any {
  const contents: Record<string, unknown> = {
    JL_PROPOSAL: receivedBlock("2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL", request_bus_id, "JL_PROPOSAL"),
  };
  if (terminal === "PROPOSAL") {
    contents.PROPOSAL = currentBlock("2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL", bus_id, "PROPOSAL", { ops: [{ kind: "fs.write", path: "scratch/diag/proposal.txt", content: "diag trigger setup" }] });
  } else if (terminal === "UNRESOLVED") {
    contents.UNRESOLVED = currentBlock("2PLT_60_IO_CONTRACT_RESPONDER_UNRESOLVED_FROM_JL_PROPOSAL", bus_id, "UNRESOLVED", { required_to_resolve: [{ field: "diag", reason: "trigger_probe" }] });
  } else {
    contents.ABEND = currentBlock("2PLT_60_IO_CONTRACT_RESPONDER_ABEND_FROM_JL_PROPOSAL", bus_id, "ABEND", { reason_code: "PROTOCOL_VIOLATION" });
  }
  return {
    schema_id: "2PLT_BUS/v1",
    doc_id: PROPOSAL_RESPONSE_DOC_BY_TERMINAL[terminal],
    bus_id,
    bus_ts,
    q_state: "PENDING",
    claimed_by: null,
    claimed_at: null,
    done_at: null,
    from_owner_id: owner,
    to_owner_id: MANAGER,
    message: {
      schema_id: "2PLT_MESSAGE/v1",
      op_id: terminal,
      sequence: sequenceForDocId(PROPOSAL_RESPONSE_DOC_BY_TERMINAL[terminal], terminal),
      owner_id: owner,
      lane_id,
      contents,
    },
  };
}

function targetRequest(
  bus_id: string,
  op_id: "JL_COMMIT" | "JL_REJECT",
  owner: string,
  lane_id: string,
  rootRequestBusId: string,
  proposalSourceBusId: string,
  bus_ts: number,
): any {
  const currentDoc = op_id === "JL_COMMIT" ? "2PLT_60_IO_CONTRACT_REQUESTER_JL_COMMIT" : "2PLT_60_IO_CONTRACT_REQUESTER_JL_REJECT";
  const targetBlock = op_id === "JL_COMMIT" ? "JL_COMMIT" : "JL_REJECT";
  return requestEnvelope(bus_id, op_id, owner, lane_id, rootRequestBusId, {
    JL_PROPOSAL: receivedBlock("2PLT_60_IO_CONTRACT_REQUESTER_JL_PROPOSAL", rootRequestBusId, "JL_PROPOSAL"),
    PROPOSAL: receivedBlock("2PLT_60_IO_CONTRACT_RESPONDER_PROPOSAL", proposalSourceBusId, "PROPOSAL", {}),
    [targetBlock]: currentBlock(currentDoc, bus_id, targetBlock, { task_brief: "HTTP /diag trigger smoke target" }),
  }, bus_ts);
}

function phase1aCases(run_id: string, bus_ts: number): TriggerCase[] {
  const cases: TriggerCase[] = [];
  const setupPair = (caseId: string, owner = WORKER, lane_id = LANE, request_id?: string, terminal: "PROPOSAL" | "UNRESOLVED" | "ABEND" = "PROPOSAL", orphan = false) => {
    const rid = request_id ?? `REQ_DIAG_${caseId}_${run_id}`;
    const preq = proposalRequest(`BUS_DIAG_${caseId}_REQ_PROPOSAL_${run_id}`, owner, lane_id, rid, bus_ts);
    const echo = orphan ? `BUS_DIAG_${caseId}_UNKNOWN_ORIGIN_${run_id}` : preq.bus_id;
    const presp = proposalResponse(`BUS_DIAG_${caseId}_RESP_${terminal}_${run_id}`, owner, lane_id, rid, terminal, echo, bus_ts);
    return { rid, preq, presp };
  };
  const add = (caseId: string, expected: string, target: any, setup: any[] = []) => {
    cases.push({ phase: "phase1a", caseId, expected, targetBusId: target.bus_id, sql: [...setup.map(insertBusSql), insertBusSql(target)].join("\n") });
  };

  let s = setupPair("P1A_P01");
  add("P01_valid_target", "OK", targetRequest(`BUS_DIAG_P1A_P01_REQ_COMMIT_${run_id}`, "JL_COMMIT", WORKER, LANE, s.preq.bus_id, s.presp.bus_id, bus_ts), [s.preq, s.presp]);

  add("N01_missing_target", "proposal_ref_not_found", targetRequest(`BUS_DIAG_P1A_N01_REQ_COMMIT_${run_id}`, "JL_COMMIT", WORKER, LANE, `REQ_DIAG_P1A_N01_${run_id}`, `BUS_DIAG_P1A_N01_MISSING_${run_id}`, bus_ts));

  s = setupPair("P1A_N02");
  add("N02_target_not_response", "proposal_ref_target_not_response", targetRequest(`BUS_DIAG_P1A_N02_REQ_COMMIT_${run_id}`, "JL_COMMIT", WORKER, LANE, s.preq.bus_id, s.preq.bus_id, bus_ts), [s.preq]);

  s = setupPair("P1A_N03", WORKER, LANE, undefined, "UNRESOLVED");
  add("N03_terminal_unresolved", "proposal_ref_target_terminal_mismatch", targetRequest(`BUS_DIAG_P1A_N03_REQ_COMMIT_${run_id}`, "JL_COMMIT", WORKER, LANE, s.preq.bus_id, s.presp.bus_id, bus_ts), [s.preq, s.presp]);

  s = setupPair("P1A_N04", WORKER, LANE, undefined, "ABEND");
  add("N04_terminal_abend", "proposal_ref_target_terminal_mismatch", targetRequest(`BUS_DIAG_P1A_N04_REQ_REJECT_${run_id}`, "JL_REJECT", WORKER, LANE, s.preq.bus_id, s.presp.bus_id, bus_ts), [s.preq, s.presp]);

  s = setupPair("P1A_N05", WORKER, OTHER_LANE);
  add("N05_lane_mismatch", "proposal_ref_lane_mismatch", targetRequest(`BUS_DIAG_P1A_N05_REQ_COMMIT_${run_id}`, "JL_COMMIT", WORKER, LANE, s.preq.bus_id, s.presp.bus_id, bus_ts), [s.preq, s.presp]);

  s = setupPair("P1A_N06", WORKER, LANE, `REQ_DIAG_P1A_N06_OTHER_${run_id}`);
  add("N06_request_id_mismatch", "proposal_ref_request_id_mismatch", targetRequest(`BUS_DIAG_P1A_N06_REQ_COMMIT_${run_id}`, "JL_COMMIT", WORKER, LANE, `REQ_DIAG_P1A_N06_${run_id}`, s.presp.bus_id, bus_ts), [s.preq, s.presp]);

  s = setupPair("P1A_N07", OTHER_WORKER);
  add("N07_flow_owner_mismatch", "proposal_ref_flow_owner_mismatch", targetRequest(`BUS_DIAG_P1A_N07_REQ_REJECT_${run_id}`, "JL_REJECT", WORKER, LANE, s.preq.bus_id, s.presp.bus_id, bus_ts), [s.preq, s.presp]);

  s = setupPair("P1A_N08", WORKER, LANE, undefined, "PROPOSAL", true);
  add("N08_origin_invalid", "proposal_ref_origin_request_invalid", targetRequest(`BUS_DIAG_P1A_N08_REQ_COMMIT_${run_id}`, "JL_COMMIT", WORKER, LANE, `BUS_DIAG_P1A_N08_UNKNOWN_ORIGIN_${run_id}`, s.presp.bus_id, bus_ts), [s.presp]);

  return cases;
}

function phase1bCases(run_id: string, bus_ts: number): TriggerCase[] {
  const cases: TriggerCase[] = [];
  const setup = (caseId: string) => {
    const rid = `REQ_DIAG_P1B_${caseId}_${run_id}`;
    const preq = proposalRequest(`BUS_DIAG_P1B_${caseId}_REQ_PROPOSAL_${run_id}`, WORKER, LANE, rid, bus_ts);
    const presp = proposalResponse(`BUS_DIAG_P1B_${caseId}_RESP_PROPOSAL_${run_id}`, WORKER, LANE, rid, "PROPOSAL", preq.bus_id, bus_ts);
    return { rid, preq, presp };
  };
  const add = (caseId: string, expected: string, target: any, setupRows: any[]) => {
    cases.push({ phase: "phase1b", caseId, expected, targetBusId: target.bus_id, sql: [...setupRows.map(insertBusSql), insertBusSql(target)].join("\n") });
  };

  let s = setup("P01");
  add("P01_valid_first_consumer", "OK", targetRequest(`BUS_DIAG_P1B_P01_REQ_COMMIT_${run_id}`, "JL_COMMIT", WORKER, LANE, s.preq.bus_id, s.presp.bus_id, bus_ts), [s.preq, s.presp]);

  for (const [caseId, firstOp, secondOp] of [
    ["N01", "JL_COMMIT", "JL_COMMIT"],
    ["N02", "JL_COMMIT", "JL_REJECT"],
    ["N03", "JL_REJECT", "JL_COMMIT"],
    ["N04", "JL_REJECT", "JL_REJECT"],
  ] as const) {
    s = setup(caseId);
    const first = targetRequest(`BUS_DIAG_P1B_${caseId}_REQ_FIRST_${firstOp}_${run_id}`, firstOp, WORKER, LANE, s.preq.bus_id, s.presp.bus_id, bus_ts);
    const second = targetRequest(`BUS_DIAG_P1B_${caseId}_REQ_SECOND_${secondOp}_${run_id}`, secondOp, WORKER, LANE, s.preq.bus_id, s.presp.bus_id, bus_ts);
    add(`${caseId}_already_consumed`, "proposal_ref_already_consumed", second, [s.preq, s.presp, first]);
  }

  return cases;
}

const PHASE1C_SCALAR_CHECKS: ScalarCheck[] = [
  {
    key: "phase1c.Q01_catalog_count.value",
    sql: "SELECT COUNT(*) AS value FROM bus_failure_catalog",
    compare: "gte",
    expected: 9,
    note: "bus_failure_catalog row count must be at least 9.",
  },
  {
    key: "phase1c.Q02_proposal_ref_catalog_count.value",
    sql: `SELECT COUNT(*) AS value FROM bus_failure_catalog WHERE failure_code IN ('proposal_ref_not_found','proposal_ref_target_not_response','proposal_ref_target_op_mismatch','proposal_ref_target_terminal_mismatch','proposal_ref_flow_owner_mismatch','proposal_ref_lane_mismatch','proposal_ref_request_id_mismatch','proposal_ref_origin_request_invalid','proposal_ref_already_consumed')`,
    compare: "eq",
    expected: 9,
    note: "proposal_ref failure_code catalog row count must be exactly 9.",
  },
  {
    key: "phase1c.Q03_unresolved_observed_failure_codes.value",
    sql: `SELECT COUNT(*) AS value FROM (SELECT DISTINCT json_extract(data,'$.failure_code') AS failure_code FROM bus_events WHERE event_code='ENQUEUE_PRECHECK_REJECTED' AND COALESCE(json_extract(data,'$.failure_code'),'') <> '' AND json_extract(data,'$.failure_code') NOT IN (SELECT failure_code FROM bus_failure_catalog))`,
    compare: "eq",
    expected: 0,
    note: "Observed ENQUEUE_PRECHECK_REJECTED failure_code values must resolve to catalog rows.",
  },
  {
    key: "phase1c.Q04_catalog_detail_missing_metadata_count.value",
    sql: `SELECT COUNT(*) AS value FROM (SELECT finding_code FROM bus_failure_catalog WHERE COALESCE(TRIM(finding_code),'')='' OR enabled NOT IN (0,1) UNION ALL SELECT finding_code FROM bus_findings_catalog WHERE COALESCE(TRIM(finding_code),'')='' OR COALESCE(TRIM(finding_message_template),'')='' OR COALESCE(TRIM(effective_recovery_profile),'')='' OR json_valid(required_detail_keys) <> 1 OR enabled NOT IN (0,1) UNION ALL SELECT finding_code FROM bus_diag_catalog WHERE COALESCE(TRIM(finding_code),'')='' OR COALESCE(TRIM(diag_key),'')='' OR COALESCE(TRIM(expected_value),'')='' OR COALESCE(TRIM(compare_op),'')='' OR enabled NOT IN (0,1))`,
    compare: "eq",
    expected: 0,
    note: "Diagnostic catalog rows must have finding mappings and valid required_detail_keys JSON.",
  },
  {
    key: "phase1c.Q05_observed_failure_code_coverage_unresolved_count.value",
    sql: "SELECT COUNT(*) AS value FROM v_bus_failure_catalog_coverage WHERE catalog_resolved <> 1",
    compare: "eq",
    expected: 0,
    note: "v_bus_failure_catalog_coverage must have no unresolved observed failure_code rows.",
  },
];

function errorText(e: unknown): string {
  const anyErr = e as any;
  return String(anyErr?.message ?? anyErr?.error ?? anyErr?.cause?.message ?? e ?? "");
}

function failureCodeFromError(text: string): string {
  for (const code of KNOWN_TRIGGER_FAILURE_CODES) {
    if (text.includes(code)) return code;
  }
  const prefix = text.split(":", 1)[0]?.trim() ?? "";
  return prefix || text.trim() || "UNKNOWN_ERROR";
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/g)
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

async function runSqlStatements(env: Env, sql: string): Promise<void> {
  for (const stmt of splitSqlStatements(sql)) {
    await env.DB.prepare(stmt).run();
  }
}

function diagBusIdFromKey(key: string, run_id: string): string {
  const safe = key.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
  return `BUS_DIAG_${safe}_${run_id}`;
}

function compareScalar(value: number, compare: "eq" | "gte", expected: number): boolean {
  if (compare === "eq") return value === expected;
  return value >= expected;
}

async function storeResult(env: Env, result: DiagResult): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO bus_diag(run_id,bus_id,diag_key,diag_value,status,note,created_at)
     VALUES(?,?,?,?,?,?,?)`
  ).bind(
    result.run_id,
    result.bus_id,
    result.key,
    result.value,
    result.status,
    result.note,
    result.created_at,
  ).run();
}

async function runTriggerCase(env: Env, run_id: string, c: TriggerCase): Promise<DiagResult> {
  const created_at = nowEpochSec();
  let observed = "OK";
  let note: string | null = null;
  try {
    await runSqlStatements(env, c.sql);
  } catch (e) {
    note = errorText(e);
    observed = failureCodeFromError(note);
  }
  const status: DiagStatus = observed === c.expected ? "PASS" : "FAIL";
  const result: DiagResult = {
    run_id,
    bus_id: c.targetBusId,
    key: `${c.phase}.trigger.${c.caseId}.failure_code`,
    value: observed,
    status,
    note: note ?? `expected=${c.expected}`,
    created_at,
  };
  await storeResult(env, result);
  return result;
}

async function runScalarCheck(env: Env, run_id: string, c: ScalarCheck): Promise<DiagResult> {
  const created_at = nowEpochSec();
  let value: string | null = null;
  let note = `${c.note} expected ${c.compare} ${c.expected}`;
  let status: DiagStatus = "FAIL";
  try {
    const row = await env.DB.prepare(c.sql).first<{ value: number | string | null }>();
    const numeric = Number(row?.value ?? NaN);
    value = Number.isFinite(numeric) ? String(numeric) : String(row?.value ?? "");
    status = Number.isFinite(numeric) && compareScalar(numeric, c.compare, c.expected) ? "PASS" : "FAIL";
  } catch (e) {
    value = failureCodeFromError(errorText(e));
    note = errorText(e);
  }
  const result: DiagResult = { run_id, bus_id: diagBusIdFromKey(c.key, run_id), key: c.key, value, status, note, created_at };
  await storeResult(env, result);
  return result;
}

export async function handleDiag(req: Request, env: Env): Promise<Response> {
  const id = runId();
  const bus_ts = nowEpochSec();
  const results: DiagResult[] = [];

  for (const c of phase1aCases(id, bus_ts)) results.push(await runTriggerCase(env, id, c));
  for (const c of phase1bCases(id, bus_ts)) results.push(await runTriggerCase(env, id, c));
  for (const c of PHASE1C_SCALAR_CHECKS) results.push(await runScalarCheck(env, id, c));

  const summary = results.reduce((acc, r) => {
    acc.total += 1;
    acc[r.status.toLowerCase() as "pass" | "fail" | "warn" | "info"] += 1;
    return acc;
  }, { total: 0, pass: 0, fail: 0, warn: 0, info: 0 });

  const strict = new URL(req.url).searchParams.get("strict") === "1";
  const httpStatus = strict && summary.fail > 0 ? 500 : 200;
  return jsonResponse({ ok: summary.fail === 0, run_id: id, summary, results }, httpStatus);
}
