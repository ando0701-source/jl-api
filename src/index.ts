// src/index.ts
// Cloudflare Workers (module syntax) + D1 (SQLite)
// Storage unit ("record of truth"): 2PLT_BUS/v1 envelope serialized as JSON (bus_json).

type MsgType = "REQUEST" | "RESPONSE";
type InState = "NUL" | "PROPOSAL" | "COMMIT" | "UNRESOLVED" | "ABEND";
type OutState = "PROPOSAL" | "COMMIT" | "UNRESOLVED" | "ABEND";

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

interface TwoPltMessageV1 {
  schema_id: "2PLT_MESSAGE/v1";
  msg_type: MsgType;
  op_id: string;

  // flow identity
  flow: {
    owner_id: string;
    lane_id: string;
  };

  request_id: string;

  // state machine
  in_state: InState;
  state?: OutState;      // response only
  out_state?: OutState;  // response only

  // other fields may exist; keep permissive
  [k: string]: JsonValue;
}

interface TwoPltBusV1 {
  schema_id: "2PLT_BUS/v1";
  bus_id: string;
  bus_ts: number; // epoch seconds (preferred)

  // q_state is DB/queue specific. We'll normalize to 0 at enqueue time.
  q_state?: number;

  routing: {
    from_owner_id: string;
    to_owner_id: string;
    [k: string]: JsonValue;
  };

  // claim/done metadata may exist, but DB controls these for queue ops
  claimed_by?: string | null;
  claimed_at?: number | null;
  done_at?: number | null;

  message: TwoPltMessageV1;

  [k: string]: JsonValue;
}

interface Env {
  DB: D1Database;
  API_KEY?: string;
}

class BadRequestError extends Error {
  status = 400 as const;
}

function jsonResponse(obj: unknown, status = 200, extraHeaders?: Record<string, string>) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  return new Response(JSON.stringify(obj), { status, headers });
}

function textResponse(text: string, status = 200, extraHeaders?: Record<string, string>) {
  const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8", ...extraHeaders });
  return new Response(text, { status, headers });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-API-Key",
  };
}

function requireApiKey(request: Request, env: Env): Response | null {
  const key = request.headers.get("X-API-Key") || "";
  // fail-closed: if env.API_KEY is missing => unauthorized
  if (!env.API_KEY || key !== env.API_KEY) {
    return textResponse("unauthorized", 401, corsHeaders());
  }
  return null;
}

function toEpochSecondsMaybe(ts: unknown): number | null {
  // Accept:
  // - number (seconds or milliseconds)
  // - numeric string
  // - ISO-8601 string
  if (typeof ts === "number" && Number.isFinite(ts)) {
    // If someone accidentally provides milliseconds, convert.
    if (ts > 1e12) return Math.floor(ts / 1000);
    return Math.floor(ts);
  }

  if (typeof ts === "string") {
    const s = ts.trim();
    if (!s) return null;

    // numeric string
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return null;
      if (n > 1e12) return Math.floor(n / 1000);
      return Math.floor(n);
    }

    // ISO-8601 (or any Date.parse-able) string
    const ms = Date.parse(s);
    if (!Number.isFinite(ms)) return null;
    return Math.floor(ms / 1000);
  }

  return null;
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function isInState(x: unknown): x is InState {
  return x === "NUL" || x === "PROPOSAL" || x === "COMMIT" || x === "UNRESOLVED" || x === "ABEND";
}

function isOutState(x: unknown): x is OutState {
  return x === "PROPOSAL" || x === "COMMIT" || x === "UNRESOLVED" || x === "ABEND";
}

