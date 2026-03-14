import { Env } from "./types";
import { HttpError, API_ERROR_CODES } from "./http";
import { KNOWN_ROUTE_PATHS } from "./routes";
import { ENV_CONFIG_KEYS, ENV_SWITCH_ENABLED } from "./config";

export function authOrStealth404(req: Request, env: Env): void {
  const apiKey = env[ENV_CONFIG_KEYS.API_KEY];
  const given = req.headers.get("X-API-Key");
  const ok = !!apiKey && !!given && given === apiKey;
  if (!ok) {
    if (env[ENV_CONFIG_KEYS.STEALTH_404] === ENV_SWITCH_ENABLED) {
      throw new HttpError(404, API_ERROR_CODES.NOT_FOUND, "Not Found");
    }
    throw new HttpError(401, API_ERROR_CODES.UNAUTHORIZED, "Unauthorized");
  }
}

export function isKnownRoute(pathname: string): boolean {
  return KNOWN_ROUTE_PATHS.has(pathname);
}
