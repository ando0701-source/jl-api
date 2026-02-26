import { Env } from "./types";
import { HttpError } from "./http";

export function authOrStealth404(req: Request, env: Env): void {
  const apiKey = env.API_KEY;
  const given = req.headers.get("X-API-Key");
  const ok = !!apiKey && !!given && given === apiKey;
  if (!ok) {
    if (env.STEALTH_404 === "1") {
      throw new HttpError(404, "not_found", "Not Found");
    }
    throw new HttpError(401, "unauthorized", "Unauthorized");
  }
}

export function isKnownRoute(pathname: string): boolean {
  return pathname === "/ping" || pathname === "/enqueue" || pathname === "/dequeue" || pathname === "/finalize";
}
