import { Env } from "../lib/types";
import { HttpError, jsonResponse, corsHeaders } from "../lib/http";
import { BUILD_ID } from "../lib/build";

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeJsonParse(raw: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    const v = JSON.parse(raw);
    if (typeof v === "string") {
      // handle double-encoded JSON (rare)
      return { ok: true, value: JSON.parse(v) };
    }
    return { ok: true, value: v };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function handleBusJson(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const busId = url.searchParams.get("bus_id") ?? url.searchParams.get("busId");
  const sync = url.searchParams.get("sync") === "1";
  const full = url.searchParams.get("full") === "1";

  if (!busId) {
    throw new HttpError(400, "missing_bus_id", "Query bus_id is required");
  }

  const row: any = await env.DB.prepare(
    `SELECT bus_id, q_state, done_at, bus_json FROM bus_messages WHERE bus_id = ?`
  ).bind(busId).first();

  if (!row) {
    throw new HttpError(404, "not_found", "bus_id not found", { bus_id: busId });
  }

  const qStateCol = toNum(row.q_state);
  const doneAtCol = toNum(row.done_at);

  let raw = String(row.bus_json ?? "");
  let parsed: any = null;
  let parseError: string | null = null;

  const p = safeJsonParse(raw);
  if (p.ok) parsed = p.value;
  else parseError = p.error;

  let syncResult: any = null;
  if (sync) {
    if (!p.ok || !parsed || typeof parsed !== "object") {
      syncResult = { ok: false, error: "parse_failed", parse_error: parseError };
    } else {
      try {
        parsed.q_state = qStateCol;
        if (doneAtCol !== null) parsed.done_at = doneAtCol;
        else if ("done_at" in parsed) delete parsed.done_at;

        const newRaw = JSON.stringify(parsed);
        const r = await env.DB.prepare(
          `UPDATE bus_messages SET bus_json = ? WHERE bus_id = ?`
        ).bind(newRaw, busId).run();

        // re-read for confirmation
        const row2: any = await env.DB.prepare(
          `SELECT bus_json FROM bus_messages WHERE bus_id = ?`
        ).bind(busId).first();

        raw = String(row2?.bus_json ?? newRaw);
        const p2 = safeJsonParse(raw);
        if (p2.ok) {
          parsed = p2.value;
          parseError = null;
        } else {
          parsed = null;
          parseError = p2.error;
        }

        syncResult = {
          ok: true,
          changes: r.meta?.changes ?? null,
          bus_json_q_state_after: (parsed && typeof parsed === "object") ? (parsed as any).q_state : null,
          bus_json_has_done_at_after: (parsed && typeof parsed === "object") ? ("done_at" in parsed) : null,
        };
      } catch (e: any) {
        syncResult = { ok: false, error: "db_update_failed", message: String(e?.message ?? e) };
      }
    }
  }

  const summary: any = {
    ok: true,
    build_id: BUILD_ID,
    bus_id: busId,
    row: { q_state: qStateCol, done_at: doneAtCol },
    bus_json: {
      parse_ok: p.ok,
      parse_error: parseError,
      q_state: (p.ok && parsed && typeof parsed === "object") ? (parsed as any).q_state : null,
      has_done_at: (p.ok && parsed && typeof parsed === "object") ? ("done_at" in parsed) : null,
    },
    sync: syncResult,
  };

  if (full) {
    summary.bus_json.raw = raw;
    summary.bus_json.parsed = parsed;
  }

  return jsonResponse(summary, 200, {
    "Cache-Control": "no-store",
    ...corsHeaders(),
  });
}
