// src/index.ts
// Cloudflare Workers (TypeScript) + D1 (SQLite)
// Storage unit of truth: 2PLT_BUS/v1 (bus_json)
// Policy: validate only required fields; preserve unknown fields in bus_json.
// Optional stealth mode: set env.STEALTH_404="1" to return 404 for auth failures.

export interface Env {
  DB: D1Database;
  API_KEY?: string;
  STEALTH_404?: string; // "1" => unauthorized -> 404
}

type JsonValue = any;

class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function textResponse(body: string, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function nowEpochSec(): number {
  return Math.floor(Date.now() / 1000);
}

function stripUtf8Bom(s: string): string {
  // UTF-8 BOM: \uFEFF
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

async function readJson(req: Request, maxBytes = 1024 * 1024): Promise<JsonValue> {
  const text = stripUtf8Bom(await req.text());
  if (!text) throw new HttpError(400, "empty_body", "Request body is empty");
  if (text.length > maxBytes) throw new HttpError(413, "body_too_large", "Request body is too large", { maxBytes });

  // Normal JSON
  try {
    return JSON.parse(text);
  } catch (e) {
    // In some Windows/cmd.exe cases, users accidentally send a JSON string like "{\"a\":1}"
    // We *optionally* accept that by a single unwrapping attempt.
    try {
      const v = JSON.parse(text.replace(/\r\n/g, "\n"));
      if (typeof v === "string") {
        return JSON.parse(v);
      }
    } catch (_) {
      // ignore
    }
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON");
  }
}

function getPath(obj: any, path: string): any {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function requireFields(obj: any, paths: string[]): void {
  const missing: string[] = [];
  for (const p of paths) {
    const v = getPath(obj, p);
    if (v === undefined || v === null || v === "") missing.push(p);
  }
  if (missing.length) {
    throw new HttpError(400, "missing_fields", "Missing required fields", { missing });
  }
}

function normalizeBusTs(busTs: unknown): number {
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
    if (!t) throw new HttpError(400, "invalid_bus_ts", "bus_ts is empty");
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (!Number.isFinite(n)) throw new HttpError(400, "invalid_bus_ts", "bus_ts is not a valid number");
      if (n >= 1e12) return Math.floor(n / 1000);
      return Math.floor(n);
    }
    const ms = Date.parse(t);
    if (!Number.isFinite(ms)) throw new HttpError(400, "invalid_bus_ts", "bus_ts is not a valid ISO-8601 datetime");
    return Math.floor(ms / 1000);
  }
  throw new HttpError(400, "invalid_bus_ts", "bus_ts must be number or string");
}

function authOrStealth404(req: Request, env: Env): void {
  const apiKey = env.API_KEY;
  const given = req.headers.get("X-API-Key");
  const ok = !!apiKey && !!given && given === apiKey;
  if (!ok) {
    if (env.STEALTH_404 === "1") {
      throw new HttpError(404, "not_found", "Not Found");
    }
    throw new HttpError(401, "unauthorized", "Unauthorized");
  }
}

function isKnownRoute(pathname: string): boolean {
  return pathname === "/ping" || pathname === "/enqueue" || pathname === "/dequeue" || pathname === "/finalize";
}

function validateBusLoose(bus: any): {
  schema_id: string;
  bus_id: string;
  bus_ts: number;
  from_owner_id: string;
  to_owner_id: string;
  message_schema_id: string;
  msg_type: "REQUEST" | "RESPONSE";
  op_id: string;
  flow_owner_id: string;
  lane_id: string;
  request_id: string;
  in_state: string;
  state: string | null;
  out_state: string | null;
  bus_json: string;
} {
  if (bus == null || typeof bus !== "object") {
    throw new HttpError(400, "invalid_body", "Body must be a JSON object");
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
  if (schema_id !== "2PLT_BUS/v1") throw new HttpError(400, "invalid_schema_id", "schema_id must be 2PLT_BUS/v1");

  const bus_id = String(bus.bus_id);
  const bus_ts = normalizeBusTs(bus.bus_ts);

  const from_owner_id = String(bus.routing.from_owner_id);
  const to_owner_id = String(bus.routing.to_owner_id);

  const message_schema_id = String(bus.message.schema_id);
  if (message_schema_id !== "2PLT_MESSAGE/v1") {
    throw new HttpError(400, "invalid_message_schema_id", "message.schema_id must be 2PLT_MESSAGE/v1");
  }

  const msg_type_raw = String(bus.message.msg_type);
  if (msg_type_raw !== "REQUEST" && msg_type_raw !== "RESPONSE") {
    throw new HttpError(400, "invalid_msg_type", "message.msg_type must be REQUEST or RESPONSE");
  }
  const msg_type = msg_type_raw as "REQUEST" | "RESPONSE";

  const op_id = String(bus.message.op_id);
  const flow_owner_id = String(bus.message.flow.owner_id);
  const lane_id = String(bus.message.flow.lane_id);
  const request_id = String(bus.message.request_id);
  const in_state = String(bus.message.in_state);

  // Normalize response-only fields for DB constraints
  let state: string | null = null;
  let out_state: string | null = null;

  if (msg_type === "REQUEST") {
    // Enforce DB CHECK: state/out_state must be NULL for REQUEST
    if (bus.message.state != null) delete bus.message.state;
    if (bus.message.out_state != null) delete bus.message.out_state;
    state = null;
    out_state = null;

    // Optional minimal consistency: request's to_owner should match flow.owner
    // (You can relax this later if you want.)
    if (to_owner_id !== flow_owner_id) {
      throw new HttpError(400, "routing_flow_mismatch", "routing.to_owner_id must match message.flow.owner_id for REQUEST", {
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
      throw new HttpError(400, "out_state_mismatch", "message.out_state must equal message.state for RESPONSE", {
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
    bus_json,
  };
}

async function handleEnqueue(req: Request, env: Env): Promise<Response> {
  const bus = await readJson(req);
  const x = validateBusLoose(bus);

  // Force enqueue-time queue fields
  const q_state = 0;
  const claimed_by = null;
  const claimed_at = null;
  const done_at = null;

  const stmt = env.DB.prepare(
    `INSERT OR IGNORE INTO bus_messages(
      schema_id,bus_id,bus_ts,q_state,
      from_owner_id,to_owner_id,
      claimed_by,claimed_at,done_at,
      message_schema_id,msg_type,op_id,
      flow_owner_id,lane_id,request_id,
      in_state,state,out_state,
      bus_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    x.schema_id, x.bus_id, x.bus_ts, q_state,
    x.from_owner_id, x.to_owner_id,
    claimed_by, claimed_at, done_at,
    x.message_schema_id, x.msg_type, x.op_id,
    x.flow_owner_id, x.lane_id, x.request_id,
    x.in_state, x.state, x.out_state,
    x.bus_json
  );

  const r = await stmt.run();
  const duplicate = (r.meta?.changes ?? 0) === 0;

  return jsonResponse({
    ok: true,
    bus_id: x.bus_id,
    duplicate,
    bus_ts: x.bus_ts,
    q_state,
  });
}

async function handleDequeue(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const ownerId = url.searchParams.get("owner_id");
  if (!ownerId) throw new HttpError(400, "missing_owner_id", "owner_id is required");

  const claimedBy = url.searchParams.get("claimed_by") || ownerId;
  const now = nowEpochSec();

  // Try single-statement claim+return first (SQLite RETURNING)
  try {
    const row = await env.DB.prepare(
      `UPDATE bus_messages
       SET claimed_by = ?, claimed_at = ?
       WHERE bus_id = (
         SELECT bus_id FROM bus_messages
         WHERE q_state = 0 AND to_owner_id = ? AND claimed_by IS NULL
         ORDER BY bus_ts ASC, inserted_at ASC
         LIMIT 1
       )
       AND claimed_by IS NULL
       RETURNING bus_id,bus_ts,q_state,from_owner_id,to_owner_id,claimed_by,claimed_at,done_at,
                 message_schema_id,msg_type,op_id,flow_owner_id,lane_id,request_id,in_state,state,out_state,bus_json,inserted_at`
    ).bind(claimedBy, now, ownerId).first();

    if (!row) return jsonResponse({ ok: true, found: false });

    // row.bus_json is full bus
    return jsonResponse({
      ok: true,
      found: true,
      row,
      bus: JSON.parse(String((row as any).bus_json)),
    });
  } catch (e) {
    // Fallback: 2-step claim (select -> update -> reselect), with small retry for contention.
    for (let attempt = 0; attempt < 3; attempt++) {
      const picked = await env.DB.prepare(
        `SELECT bus_id FROM bus_messages
         WHERE q_state = 0 AND to_owner_id = ? AND claimed_by IS NULL
         ORDER BY bus_ts ASC, inserted_at ASC
         LIMIT 1`
      ).bind(ownerId).first();

      if (!picked) return jsonResponse({ ok: true, found: false });

      const busId = String((picked as any).bus_id);

      const upd = await env.DB.prepare(
        `UPDATE bus_messages
         SET claimed_by = ?, claimed_at = ?
         WHERE bus_id = ? AND claimed_by IS NULL`
      ).bind(claimedBy, now, busId).run();

      if ((upd.meta?.changes ?? 0) === 0) continue; // lost race; retry

      const row = await env.DB.prepare(
        `SELECT bus_id,bus_ts,q_state,from_owner_id,to_owner_id,claimed_by,claimed_at,done_at,
                message_schema_id,msg_type,op_id,flow_owner_id,lane_id,request_id,in_state,state,out_state,bus_json,inserted_at
         FROM bus_messages
         WHERE bus_id = ?`
      ).bind(busId).first();

      if (!row) throw new HttpError(500, "inconsistent_state", "Claimed row not found after update");

      return jsonResponse({
        ok: true,
        found: true,
        row,
        bus: JSON.parse(String((row as any).bus_json)),
      });
    }
    return jsonResponse({ ok: true, found: false });
  }
}

async function handleFinalize(req: Request, env: Env): Promise<Response> {
  const body = await readJson(req);
  if (body == null || typeof body !== "object") throw new HttpError(400, "invalid_body", "Body must be a JSON object");

  requireFields(body, ["bus_id", "q_state"]);
  const busId = String((body as any).bus_id);

  const q = Number((body as any).q_state);
  if (![1, 9].includes(q)) throw new HttpError(400, "invalid_q_state", "q_state must be 1 (DONE) or 9 (DEAD)");

  const doneAt = nowEpochSec();

  const r = await env.DB.prepare(
    `UPDATE bus_messages
     SET q_state = ?, done_at = ?
     WHERE bus_id = ?`
  ).bind(q, doneAt, busId).run();

  if ((r.meta?.changes ?? 0) === 0) {
    throw new HttpError(404, "not_found", "bus_id not found", { bus_id: busId });
  }

  return jsonResponse({ ok: true, bus_id: busId, q_state: q, done_at: doneAt });
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Unknown routes: always 404 (no auth check)
  if (!isKnownRoute(path)) {
    return textResponse("not found", 404);
  }

  // Known routes: enforce auth (or stealth 404)
  authOrStealth404(req, env);

  // Methods & handlers
  if (path === "/ping") {
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET");
    return textResponse("pong", 200);
  }

  if (path === "/enqueue") {
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST");
    return await handleEnqueue(req, env);
  }

  if (path === "/dequeue") {
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET");
    return await handleDequeue(req, env);
  }

  if (path === "/finalize") {
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST");
    return await handleFinalize(req, env);
  }

  return textResponse("not found", 404);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(req, env);
    } catch (e: any) {
      // Always respond with JSON error (avoid "connection reset" style symptoms)
      if (e instanceof HttpError) {
        // If STEALTH_404, unauthorized is already translated to 404 by throwing HttpError(404)
        return jsonResponse(
          { ok: false, error: { code: e.code, message: e.message, details: e.details } },
          e.status
        );
      }
      console.error("UNHANDLED_ERROR", e);
      return jsonResponse(
        { ok: false, error: { code: "internal_error", message: "Internal Server Error" } },
        500
      );
    }
  },
};
