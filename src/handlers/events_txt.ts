import { Env } from "../lib/types";
import { HttpError, corsHeaders, noCacheHeaders } from "../lib/http";

function escapeTsvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  s = s.replace(/\\/g, "\\\\");
  s = s.replace(/\t/g, "\\t");
  s = s.replace(/\r/g, "\\r");
  s = s.replace(/\n/g, "\\n");
  return s;
}

function parseLimit(url: URL, def: number, max: number): number {
  const raw = url.searchParams.get("limit");
  if (!raw) return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

function parseOrder(url: URL): "asc" | "desc" {
  const o = (url.searchParams.get("order") || "").toLowerCase();
  return o === "asc" ? "asc" : "desc";
}

export async function handleEventsTxt(req: Request, env: Env): Promise<Response> {
  // Public, but hard-gated. Use either EVENTS_LITE=1 or DEBUG_LITE=1.
  if (env.EVENTS_LITE !== "1" && env.DEBUG_LITE !== "1") {
    return new Response("not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders(), ...noCacheHeaders() },
    });
  }

  const url = new URL(req.url);
  const limit = parseLimit(url, 200, 2000);
  const order = parseOrder(url);
  const orderSql = order === "asc" ? "ASC" : "DESC";

  const eventCode = (url.searchParams.get("event_code") || "LANE_MISMATCH").trim();
  if (eventCode !== "LANE_MISMATCH") {
    throw new HttpError(400, "unsupported_event_code", "Only LANE_MISMATCH is supported for now", { event_code: eventCode });
  }

  const sql = `
SELECT
  e.event_id,
  e.event_code,
  c.severity,
  c.message,
  e.event_ts,
  e.flow_owner_id,
  e.request_id,
  e.op_id,
  e.request_bus_id,
  e.expected_lane_id,
  e.observed_lane_id,
  e.response_from_owner_id,
  e.response_to_owner_id,
  e.response_bus_id
FROM v_event_lane_mismatch e
LEFT JOIN event_catalog c
  ON c.event_code = e.event_code
ORDER BY e.event_ts ${orderSql}, e.event_id ${orderSql}
LIMIT ?`;

  const r = await env.DB.prepare(sql).bind(limit).all<any>();

  const header = [
    "event_id",
    "event_code",
    "severity",
    "message",
    "event_ts",
    "flow_owner_id",
    "request_id",
    "op_id",
    "request_bus_id",
    "expected_lane_id",
    "observed_lane_id",
    "response_from_owner_id",
    "response_to_owner_id",
    "response_bus_id",
  ].join("\t");

  const rows = (r.results || []).map((row: any) => {
    const vals = [
      row.event_id,
      row.event_code,
      row.severity,
      row.message,
      row.event_ts,
      row.flow_owner_id,
      row.request_id,
      row.op_id,
      row.request_bus_id,
      row.expected_lane_id,
      row.observed_lane_id,
      row.response_from_owner_id,
      row.response_to_owner_id,
      row.response_bus_id,
    ];
    return vals.map(escapeTsvCell).join("\t");
  });

  const body = [header, ...rows].join("\n") + "\n";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...corsHeaders(),
      ...noCacheHeaders(),
    },
  });
}
