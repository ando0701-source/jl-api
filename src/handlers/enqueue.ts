import { Env } from "../lib/types";
import { readJson, jsonResponse, HttpError } from "../lib/http";
import { validateBusLoose } from "../lib/validate";
import { dbg, isDebugLiteEnabled } from "../lib/debug_lite";

export async function handleEnqueue(req: Request, env: Env): Promise<Response> {
  const dbgEnabled = isDebugLiteEnabled(req, env);

  const bus = await readJson(req);
  const x = validateBusLoose(bus);

  // Canonicalize stored bus record (include transport queue fields)
  const busObj: any = x.bus_obj;

  // Force enqueue-time queue fields
  const q_state = "PENDING";
  const claimed_by = null;
  const claimed_at = null;
  const done_at = null;

  busObj.q_state = q_state;
  busObj.claimed_by = claimed_by;
  busObj.claimed_at = claimed_at;
  busObj.done_at = done_at;

  const bus_json = JSON.stringify(busObj);

  await dbg(env, dbgEnabled, "enqueue_in", {
    bus_id: x.bus_id,
    msg_type: x.msg_type,
    op_id: x.op_id,
    lane_id: x.lane_id,
    request_id: x.request_id,
    in_state: x.in_state,
    state: x.state,
    out_state: x.out_state,
  });

  const stmt = env.DB.prepare(
    `INSERT INTO bus_messages(
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
    bus_json
  );

  try {
    const r: any = await stmt.run();
    const changes = (r && r.meta && typeof r.meta.changes === "number") ? r.meta.changes : undefined;
    await dbg(env, dbgEnabled, "enqueue_ok", { bus_id: x.bus_id, changes, meta: r && r.meta ? r.meta : null });
    return jsonResponse({ ok: true, bus_id: x.bus_id, duplicate: false, bus_ts: x.bus_ts, q_state });
  } catch (e: any) {
    // Distinguish duplicate (bus_id already exists) vs other constraint failures.
    const exists = await env.DB.prepare("SELECT 1 AS one FROM bus_messages WHERE bus_id = ? LIMIT 1")
      .bind(x.bus_id)
      .all<any>();
    const isDup = (exists.results || []).length > 0;

    const errMsg = (e && (e.message || e.toString())) ? String(e.message || e.toString()) : "unknown_error";
    await dbg(env, dbgEnabled, "enqueue_error", { bus_id: x.bus_id, is_duplicate: isDup, error: errMsg });

    if (isDup) {
      return jsonResponse({ ok: true, bus_id: x.bus_id, duplicate: true, bus_ts: x.bus_ts, q_state });
    }

    throw new HttpError(400, "enqueue_constraint_failed", "enqueue failed by DB constraint", { error: errMsg });
  }
}
