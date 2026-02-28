import { Env } from "./types";
import { nowEpochSec } from "./util";

/**
 * Debug-lite: writes minimal diagnostic events into D1 when enabled.
 * - Enabled only when env.DEBUG_LITE === "1".
 * - Sink is D1 table debug_events (created on-demand).
 * - Best-effort only; never fails the main API flow.
 *
 * This is designed to be easy to remove:
 *  - delete this file and the few call-sites, and remove /debug.txt route.
 *  - or keep it and set DEBUG_LITE=0 (unset) to disable.
 */

export function isDebugLiteEnabled(_req: Request, env: Env): boolean {
  return env.DEBUG_LITE === "1";
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

export async function dbg(env: Env, enabled: boolean, kind: string, data: unknown): Promise<void> {
  if (!enabled) return;
  try {
    await ensureTable(env);
    const id = crypto.randomUUID();
    const ts = nowEpochSec();
    const payload = data === undefined ? null : data;
    await env.DB.prepare(
      `INSERT INTO debug_events (id, ts, kind, data) VALUES (?, ?, ?, ?)`
    ).bind(id, ts, kind, JSON.stringify(payload)).run();
  } catch (_) {
    // ignore (best-effort)
  }
}
