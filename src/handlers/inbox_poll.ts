import { Env } from "../lib/types";
import { HttpError, jsonResponse } from "../lib/http";
import { appendOwnerInboxEventBestEffort } from "../lib/inbox";

function parseLimit(url: URL): number {
  const raw = url.searchParams.get("limit");
  if (!raw) return 100;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, "invalid_limit", "limit must be a positive integer");
  }
  return Math.min(n, 500);
}

function parseOrder(url: URL): "ASC" | "DESC" {
  const raw = (url.searchParams.get("order") || "asc").toLowerCase();
  if (raw === "asc") return "ASC";
  if (raw === "desc") return "DESC";
  throw new HttpError(400, "invalid_order", "order must be 'asc' or 'desc'");
}

function parseMaybeInt(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
  return n;
}

function parseContentJson(raw: unknown): unknown | null {
  if (raw == null) return null;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

export async function handleInboxPoll(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const ownerId = (url.searchParams.get("owner_id") || "").trim();
  if (!ownerId) throw new HttpError(400, "missing_owner_id", "owner_id is required");

  const limit = parseLimit(url);
  const orderSql = parseOrder(url);

  const r = await env.DB.prepare(
    `SELECT inbox_id,inbox_ts,to_owner_id,from_owner_id,channel,q_state,bus_id,content_json,content_hash
     FROM owner_inbox
     WHERE to_owner_id = ? AND q_state = 'PENDING'
     ORDER BY inbox_ts ${orderSql}, inbox_id ${orderSql}
     LIMIT ?`
  ).bind(ownerId, limit).all<any>();

  const rows = (r.results || []) as any[];
  const items = rows.map((row) => ({
    ...row,
    content: parseContentJson(row.content_json),
  }));

  if (items.length === 0 && env.INBOX_POLL_EMPTY_LOG === "1") {
    const data: Record<string, unknown> = {
      schema_id: "INBOX_POLL_EMPTY_V1",
      to_owner_id: ownerId,
    };
    const waitMs = parseMaybeInt(url.searchParams.get("wait_ms"));
    const pollSeq = parseMaybeInt(url.searchParams.get("poll_seq"));
    const note = url.searchParams.get("note");
    if (waitMs !== undefined) data.wait_ms = waitMs;
    if (pollSeq !== undefined) data.poll_seq = pollSeq;
    if (note) data.note = note;

    await appendOwnerInboxEventBestEffort(env, {
      event_code: "INBOX_POLL_EMPTY",
      actor_owner_id: ownerId,
      to_owner_id: ownerId,
      data,
    });
  }

  return jsonResponse({
    ok: true,
    owner_id: ownerId,
    found: items.length > 0,
    count: items.length,
    items,
  });
}
