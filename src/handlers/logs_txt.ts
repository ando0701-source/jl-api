import { Env } from "../lib/types";
import { HttpError, corsHeaders, noCacheHeaders } from "../lib/http";

function escapeTsvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Escape only what can break TSV layout, using backslash escapes.
  s = s.replace(/\\/g, "\\\\");
  s = s.replace(/\t/g, "\\t");
  s = s.replace(/\r/g, "\\r");
  s = s.replace(/\n/g, "\\n");
  return s;
}

function rowsToTsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(escapeTsvCell).join("\t")).join("\n") + "\n";
}

async function getBusMessagesHeader(env: Env): Promise<string[]> {
  const info = await env.DB.prepare("PRAGMA table_info('bus_messages')").all<any>();
  const cols = (info.results || []).map((r: any) => r.name).filter((x: any) => typeof x === "string" && x.length > 0);
  return cols;
}

export async function handleLogsTxt(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

  // limit query
  const limitRaw = url.searchParams.get("limit");
  let limit = 1000;
  if (limitRaw !== null && limitRaw !== "") {
    const n = Number(limitRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      throw new HttpError(400, "invalid_limit", "limit must be a positive integer");
    }
    limit = n;
  }
  if (limit > 5000) limit = 5000;

  // order query
  const orderRaw = (url.searchParams.get("order") || "asc").toLowerCase();
  let orderSql: "ASC" | "DESC" = "ASC";
  if (orderRaw === "desc") orderSql = "DESC";
  else if (orderRaw !== "asc") {
    throw new HttpError(400, "invalid_order", "order must be 'asc' or 'desc'");
  }

  const sql = `SELECT * FROM bus_messages ORDER BY inserted_at ${orderSql}, bus_id ${orderSql} LIMIT ?`;

  // Prefer D1 raw() with columnNames when possible
  let rawRows: unknown[][] = [];
  try {
    const v = (await env.DB.prepare(sql).bind(limit).raw({ columnNames: true })) as unknown;
    if (Array.isArray(v)) rawRows = v as unknown[][];
  } catch (e) {
    // Fallback below (should be rare)
    rawRows = [];
  }

  // If empty, ensure header exists
  if (rawRows.length === 0) {
    const header = await getBusMessagesHeader(env);
    rawRows = [header];
  } else if (rawRows.length === 1) {
    // raw() may return only header row when there are no results; keep as-is.
    const first = rawRows[0] || [];
    if (!Array.isArray(first) || first.length === 0) {
      const header = await getBusMessagesHeader(env);
      rawRows = [header];
    }
  }

  const body = rowsToTsv(rawRows);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...noCacheHeaders(),
      ...corsHeaders(),
    },
  });
}
