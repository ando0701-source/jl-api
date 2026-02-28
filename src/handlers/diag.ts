import { Env } from "../lib/types";
import { BUILD_ID } from "../lib/build";
import { jsonResponse, corsHeaders } from "../lib/http";

function pickHeaders(h: Headers): Record<string, string> {
  const keys = [
    "user-agent",
    "accept",
    "accept-encoding",
    "accept-language",
    "cf-ray",
    "cf-connecting-ip",
    "x-forwarded-for",
    "x-forwarded-proto",
    "host",
  ];
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = h.get(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

export async function handleDiag(req: Request, _env: Env): Promise<Response> {
  const url = new URL(req.url);
  return jsonResponse(
    {
      ok: true,
      method: req.method,
      pathname: url.pathname,
      search: url.search,
      headers: pickHeaders(req.headers),
      now_utc: new Date().toISOString(),
      build_id: BUILD_ID,
    },
    200,
    {
      "Cache-Control": "no-store",
      ...corsHeaders(),
    }
  );
}
