import { JsonValue } from "./types";

export const API_ERROR_CODES = {
  BODY_TOO_LARGE: "body_too_large",
  EMPTY_BODY: "empty_body",
  ENQUEUE_CONSTRAINT_FAILED: "enqueue_constraint_failed",
  INCONSISTENT_STATE: "inconsistent_state",
  INTERNAL_ERROR: "internal_error",
  INVALID_ACK_STATE: "invalid_ack_state",
  INVALID_BODY: "invalid_body",
  INVALID_BUS_TS: "invalid_bus_ts",
  INVALID_JSON: "invalid_json",
  INVALID_LIMIT: "invalid_limit",
  INVALID_MESSAGE_SCHEMA_ID: "invalid_message_schema_id",
  INVALID_MSG_TYPE: "invalid_msg_type",
  INVALID_ORDER: "invalid_order",
  INVALID_Q_STATE: "invalid_q_state",
  INVALID_SCHEMA_ID: "invalid_schema_id",
  INVALID_TAKE_MODE: "invalid_take_mode",
  METHOD_NOT_ALLOWED: "method_not_allowed",
  MISSING_ACK_STATE: "missing_ack_state",
  MISSING_BUS_ID: "missing_bus_id",
  MISSING_CONTENTS: "missing_contents",
  MISSING_FIELDS: "missing_fields",
  MISSING_OWNER_ID: "missing_owner_id",
  MISSING_TARGET: "missing_target",
  MISSING_TO_OWNER_ID: "missing_to_owner_id",
  NOT_FOUND: "not_found",
  OUT_STATE_MISMATCH: "out_state_mismatch",
  ROUTING_FLOW_MISMATCH: "routing_flow_mismatch",
  TOO_MANY_EVENT_CODES: "too_many_event_codes",
  UNAUTHORIZED: "unauthorized",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export class HttpError extends Error {
  status: number;
  code: ApiErrorCode;
  details?: unknown;
  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export function noCacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "CDN-Cache-Control": "no-store",
    "Surrogate-Control": "no-store",
  };
}


export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...noCacheHeaders(),
      ...extraHeaders,
    },
  });
}

export function textResponse(body: string, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...corsHeaders(),
      ...noCacheHeaders(),
      ...extraHeaders,
    },
  });
}

function stripUtf8Bom(s: string): string {
  // UTF-8 BOM: \uFEFF
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export async function readJson(req: Request, maxBytes = 1024 * 1024): Promise<JsonValue> {
  const text = stripUtf8Bom(await req.text());
  if (!text) throw new HttpError(400, API_ERROR_CODES.EMPTY_BODY, "Request body is empty");
  if (text.length > maxBytes) throw new HttpError(413, API_ERROR_CODES.BODY_TOO_LARGE, "Request body is too large", { maxBytes });

  // Normal JSON
  try {
    return JSON.parse(text);
  } catch (_) {
    // In some Windows/cmd.exe cases, users accidentally send a JSON string like "{\"a\":1}"
    // We *optionally* accept that by a single unwrapping attempt.
    try {
      const v = JSON.parse(text.replace(/\r\n/g, "\n"));
      if (typeof v === "string") {
        return JSON.parse(v);
      }
    } catch {
      // ignore
    }
    throw new HttpError(400, API_ERROR_CODES.INVALID_JSON, "Request body is not valid JSON");
  }
}
