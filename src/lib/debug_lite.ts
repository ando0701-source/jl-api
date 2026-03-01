import { Env } from "./types";

async function ensureDebugTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS debug_events (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      kind TEXT NOT NULL,
      data TEXT
    )`
  ).run();
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function uuidLike(): string {
  // cheap unique id: ts + random
  return `${nowSec()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export function isDebugLiteEnabled(req: Request, env: Env): boolean {
  if (env.DEBUG_LITE === "1") return true;
  const url = new URL(req.url);
  return url.searchParams.get("debug") === "1";
}

export async function dbg(env: Env, enabled: boolean, kind: string, obj: unknown): Promise<void> {
  if (!enabled) return;
  try {
    await ensureDebugTable(env);
    const ts = nowSec();
    const id = uuidLike();
    const data = JSON.stringify(obj);
    await env.DB.prepare("INSERT INTO debug_events(id,ts,kind,data) VALUES (?,?,?,?)")
      .bind(id, ts, kind, data)
      .run();
  } catch {
    // best-effort: never fail the main request
  }
}