function normalizeBusV1Loose(x: any): { bus: TwoPltBusV1; bus_ts: number } {
  // Policy: "strict only on required fields".
  // - Validate the DB-required keys.
  // - Allow and preserve unknown keys at any depth.
  // - Sanitize a few fields to satisfy DB CHECK constraints.

  if (!x || typeof x !== "object") throw new BadRequestError("body must be a JSON object");

  // required
  if (x.schema_id !== "2PLT_BUS/v1") throw new BadRequestError("schema_id must be '2PLT_BUS/v1'");
  if (!isNonEmptyString(x.bus_id)) throw new BadRequestError("bus_id is required (non-empty string)");

  const bus_ts = toEpochSecondsMaybe(x.bus_ts);
  if (bus_ts === null) throw new BadRequestError("bus_ts is required (epoch seconds number/string or ISO-8601 string)");

  if (!x.routing || typeof x.routing !== "object") throw new BadRequestError("routing is required (object)");
  if (!isNonEmptyString(x.routing.from_owner_id)) throw new BadRequestError("routing.from_owner_id is required");
  if (!isNonEmptyString(x.routing.to_owner_id)) throw new BadRequestError("routing.to_owner_id is required");

  if (!x.message || typeof x.message !== "object") throw new BadRequestError("message is required (object)");
  if (x.message.schema_id !== "2PLT_MESSAGE/v1") throw new BadRequestError("message.schema_id must be '2PLT_MESSAGE/v1'");
  if (x.message.msg_type !== "REQUEST" && x.message.msg_type !== "RESPONSE") {
    throw new BadRequestError("message.msg_type must be REQUEST or RESPONSE");
  }
  if (!isNonEmptyString(x.message.op_id)) throw new BadRequestError("message.op_id is required");
  if (!x.message.flow || typeof x.message.flow !== "object") throw new BadRequestError("message.flow is required (object)");
  if (!isNonEmptyString(x.message.flow.owner_id)) throw new BadRequestError("message.flow.owner_id is required");
  if (!isNonEmptyString(x.message.flow.lane_id)) throw new BadRequestError("message.flow.lane_id is required");
  if (!isNonEmptyString(x.message.request_id)) throw new BadRequestError("message.request_id is required");
  if (!isInState(x.message.in_state)) throw new BadRequestError("message.in_state must be one of NUL|PROPOSAL|COMMIT|UNRESOLVED|ABEND");

  // Sanitize to satisfy DB CHECK constraints:
  // - REQUEST must have state/out_state NULL
  // - RESPONSE must have state and out_state, and out_state == state
  if (x.message.msg_type === "REQUEST") {
    // allow caller to send extra fields, but DB requires NULL
    delete x.message.state;
    delete x.message.out_state;
  } else {
    if (!isOutState(x.message.state)) throw new BadRequestError("RESPONSE requires message.state (PROPOSAL|COMMIT|UNRESOLVED|ABEND)");
    // If out_state is missing, auto-fill; if present but mismatched, reject.
    if (x.message.out_state == null) {
      x.message.out_state = x.message.state;
    }
    if (!isOutState(x.message.out_state)) throw new BadRequestError("RESPONSE requires message.out_state (PROPOSAL|COMMIT|UNRESOLVED|ABEND)");
    if (x.message.out_state !== x.message.state) {
      throw new BadRequestError("RESPONSE requires message.out_state == message.state");
    }
  }

  // Normalize bus_ts
  x.bus_ts = bus_ts;

  return { bus: x as TwoPltBusV1, bus_ts };
}

async function readJsonBody(request: Request): Promise<any> {
  const raw = await request.text();
  if (!raw || !raw.trim()) throw new Error("empty body");
  return JSON.parse(raw);
}

