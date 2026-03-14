import { Env } from "../lib/types";
import { HttpError, corsHeaders, noCacheHeaders, API_ERROR_CODES } from "../lib/http";
import { ENV_CONFIG_KEYS, ENV_SWITCH_ENABLED } from "../lib/config";
import { QUERY_PARAM_KEYS } from "../lib/query";

function escapeTsvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  s = s.replace(/\\/g, "\\\\");
  s = s.replace(/\t/g, "\\t");
  s = s.replace(/\r/g, "\\r");
  s = s.replace(/\n/g, "\\n");
  return s;
}

function rowsToTsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(escapeTsvCell).join("\t")).join("\n") + "\n";
}

async function ensureTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS debug_events (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      kind TEXT NOT NULL,
      data TEXT
    )`
  ).run();
}

export async function handleDebugTxt(req: Request, env: Env): Promise<Response> {
  if (env[ENV_CONFIG_KEYS.DEBUG_LITE] !== ENV_SWITCH_ENABLED) {
    return new Response("not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders(), ...noCacheHeaders() },
    });
  }

  const url = new URL(req.url);

  const limitRaw = url.searchParams.get(QUERY_PARAM_KEYS.LIMIT);
  let limit = 500;
  if (limitRaw !== null && limitRaw !== "") {
    const n = Number(limitRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      throw new HttpError(400, API_ERROR_CODES.INVALID_LIMIT, "limit must be a positive integer");
    }
    limit = n;
  }
  if (limit > 5000) limit = 5000;

  const orderRaw = (url.searchParams.get(QUERY_PARAM_KEYS.ORDER) || "asc").toLowerCase();
  let orderSql: "ASC" | "DESC" = "ASC";
  if (orderRaw === "desc") orderSql = "DESC";
  else if (orderRaw !== "asc") throw new HttpError(400, API_ERROR_CODES.INVALID_ORDER, "order must be 'asc' or 'desc'");

  await ensureTable(env);

  const sql = `SELECT ts,kind,data FROM debug_events ORDER BY ts ${orderSql}, id ${orderSql} LIMIT ?`;

  let rows: any[] = [];
  try {
    const r = await env.DB.prepare(sql).bind(limit).all<any>();
    rows = (r.results || []) as any[];
  } catch {
    rows = [];
  }

  const out: unknown[][] = [];
  out.push(["ts", "kind", "data"]);
  for (const row of rows) {
    out.push([row.ts, row.kind, row.data]);
  }

  const body = rowsToTsv(out);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...corsHeaders(),
      ...noCacheHeaders(),
    },
  });
}
