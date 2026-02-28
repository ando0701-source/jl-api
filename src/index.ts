// src/index.ts
// Cloudflare Workers (TypeScript) + D1 (SQLite)
// Storage unit of truth: 2PLT_BUS/v1 (bus_json)
// Policy: validate only required fields; preserve unknown fields in bus_json.
// Optional stealth mode: set env.STEALTH_404="1" to return 404 for auth failures.

import { Env } from "./lib/types";
import { HttpError, jsonResponse } from "./lib/http";
import { route } from "./router";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {      const r = await route(req, env);
      return r;
    } catch (e: any) {
      // Always respond with JSON error (avoid "connection reset" style symptoms)
      if (e instanceof HttpError) {
        return jsonResponse(
          { ok: false, error: { code: e.code, message: e.message, details: e.details } },
          e.status
        );
      }
      console.error("UNHANDLED_ERROR", e);
      return jsonResponse(
        { ok: false, error: { code: "internal_error", message: "Internal Server Error" } },
        500
      );
    }
  },
};
