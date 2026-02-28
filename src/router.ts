import { Env } from "./lib/types";
import { HttpError, corsHeaders, textResponse } from "./lib/http";
import { authOrStealth404, isKnownRoute } from "./lib/auth";
import { handleEnqueue } from "./handlers/enqueue";
import { handleDequeue } from "./handlers/dequeue";
import { handleFinalize } from "./handlers/finalize";
import { handleLogsTsv } from "./handlers/logs_tsv";

export async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }


  // Public route (no auth): export logs as TSV (for ChatGPT-side inspection)
  if (path === "/logs.tsv") {
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET");
    return await handleLogsTsv(req, env);
  }

  // Unknown routes: always 404 (no auth check)
  if (!isKnownRoute(path)) {
    return textResponse("not found", 404);
  }

  // Known routes: enforce auth (or stealth 404)
  authOrStealth404(req, env);

  // Methods & handlers
  if (path === "/ping") {
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET");
    return textResponse("pong", 200);
  }

  if (path === "/enqueue") {
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST");
    return await handleEnqueue(req, env);
  }

  if (path === "/dequeue") {
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET");
    return await handleDequeue(req, env);
  }

  if (path === "/finalize") {
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST");
    return await handleFinalize(req, env);
  }

  return textResponse("not found", 404);
}
