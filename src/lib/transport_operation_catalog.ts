// Phase1D-2 transport operation materialization literals.
// Canonical rows live in CODEX/vocab/vocab.tsv under domain=transport.operation.
// This file is the Phase1D-2 materialized runtime/check source for route and operation literals until vocab-driven generation is introduced.

export const TRANSPORT_OPERATION_CATALOG = {
  DEBUG_TXT_EXPORT: {
    name: "debug_txt_export",
    route_path: "/debug.txt",
    http_methods: ["GET", "HEAD"],
    auth_scope: "PUBLIC",
    handler_name: "handleDebugTxt",
  },

  DIAG: {
    name: "diag",
    route_path: "/diag",
    http_methods: ["GET"],
    auth_scope: "AUTH_REQUIRED",
    handler_name: "handleDiag",
  },
  DEQUEUE: {
    name: "dequeue",
    route_path: "/dequeue",
    http_methods: ["GET"],
    auth_scope: "AUTH_REQUIRED",
    handler_name: "handleDequeue",
  },
  ENQUEUE: {
    name: "enqueue",
    route_path: "/enqueue",
    http_methods: ["POST"],
    auth_scope: "AUTH_REQUIRED",
    handler_name: "handleEnqueue",
  },
  EVENTS_TXT_EXPORT: {
    name: "events_txt_export",
    route_path: "/events.txt",
    http_methods: ["GET", "HEAD"],
    auth_scope: "PUBLIC",
    handler_name: "handleEventsTxt",
  },
  FINALIZE: {
    name: "finalize",
    route_path: "/finalize",
    http_methods: ["POST"],
    auth_scope: "AUTH_REQUIRED",
    handler_name: "handleFinalize",
  },
  INBOX_ACK: {
    name: "inbox_ack",
    route_path: "/inbox/ack",
    http_methods: ["POST"],
    auth_scope: "AUTH_REQUIRED",
    handler_name: "handleInboxAck",
  },
  INBOX_POLL: {
    name: "inbox_poll",
    route_path: "/inbox/poll",
    http_methods: ["GET"],
    auth_scope: "AUTH_REQUIRED",
    handler_name: "handleInboxPoll",
  },
  INBOX_TAKE: {
    name: "inbox_take",
    route_path: "/inbox/take",
    http_methods: ["POST"],
    auth_scope: "AUTH_REQUIRED",
    handler_name: "handleInboxTake",
  },
  LOGS_TSV_EXPORT: {
    name: "logs_tsv_export",
    route_path: "/logs.tsv",
    http_methods: ["GET", "HEAD"],
    auth_scope: "PUBLIC",
    handler_name: "handleLogsTsv",
  },
  LOGS_TXT_EXPORT: {
    name: "logs_txt_export",
    route_path: "/logs.txt",
    http_methods: ["GET", "HEAD"],
    auth_scope: "PUBLIC",
    handler_name: "handleLogsTxt",
  },
  PING: {
    name: "ping",
    route_path: "/ping",
    http_methods: ["GET"],
    auth_scope: "AUTH_REQUIRED",
    handler_name: "textResponse",
  },
} as const;

export type TransportOperationCatalogEntry = typeof TRANSPORT_OPERATION_CATALOG[keyof typeof TRANSPORT_OPERATION_CATALOG];
