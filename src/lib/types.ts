export interface Env {
  DB: D1Database;
  API_KEY?: string;
  STEALTH_404?: string; // "1" => unauthorized -> 404
  CLAIM_TTL_SEC?: string; // seconds; if set, dequeue will reclaim expired claims
  DEBUG_LITE?: string; // "1" enables debug lite (D1-backed) + /debug.txt
  EVENTS_LITE?: string; // "1" enables /events.txt (derived events view)
}

export type JsonValue = any;
