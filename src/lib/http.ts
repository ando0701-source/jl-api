import { JsonValue } from "./types";

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
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
  if (!text) throw new HttpError(400, "empty_body", "Request body is empty");
  if (text.length > maxBytes) throw new HttpError(413, "body_too_large", "Request body is too large", { maxBytes });

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
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON");
  }
}
