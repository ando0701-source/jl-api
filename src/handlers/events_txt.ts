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

  const rawEventCode = (url.searchParams.get("event_code") || "ALL").trim();
  const eventCodes = rawEventCode === "" || rawEventCode.toUpperCase() === "ALL"
    ? null
    : rawEventCode.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (eventCodes && eventCodes.length > 20) {
    throw new HttpError(400, "too_many_event_codes", "event_code list is too long", { count: eventCodes.length });
  }

  const whereCode = eventCodes && eventCodes.length ? `WHERE e.event_code IN (${eventCodes.map(() => "?").join(",")})` : "";
  const bindParams: any[] = [];
  if (eventCodes && eventCodes.length) bindParams.push(...eventCodes);
  bindParams.push(limit);

  const sql = `
SELECT
  e.event_id,
  e.event_code,
  COALESCE(bc.severity, c.severity) AS severity,
  COALESCE(bc.message_template, c.message) AS message,
  e.event_ts,
  e.flow_owner_id,
  e.lane_id,
  e.request_id,
  e.op_id,
  e.bus_id,
  e.actor_owner_id,
  e.data
FROM v_events_all e
LEFT JOIN bus_events_catalog bc
  ON bc.event_code = e.event_code
LEFT JOIN event_catalog c
  ON c.event_code = e.event_code
${whereCode}
ORDER BY e.event_ts ${orderSql}, e.event_id ${orderSql}
LIMIT ?`;


  const r = await env.DB.prepare(sql).bind(...bindParams).all<any>();

  const header = [
    "event_id",
    "event_code",
    "severity",
    "message",
    "event_ts",
    "flow_owner_id",
    "lane_id",
    "request_id",
    "op_id",
    "bus_id",
    "actor_owner_id",
    "data",
  ].join("\t");

  const rows = (r.results || []).map((row: any) => {
        const vals = [
      row.event_id,
      row.event_code,
      row.severity,
      row.message,
      row.event_ts,
      row.flow_owner_id,
      row.lane_id,
      row.request_id,
      row.op_id,
      row.bus_id,
      row.actor_owner_id,
      row.data,
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