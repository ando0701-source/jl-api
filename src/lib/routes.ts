export const ROUTE_PATHS = {
  PING: "/ping",
  ENQUEUE: "/enqueue",
  DEQUEUE: "/dequeue",
  FINALIZE: "/finalize",
  INBOX_POLL: "/inbox/poll",
  INBOX_TAKE: "/inbox/take",
  INBOX_ACK: "/inbox/ack",
  LOGS_TSV: "/logs.tsv",
  LOGS_TXT: "/logs.txt",
  DEBUG_TXT: "/debug.txt",
  EVENTS_TXT: "/events.txt",
} as const;

export type HttpRoutePath = typeof ROUTE_PATHS[keyof typeof ROUTE_PATHS];

export const TRANSPORT_OPERATIONS = {
  PING: "ping",
  ENQUEUE: "enqueue",
  DEQUEUE: "dequeue",
  FINALIZE: "finalize",
  INBOX_POLL: "inbox_poll",
  INBOX_TAKE: "inbox_take",
  INBOX_ACK: "inbox_ack",
  LOGS_TSV_EXPORT: "logs_tsv_export",
  LOGS_TXT_EXPORT: "logs_txt_export",
  DEBUG_TXT_EXPORT: "debug_txt_export",
  EVENTS_TXT_EXPORT: "events_txt_export",
} as const;

export type TransportOperation =
  typeof TRANSPORT_OPERATIONS[keyof typeof TRANSPORT_OPERATIONS];

export const KNOWN_ROUTE_PATHS = new Set<string>([
  ROUTE_PATHS.PING,
  ROUTE_PATHS.ENQUEUE,
  ROUTE_PATHS.DEQUEUE,
  ROUTE_PATHS.FINALIZE,
  ROUTE_PATHS.INBOX_POLL,
  ROUTE_PATHS.INBOX_TAKE,
  ROUTE_PATHS.INBOX_ACK,
]);
