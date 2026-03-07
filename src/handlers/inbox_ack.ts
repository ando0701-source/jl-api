import { Env } from "../lib/types";
import { HttpError, jsonResponse, readJson } from "../lib/http";
import { appendOwnerInboxEventBestEffort } from "../lib/inbox";

type AckInput = {
  to_owner_id: string;
  bus_id: string;
  ack_state: string;
  inbox_id: string | null;
  note: string | null;
};

function normalizeText(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function parseInput(body: any): AckInput {
  if (body == null || typeof body !== "object") {
    throw new HttpError(400, "invalid_body", "Body must be a JSON object");
  }

  const toOwnerId = normalizeText((body as any).to_owner_id);
  const busId = normalizeText((body as any).bus_id);
  const ackState = normalizeText((body as any).ack_state);

  if (!toOwnerId) throw new HttpError(400, "missing_to_owner_id", "to_owner_id is required");
  if (!busId) throw new HttpError(400, "missing_bus_id", "bus_id is required");
  if (!ackState) throw new HttpError(400, "missing_ack_state", "ack_state is required");

  return {
    to_owner_id: toOwnerId,
    bus_id: busId,
    ack_state: ackState,
    inbox_id: normalizeText((body as any).inbox_id),
    note: normalizeText((body as any).note),
  };
}

async function pickInboxRow(env: Env, input: AckInput): Promise<any | null> {
  if (input.inbox_id) {
    return await env.DB.prepare(
      `SELECT inbox_id,inbox_ts,to_owner_id,from_owner_id,channel,q_state,bus_id,content_json,content_hash
       FROM owner_inbox
       WHERE to_owner_id = ? AND bus_id = ? AND inbox_id = ?
       LIMIT 1`
    ).bind(input.to_owner_id, input.bus_id, input.inbox_id).first<any>();
  }

  return await env.DB.prepare(
    `SELECT inbox_id,inbox_ts,to_owner_id,from_owner_id,channel,q_state,bus_id,content_json,content_hash
     FROM owner_inbox
     WHERE to_owner_id = ? AND bus_id = ?
     ORDER BY CASE q_state WHEN 'PENDING' THEN 0 WHEN 'DONE' THEN 1 ELSE 2 END, inbox_ts ASC, inbox_id ASC
     LIMIT 1`
  ).bind(input.to_owner_id, input.bus_id).first<any>();
}

function parseContentJson(raw: unknown): unknown | null {
  if (raw == null) return null;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

export async function handleInboxAck(req: Request, env: Env): Promise<Response> {
  const body = await readJson(req);
  const input = parseInput(body);

  const picked = await pickInboxRow(env, input);
  if (!picked) {
    return jsonResponse({ ok: true, acked: false });
  }

  const inboxId = String((picked as any).inbox_id);
  if (String((picked as any).q_state) !== "DONE") {
    await env.DB.prepare(
      `UPDATE owner_inbox
       SET q_state = 'DONE'
       WHERE inbox_id = ? AND to_owner_id = ? AND q_state <> 'DONE'`
    ).bind(inboxId, input.to_owner_id).run();
  }

  const row = await env.DB.prepare(
    `SELECT inbox_id,inbox_ts,to_owner_id,from_owner_id,channel,q_state,bus_id,content_json,content_hash
     FROM owner_inbox
     WHERE inbox_id = ?`
  ).bind(inboxId).first<any>();

  if (!row) {
    return jsonResponse({ ok: true, acked: false });
  }

  const payload: Record<string, unknown> = {
    schema_id: "INBOX_ACK_V1",
    to_owner_id: input.to_owner_id,
    bus_id: String((row as any).bus_id),
    ack_state: input.ack_state,
  };
  if ((row as any).inbox_id != null) payload.inbox_id = String((row as any).inbox_id);
  if (input.note) payload.note = input.note;

  await appendOwnerInboxEventBestEffort(env, {
    event_code: "INBOX_ACK",
    actor_owner_id: input.to_owner_id,
    to_owner_id: input.to_owner_id,
    from_owner_id: (row as any).from_owner_id != null ? String((row as any).from_owner_id) : null,
    inbox_id: String((row as any).inbox_id),
    bus_id: String((row as any).bus_id),
    channel: ((row as any).channel === "WEBHOOK") ? "WEBHOOK" : "D1",
    data: payload,
  });

  return jsonResponse({
    ok: true,
    acked: true,
    ack_state: input.ack_state,
    row,
    content: parseContentJson((row as any).content_json),
  });
}
