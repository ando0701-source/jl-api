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

async function getBusMessagesHeader(env: Env): Promise<string[]> {
  const info = await env.DB.prepare("PRAGMA table_info('bus_messages')").all<any>();
  const cols = (info.results || [])
    .map((r: any) => r.name)
    .filter((x: any) => typeof x === "string" && x.length > 0);
  return cols;
}

export async function handleLogsTxt(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

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

  const orderRaw = (url.searchParams.get("order") || "asc").toLowerCase();
  let orderSql: "ASC" | "DESC" = "ASC";
  if (orderRaw === "desc") orderSql = "DESC";
  else if (orderRaw !== "asc") {
    throw new HttpError(400, "invalid_order", "order must be 'asc' or 'desc'");
  }

  const sql = `SELECT * FROM bus_messages ORDER BY inserted_at ${orderSql}, bus_id ${orderSql} LIMIT ?`;

  let header: string[] = [];
  let rows: any[] = [];
  try {
    const r = await env.DB.prepare(sql).bind(limit).all<any>();
    rows = (r.results || []) as any[];
    if (rows.length > 0) {
      // Preserve column order using PRAGMA to avoid object-key ordering issues.
      header = await getBusMessagesHeader(env);
    } else {
      header = await getBusMessagesHeader(env);
    }
  } catch {
    header = await getBusMessagesHeader(env);
    rows = [];
  }

  const out: unknown[][] = [];
  out.push(header);
  for (const row of rows) {
    const vals = header.map((k) => (row as any)[k]);
    out.push(vals);
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
