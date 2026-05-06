import { Env } from "./lib/types";
import { HttpError, corsHeaders, textResponse, API_ERROR_CODES } from "./lib/http";
import { authOrStealth404, isKnownRoute } from "./lib/auth";
import { ROUTE_PATHS } from "./lib/routes";
import { handleEnqueue } from "./handlers/enqueue";
import { handleDequeue } from "./handlers/dequeue";
import { handleDiag } from "./handlers/diag";
import { handleFinalize } from "./handlers/finalize";
import { handleLogsTsv } from "./handlers/logs_tsv";
import { handleLogsTxt } from "./handlers/logs_txt";
import { handleDebugTxt } from "./handlers/debug_txt";
import { handleEventsTxt } from "./handlers/events_txt";
import { handleInboxPoll } from "./handlers/inbox_poll";
import { handleInboxTake } from "./handlers/inbox_take";
import { handleInboxAck } from "./handlers/inbox_ack";

export async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Public routes (no auth): log exports

  // Export logs as TSV (AI-side inspection)
  if (path === ROUTE_PATHS.LOGS_TSV) {
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use GET/HEAD");
    const r = await handleLogsTsv(req, env);
    return req.method === "HEAD" ? new Response(null, { status: r.status, headers: r.headers }) : r;
  }

  // Export logs as plain text (TSV body, but Content-Type is text/plain for maximum client compatibility)
  if (path === ROUTE_PATHS.LOGS_TXT) {
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use GET/HEAD");
    const r = await handleLogsTxt(req, env);
    return req.method === "HEAD" ? new Response(null, { status: r.status, headers: r.headers }) : r;
  }

  // Debug-lite export (public, but hard-gated by env.DEBUG_LITE=1)
  if (path === ROUTE_PATHS.DEBUG_TXT) {
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use GET/HEAD");
    const r = await handleDebugTxt(req, env);
    return req.method === "HEAD" ? new Response(null, { status: r.status, headers: r.headers }) : r;
  }

  // Derived events export (public, hard-gated by env.EVENTS_LITE=1 or env.DEBUG_LITE=1)
  if (path === ROUTE_PATHS.EVENTS_TXT) {
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use GET/HEAD");
    const r = await handleEventsTxt(req, env);
    return req.method === "HEAD" ? new Response(null, { status: r.status, headers: r.headers }) : r;
  }

  // Unknown routes: always 404 (no auth check)
  if (!isKnownRoute(path)) {
    return textResponse("not found", 404);
  }

  // Known routes: enforce auth (or stealth 404)
  authOrStealth404(req, env);

  // Methods & handlers
  if (path === ROUTE_PATHS.PING) {
    if (req.method !== "GET") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use GET");
    return textResponse("pong", 200);
  }

  if (path === ROUTE_PATHS.ENQUEUE) {
    if (req.method !== "POST") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use POST");
    return await handleEnqueue(req, env);
  }

  if (path === ROUTE_PATHS.DEQUEUE) {
    if (req.method !== "GET") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use GET");
    return await handleDequeue(req, env);
  }

  if (path === ROUTE_PATHS.DIAG) {
    if (req.method !== "GET") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use GET");
    return await handleDiag(req, env);
  }

  if (path === ROUTE_PATHS.FINALIZE) {
    if (req.method !== "POST") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use POST");
    return await handleFinalize(req, env);
  }

  if (path === ROUTE_PATHS.INBOX_POLL) {
    if (req.method !== "GET") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use GET");
    return await handleInboxPoll(req, env);
  }

  if (path === ROUTE_PATHS.INBOX_TAKE) {
    if (req.method !== "POST") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use POST");
    return await handleInboxTake(req, env);
  }

  if (path === ROUTE_PATHS.INBOX_ACK) {
    if (req.method !== "POST") throw new HttpError(405, API_ERROR_CODES.METHOD_NOT_ALLOWED, "Use POST");
    return await handleInboxAck(req, env);
  }

  return textResponse("not found", 404);
}
