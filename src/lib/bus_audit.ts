import { Env } from "./types";
import { nowEpochSec, sha256Hex } from "./util";

export type BusAuditIO = "SENT" | "RECEIVED";

export type BusAuditInput = {
  io: BusAuditIO;
  bus_id: string;
  actor_owner_id: string;
  peer_owner_id?: string | null;
  content_json: string;
  captured_at?: number;
  attempt_key?: string | number | null;
  audit_id?: string | null;
};

function defaultAuditId(io: BusAuditIO, busId: string, attemptKey?: string | number | null): string {
  if (io === "SENT") return `SENT:${busId}`;
  const k = (attemptKey === undefined || attemptKey === null) ? String(nowEpochSec()) : String(attemptKey);
  return `RECEIVED:${busId}:${k}`;
}

export async function appendBusAuditBestEffort(env: Env, a: BusAuditInput): Promise<void> {
  try {
    const capturedAt = (typeof a.captured_at === "number" && Number.isFinite(a.captured_at))
      ? Math.floor(a.captured_at)
      : nowEpochSec();
    const busId = String(a.bus_id);
    const actorOwnerId = String(a.actor_owner_id);
    const contentJson = String(a.content_json);
    const contentHash = await sha256Hex(contentJson);
    const auditId = a.audit_id ? String(a.audit_id) : defaultAuditId(a.io, busId, a.attempt_key);

    await env.DB.prepare(
      `INSERT OR IGNORE INTO bus_audit(audit_id,captured_at,actor_owner_id,io,peer_owner_id,bus_id,content_json,content_hash)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(
      auditId,
      capturedAt,
      actorOwnerId,
      a.io,
      a.peer_owner_id ?? null,
      busId,
      contentJson,
      contentHash
    ).run();
  } catch {
    // best-effort
  }
}
