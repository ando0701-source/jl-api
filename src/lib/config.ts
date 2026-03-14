export const ENV_CONFIG_KEYS = {
  API_KEY: "API_KEY",
  STEALTH_404: "STEALTH_404",
  CLAIM_TTL_SEC: "CLAIM_TTL_SEC",
  DEBUG_LITE: "DEBUG_LITE",
  EVENTS_LITE: "EVENTS_LITE",
  INBOX_POLL_EMPTY_LOG: "INBOX_POLL_EMPTY_LOG",
} as const;

export type EnvConfigKey = typeof ENV_CONFIG_KEYS[keyof typeof ENV_CONFIG_KEYS];

export const ENV_SWITCH_ENABLED = "1" as const;
export type EnvSwitchEnabled = typeof ENV_SWITCH_ENABLED;
