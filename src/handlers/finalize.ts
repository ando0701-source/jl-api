import { HttpError, jsonResponse } from "../lib/http";
import { nowEpochSec } from "../lib/util";
import { Env } from "../lib/types";
import { readJson } from "../lib/http";

function extractFinalizeInput(body: any): { busId: string; qState: number } {
  if (body == null || typeof body !== "object") {
    throw new HttpError(400, "invalid_body", "Body must be a JSON object");
  }

  const candidates: Array<{ obj: any; label: string }> = [
    { obj: body, label: "$" },
    { obj: (body as any).row, label: "$.row" }, // supports snapshot from /dequeue response
  ];

  let busIdVal: any = undefined;
  let busIdPath: string | null = null;
  let qVal: any = undefined;
  let qPath: string | null = null;

  for (const c of candidates) {
    if (busIdVal === undefined && c.obj && typeof c.obj === "object" && (c.obj as any).bus_id !== undefined) {
      busIdVal = (c.obj as any).bus_id;
      busIdPath = `${c.label}.bus_id`;
    }
    if (qVal === undefined && c.obj && typeof c.obj === "object" && (c.obj as any).q_state !== undefined) {
      qVal = (c.obj as any).q_state;
      qPath = `${c.label}.q_state`;
    }
  }

  const missing: string[] = [];
  if (busIdVal === undefined || busIdVal === null || busIdVal === "") missing.push("bus_id");
  if (qVal === undefined || qVal === null || qVal === "") missing.push("q_state");
  if (missing.length) {
    throw new HttpError(400, "missing_fields", "Missing required fields", {
      missing,
      searched: candidates.map((c) => c.label),
      found_paths: { bus_id: busIdPath, q_state: qPath },
    });
  }

  const busId = String(busIdVal);
  const q = Number(qVal);
  if (!Number.isFinite(q)) {
    throw new HttpError(400, "invalid_q_state", "q_state must be a number", { q_state: qVal, path: qPath });
  }
  return { busId, qState: q };
}

export async function handleFinalize(req: Request, env: Env): Promise<Response> {
  const body = await readJson(req);

  // Accept either:
  // - { bus_id, q_state }
  // - snapshot from /dequeue: { ok, found, row: { bus_id, q_state, ... } }
  const { busId, qState } = extractFinalizeInput(body);

  if (![1, 9].includes(qState)) {
    throw new HttpError(400, "invalid_q_state", "q_state must be 1 (DONE) or 9 (DEAD)", { q_state: qState });
  }

  const doneAt = nowEpochSec();

  const r = await env.DB.prepare(
    `UPDATE bus_messages
     SET q_state = ?, done_at = ?
     WHERE bus_id = ?`
  ).bind(qState, doneAt, busId).run();

  if ((r.meta?.changes ?? 0) === 0) {
    throw new HttpError(404, "not_found", "bus_id not found", { bus_id: busId });
  }

  // Keep stored 2PLT_BUS/v1 JSON consistent with mutable DB columns.
  // Primary objective: ensure $.q_state matches bus_messages.q_state.
  // We avoid injecting non-schema fields (claimed_by/done_at) into bus_json.
  try {
    // Prefer SQLite JSON1: fast, avoids JS parsing pitfalls.
    await env.DB.prepare(
      `UPDATE bus_messages
       SET bus_json = json_set(bus_json, '$.q_state', ?)
       WHERE bus_id = ? AND bus_json IS NOT NULL`
    ).bind(qState, busId).run();
  } catch (_) {
    // Fallback: best-effort JS patch; never fail finalize due to bus_json.
    try {
      const row = await env.DB.prepare(
        `SELECT bus_id,q_state,bus_json FROM bus_messages WHERE bus_id = ?`
      ).bind(busId).first();

      if (row && (row as any).bus_json != null) {
        const busObj: any = JSON.parse(String((row as any).bus_json));
        busObj.q_state = (row as any).q_state;
        await env.DB.prepare(`UPDATE bus_messages SET bus_json = ? WHERE bus_id = ?`)
          .bind(JSON.stringify(busObj), String((row as any).bus_id))
          .run();
      }
    } catch (_) {
      // swallow
    }
  }

  return jsonResponse({ ok: true, bus_id: busId, q_state: qState, done_at: doneAt });
}
