export const QUERY_PARAM_KEYS = {
  OWNER_ID: "owner_id",
  CLAIMED_BY: "claimed_by",
  EXPECTED_BUS_ID: "expected_bus_id",
  LIMIT: "limit",
  ORDER: "order",
  EVENT_CODE: "event_code",
  WAIT_MS: "wait_ms",
  POLL_SEQ: "poll_seq",
  NOTE: "note",
  DEBUG: "debug",
} as const;

export type HttpQueryParam = typeof QUERY_PARAM_KEYS[keyof typeof QUERY_PARAM_KEYS];
