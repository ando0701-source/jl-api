import { Env } from "./types";
import { nowEpochSec, randomId, sha256Hex } from "./util";

export type OwnerInboxEventCode = "INBOX_NOTIFY_PUT" | "INBOX_TAKE" | "INBOX_ACK" | "INBOX_POLL_EMPTY";

export type OwnerInboxEventInput = {
  event_code: OwnerInboxEventCode;
  actor_owner_id: string;
  to_owner_id: string;
  from_owner_id?: string | null;
  inbox_id?: string | null;
  bus_id?: string | null;
  channel?: "D1" | "WEBHOOK";
  data: unknown;
  event_ts?: number | null;
};

export type InboxEnvelopeV1 = {
  schema_id: "INBOX_ENVELOPE_V1";
  kind: "MESSAGE_AVAILABLE";
  to_owner_id: string;
  bus_id: string;
  from_owner_id?: string;
  message?: unknown;
  note?: string;
};

export async function appendOwnerInboxEventBestEffort(env: Env, e: OwnerInboxEventInput): Promise<void> {
  try {
    const eventId = randomId();
    const eventTs = (e.event_ts == null) ? nowEpochSec() : Math.floor(Number(e.event_ts));
    const dataJson = JSON.stringify(e.data ?? {});

    await env.DB.prepare(
      `INSERT INTO owner_inbox_events(event_id,event_ts,event_code,actor_owner_id,to_owner_id,from_owner_id,inbox_id,bus_id,channel,data)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      eventId,
      eventTs,
      e.event_code,
      String(e.actor_owner_id),
      String(e.to_owner_id),
      e.from_owner_id ?? null,
      e.inbox_id ?? null,
      e.bus_id ?? null,
      e.channel ?? "D1",
      dataJson
    ).run();
  } catch {
    // best-effort
  }
}

export type PutInboxNotificationInput = {
  to_owner_id: string;
  from_owner_id?: string | null;
  bus_id: string;
  message?: unknown;
  note?: string | null;
  inbox_id?: string | null;
  channel?: "D1" | "WEBHOOK";
  inbox_ts?: number | null;
};

export type PutInboxNotificationResult = {
  inserted: boolean;
  inbox_id: string;
  envelope: InboxEnvelopeV1;
};

export async function putOwnerInboxNotificationBestEffort(
  env: Env,
  i: PutInboxNotificationInput
): Promise<PutInboxNotificationResult> {
  const inboxTs = (i.inbox_ts == null) ? nowEpochSec() : Math.floor(Number(i.inbox_ts));
  const inboxId = i.inbox_id ? String(i.inbox_id) : String(i.bus_id);

  const envelope: InboxEnvelopeV1 = {
    schema_id: "INBOX_ENVELOPE_V1",
    kind: "MESSAGE_AVAILABLE",
    to_owner_id: String(i.to_owner_id),
    bus_id: String(i.bus_id),
  };

  if (i.from_owner_id) envelope.from_owner_id = String(i.from_owner_id);
  if (i.message !== undefined) envelope.message = i.message;
  if (i.note) envelope.note = String(i.note);

  try {
    const contentJson = JSON.stringify(envelope);
    const contentHash = await sha256Hex(contentJson);
    const r = await env.DB.prepare(
      `INSERT OR IGNORE INTO owner_inbox(inbox_id,inbox_ts,to_owner_id,from_owner_id,channel,q_state,bus_id,content_json,content_hash)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(
      inboxId,
      inboxTs,
      envelope.to_owner_id,
      envelope.from_owner_id ?? null,
      i.channel ?? "D1",
      "PENDING",
      envelope.bus_id,
      contentJson,
      contentHash
    ).run();
    return { inserted: (r.meta?.changes ?? 0) > 0, inbox_id: inboxId, envelope };
  } catch {
    return { inserted: false, inbox_id: inboxId, envelope };
  }
}
