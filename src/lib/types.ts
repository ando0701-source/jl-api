export interface Env {
  DB: D1Database;
  API_KEY?: string;
  STEALTH_404?: string; // "1" => unauthorized -> 404
}

export type JsonValue = any;
