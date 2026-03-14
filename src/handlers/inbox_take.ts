import { Env } from "../lib/types";
import { HttpError, jsonResponse, readJson, API_ERROR_CODES } from "../lib/http";
import { INBOX_TAKE_MODES, INBOX_TAKE_SCHEMA_ID, InboxTakeMode, appendOwnerInboxEventBestEffort } from "../lib/inbox";
import { BUS_QUEUE_STATES, coerceChannelKind } from "../lib/transport_literals";

type TakeInput = {
  to_owner_id: string;
  inbox_id: string | null;
  bus_id: string | null;
  take_mode: InboxTakeMode | null;
  note: string | null;
};

function normalizeText(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function isInboxTakeMode(v: string): v is InboxTakeMode {
  return (INBOX_TAKE_MODES as readonly string[]).includes(v);
}

function parseInput(body: any): TakeInput {
  if (body == null || typeof body !== "object") {
    throw new HttpError(400, API_ERROR_CODES.INVALID_BODY, "Body must be a JSON object");
  }

  const toOwnerId = normalizeText((body as any).to_owner_id);
  const inboxId = normalizeText((body as any).inbox_id);
  const busId = normalizeText((body as any).bus_id);
  const takeMode = normalizeText((body as any).take_mode);

  if (!toOwnerId) throw new HttpError(400, API_ERROR_CODES.MISSING_TO_OWNER_ID, "to_owner_id is required");
  if (!inboxId && !busId) throw new HttpError(400, API_ERROR_CODES.MISSING_TARGET, "inbox_id or bus_id is required");
  if (takeMode && !isInboxTakeMode(takeMode)) {
    throw new HttpError(400, API_ERROR_CODES.INVALID_TAKE_MODE, `take_mode must be one of ${INBOX_TAKE_MODES.join(", ")}`, { take_mode: takeMode });
  }

  return {
    to_owner_id: toOwnerId,
    inbox_id: inboxId,
    bus_id: busId,
    take_mode: takeMode as InboxTakeMode | null,
    note: normalizeText((body as any).note),
  };
}

async function pickPending(env: Env, input: TakeInput): Promise<any | null> {
  if (input.inbox_id && input.bus_id) {
    return await env.DB.prepare(
      `SELECT inbox_id,inbox_ts,to_owner_id,from_owner_id,channel,q_state,bus_id,content_json,content_hash
       FROM owner_inbox
       WHERE to_owner_id = ? AND inbox_id = ? AND bus_id = ? AND q_state = '${BUS_QUEUE_STATES.PENDING}'
       LIMIT 1`
    ).bind(input.to_owner_id, input.inbox_id, input.bus_id).first<any>();
  }

  if (input.inbox_id) {
    return await env.DB.prepare(
      `SELECT inbox_id,inbox_ts,to_owner_id,from_owner_id,channel,q_state,bus_id,content_json,content_hash
       FROM owner_inbox
       WHERE to_owner_id = ? AND inbox_id = ? AND q_state = '${BUS_QUEUE_STATES.PENDING}'
       LIMIT 1`
    ).bind(input.to_owner_id, input.inbox_id).first<any>();
  }

  return await env.DB.prepare(
    `SELECT inbox_id,inbox_ts,to_owner_id,from_owner_id,channel,q_state,bus_id,content_json,content_hash
     FROM owner_inbox
     WHERE to_owner_id = ? AND bus_id = ? AND q_state = '${BUS_QUEUE_STATES.PENDING}'
     ORDER BY inbox_ts ASC, inbox_id ASC
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

export async function handleInboxTake(req: Request, env: Env): Promise<Response> {
  const body = await readJson(req);
  const input = parseInput(body);

  for (let attempt = 0; attempt < 3; attempt++) {
    const picked = await pickPending(env, input);
    if (!picked) {
      return jsonResponse({ ok: true, taken: false });
    }

    const inboxId = String((picked as any).inbox_id);
    const upd = await env.DB.prepare(
      `UPDATE owner_inbox
       SET q_state = '${BUS_QUEUE_STATES.DONE}'
       WHERE inbox_id = ? AND to_owner_id = ? AND q_state = '${BUS_QUEUE_STATES.PENDING}'`
    ).bind(inboxId, input.to_owner_id).run();

    if ((upd.meta?.changes ?? 0) === 0) continue;

    const row = await env.DB.prepare(
      `SELECT inbox_id,inbox_ts,to_owner_id,from_owner_id,channel,q_state,bus_id,content_json,content_hash
       FROM owner_inbox
       WHERE inbox_id = ?`
    ).bind(inboxId).first<any>();

    if (!row) return jsonResponse({ ok: true, taken: false });

    const payload: Record<string, unknown> = {
      schema_id: INBOX_TAKE_SCHEMA_ID,
      to_owner_id: input.to_owner_id,
      bus_id: String((row as any).bus_id),
    };
    if ((row as any).inbox_id != null) payload.inbox_id = String((row as any).inbox_id);
    if ((row as any).from_owner_id != null) payload.from_owner_id = String((row as any).from_owner_id);
    if (input.take_mode) payload.take_mode = input.take_mode;
    if (input.note) payload.note = input.note;

    await appendOwnerInboxEventBestEffort(env, {
      event_code: "INBOX_TAKE",
      actor_owner_id: input.to_owner_id,
      to_owner_id: input.to_owner_id,
      from_owner_id: (row as any).from_owner_id != null ? String((row as any).from_owner_id) : null,
      inbox_id: String((row as any).inbox_id),
      bus_id: String((row as any).bus_id),
      channel: coerceChannelKind((row as any).channel),
      data: payload,
    });

    return jsonResponse({
      ok: true,
      taken: true,
      row,
      content: parseContentJson((row as any).content_json),
    });
  }

  return jsonResponse({ ok: true, taken: false });
}
