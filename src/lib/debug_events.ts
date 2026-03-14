export const DEBUG_EVENT_KINDS = [
  "enqueue_in",
  "enqueue_ok",
  "enqueue_error",
  "dequeue_not_found",
  "dequeue_claimed",
  "ttl_reclaim",
  "ttl_reclaim_error",
] as const;

export type DebugEventKind = typeof DEBUG_EVENT_KINDS[number];

export const DEBUG_EVENT_KIND = {
  ENQUEUE_IN: DEBUG_EVENT_KINDS[0],
  ENQUEUE_OK: DEBUG_EVENT_KINDS[1],
  ENQUEUE_ERROR: DEBUG_EVENT_KINDS[2],
  DEQUEUE_NOT_FOUND: DEBUG_EVENT_KINDS[3],
  DEQUEUE_CLAIMED: DEBUG_EVENT_KINDS[4],
  TTL_RECLAIM: DEBUG_EVENT_KINDS[5],
  TTL_RECLAIM_ERROR: DEBUG_EVENT_KINDS[6],
} as const;