function getChanges(result: any): number {
  // D1 returns { meta: { changes, last_row_id, ... } }
  const changes = result?.meta?.changes;
  return typeof changes === "number" ? changes : 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // auth (fail closed)
    const authResp = requireApiKey(request, env);
    if (authResp) return authResp;

    const url = new URL(request.url);

    // ping (doesn't touch DB)
    if (url.pathname === "/ping" && request.method === "GET") {
      return textResponse("pong", 200, cors);
    }

    try {
      // =========================================================
      // POST /enqueue
      // body: 2PLT_BUS/v1 JSON object
      // =========================================================
      if (url.pathname === "/enqueue" && request.method === "POST") {
        const body = await readJsonBody(request);
        const { bus } = normalizeBusV1Loose(body);

        // Normalize queue fields at enqueue:
        bus.q_state = 0;
        bus.claimed_by = null;
        bus.claimed_at = null;
        bus.done_at = null;

        const bus_json = JSON.stringify(bus);

        const msg = bus.message;

        // q_state is fixed to 0 at insert time (pending)
        const stmt = env.DB.prepare(
          `INSERT OR IGNORE INTO bus_messages(
            schema_id,bus_id,bus_ts,q_state,
            from_owner_id,to_owner_id,
            claimed_by,claimed_at,done_at,
            message_schema_id,
            msg_type,op_id,
            flow_owner_id,lane_id,request_id,
            in_state,state,out_state,
            bus_json
          ) VALUES (
            '2PLT_BUS/v1', ?, ?, 0,
            ?, ?,
            NULL,NULL,NULL,
            '2PLT_MESSAGE/v1',
            ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?
          )`
        ).bind(
          bus.bus_id,
          bus.bus_ts,
          bus.routing.from_owner_id,
          bus.routing.to_owner_id,
          msg.msg_type,
          msg.op_id,
          msg.flow.owner_id,
          msg.flow.lane_id,
          msg.request_id,
          msg.in_state,
          (msg.msg_type === "RESPONSE" ? (msg.state ?? null) : null),
          (msg.msg_type === "RESPONSE" ? (msg.out_state ?? null) : null),
          bus_json
        );

        const res = await stmt.run();
        const inserted = getChanges(res) === 1;

        return jsonResponse(
          {
            ok: true,
            bus_id: bus.bus_id,
            duplicate: !inserted,
            bus_ts: bus.bus_ts,
            q_state: 0,
          },
          200,
          cors
        );
      }

      // =========================================================
      // GET /dequeue?owner_id=...(&claimed_by=...)
      // - Select one pending item for "to_owner_id=owner_id"
      // - Claim it by setting claimed_by/claimed_at
      // =========================================================
      if (url.pathname === "/dequeue" && request.method === "GET") {
        const owner_id = url.searchParams.get("owner_id") || "";
        if (!isNonEmptyString(owner_id)) {
          return jsonResponse({ ok: false, error: "owner_id is required" }, 400, cors);
        }
        const claimed_by = url.searchParams.get("claimed_by") || owner_id;

        for (let i = 0; i < 5; i++) {
          const pick = await env.DB.prepare(
            `SELECT bus_id
             FROM bus_messages
             WHERE to_owner_id = ? AND q_state = 0 AND claimed_by IS NULL
             ORDER BY bus_ts ASC, inserted_at ASC
             LIMIT 1`
          ).bind(owner_id).first<{ bus_id: string }>();

          if (!pick?.bus_id) {
            return jsonResponse({ ok: true, found: false }, 200, cors);
          }

          const upd = await env.DB.prepare(
            `UPDATE bus_messages
             SET claimed_by = ?, claimed_at = unixepoch()
             WHERE bus_id = ? AND q_state = 0 AND claimed_by IS NULL`
          ).bind(claimed_by, pick.bus_id).run();

          if (getChanges(upd) === 1) {
            const row = await env.DB.prepare(
              `SELECT bus_id, bus_ts, q_state, from_owner_id, to_owner_id,
                      claimed_by, claimed_at, done_at,
                      msg_type, op_id, flow_owner_id, lane_id, request_id,
                      in_state, state, out_state,
                      bus_json, inserted_at
               FROM bus_messages
               WHERE bus_id = ?`
            ).bind(pick.bus_id).first<any>();

            const bus = row?.bus_json ? JSON.parse(row.bus_json) : null;

            return jsonResponse(
              {
                ok: true,
                found: true,
                row: { ...row, bus_json: undefined },
                bus,
              },
              200,
              cors
            );
          }
        }

        // If we couldn't claim after retries, treat as empty for caller simplicity.
        return jsonResponse({ ok: true, found: false, retry_exhausted: true }, 200, cors);
      }

      // =========================================================
      // POST /finalize
      // body: { bus_id: string, q_state: 1|9 }
      // =========================================================
      if (url.pathname === "/finalize" && request.method === "POST") {
        const body = await readJsonBody(request);
        const bus_id = body?.bus_id;
        const q_state = body?.q_state;

        if (!isNonEmptyString(bus_id)) {
          return jsonResponse({ ok: false, error: "bus_id is required" }, 400, cors);
        }
        if (q_state !== 1 && q_state !== 9) {
          return jsonResponse({ ok: false, error: "q_state must be 1 (DONE) or 9 (DEAD)" }, 400, cors);
        }

        const upd = await env.DB.prepare(
          `UPDATE bus_messages
           SET q_state = ?, done_at = unixepoch()
           WHERE bus_id = ?`
        ).bind(q_state, bus_id).run();

        if (getChanges(upd) !== 1) {
          return jsonResponse({ ok: false, error: "not found", bus_id }, 404, cors);
        }

        return jsonResponse({ ok: true, bus_id, q_state }, 200, cors);
      }

      return textResponse("not found", 404, cors);
    } catch (e: any) {
      const status = typeof e?.status === "number" ? e.status : 500;
      return jsonResponse({ ok: false, error: String(e?.message ?? e) }, status, cors);
    }
  },
};
