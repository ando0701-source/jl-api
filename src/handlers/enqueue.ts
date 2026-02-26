import { Env } from "../lib/types";
import { readJson, jsonResponse } from "../lib/http";
import { validateBusLoose } from "../lib/validate";

export async function handleEnqueue(req: Request, env: Env): Promise<Response> {
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
