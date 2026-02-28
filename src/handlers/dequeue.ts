import { Env } from "../lib/types";
import { HttpError, jsonResponse } from "../lib/http";
import { nowEpochSec } from "../lib/util";

async function patchBusJsonClaim(env: Env, busId: string, claimedBy: string, claimedAt: number): Promise<void> {
  // Keep stored 2PLT_BUS/v1 JSON consistent with mutable DB columns.
  // We update only schema fields (claimed_by, claimed_at) and never inject non-schema data.
  try {
    const row = await env.DB.prepare(
      `SELECT bus_json FROM bus_messages WHERE bus_id = ?`
    ).bind(busId).first();

    if (!row || (row as any).bus_json == null) return;

    const busObj: any = JSON.parse(String((row as any).bus_json));
    busObj.claimed_by = claimedBy;
    busObj.claimed_at = claimedAt;

    await env.DB.prepare(
      `UPDATE bus_messages SET bus_json = ? WHERE bus_id = ?`
    ).bind(JSON.stringify(busObj), busId).run();
  } catch (_) {
    // best-effort; never fail dequeue
  }
}

export async function handleDequeue(req: Request, env: Env): Promise<Response> {
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

    const busId = String((row as any).bus_id);
    await patchBusJsonClaim(env, busId, claimedBy, now);

    let busObj: any = null;
    try {
      busObj = JSON.parse(String((row as any).bus_json));
      // Ensure returned "bus" reflects the claimed metadata even if DB json patch is delayed.
      busObj.claimed_by = claimedBy;
      busObj.claimed_at = now;
    } catch (_) {
      busObj = null;
    }

    return jsonResponse({
      ok: true,
      found: true,
      row,
      bus: busObj,
    });
  } catch (_) {
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

      await patchBusJsonClaim(env, busId, claimedBy, now);

      const row = await env.DB.prepare(
        `SELECT bus_id,bus_ts,q_state,from_owner_id,to_owner_id,claimed_by,claimed_at,done_at,
                message_schema_id,msg_type,op_id,flow_owner_id,lane_id,request_id,in_state,state,out_state,bus_json,inserted_at
         FROM bus_messages
         WHERE bus_id = ?`
      ).bind(busId).first();

      if (!row) throw new HttpError(500, "inconsistent_state", "Claimed row not found after update");

      let busObj: any = null;
      try {
        busObj = JSON.parse(String((row as any).bus_json));
        busObj.claimed_by = claimedBy;
        busObj.claimed_at = now;
      } catch (_) {
        busObj = null;
      }

      return jsonResponse({
        ok: true,
        found: true,
        row,
        bus: busObj,
      });
    }
    return jsonResponse({ ok: true, found: false });
  }
}
