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
  // Only expose when DEBUG_LITE=1 (hard gate). Otherwise behave like unknown route.
  if (env.DEBUG_LITE !== "1") {
    return new Response("not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders(), ...noCacheHeaders() } });
  }

  const url = new URL(req.url);

  const limitRaw = url.searchParams.get("limit");
  let limit = 500;
  if (limitRaw !== null && limitRaw !== "") {
    const n = Number(limitRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      throw new HttpError(400, "invalid_limit", "limit must be a positive integer");
    }
    limit = n;
  }
  if (limit > 5000) limit = 5000;

  const orderRaw = (url.searchParams.get("order") || "asc").toLowerCase();
  let orderSql: "ASC" | "DESC" = "ASC";
  if (orderRaw === "desc") orderSql = "DESC";
  else if (orderRaw !== "asc") throw new HttpError(400, "invalid_order", "order must be 'asc' or 'desc'");

  await ensureTable(env);

  const sql = `SELECT ts,kind,data FROM debug_events ORDER BY ts ${orderSql}, id ${orderSql} LIMIT ?`;

  let rawRows: unknown[][] = [];
  try {
    const v = (await env.DB.prepare(sql).bind(limit).raw({ columnNames: true })) as unknown;
    if (Array.isArray(v)) rawRows = v as unknown[][];
  } catch {
    rawRows = [];
  }

  if (rawRows.length === 0) {
    rawRows = [["ts", "kind", "data"]];
  }

  const body = rowsToTsv(rawRows);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...corsHeaders(),
      ...noCacheHeaders(),
    },
  });
}
