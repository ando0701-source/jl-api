-- DDL_D1_75_bus_audit.sql
-- Raw I/O audit table for storing original bus JSON payloads (append-only).
-- Target: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS bus_audit (
  audit_id TEXT PRIMARY KEY,                -- UUID/ULID recommended
  captured_at INTEGER NOT NULL,             -- epoch seconds
  actor_owner_id TEXT NOT NULL,             -- sender for SENT, receiver for RECEIVED
  io TEXT NOT NULL CHECK (io IN ('SENT','RECEIVED')),
  peer_owner_id TEXT,                       -- optional counterparty
  bus_id TEXT NOT NULL,                     -- references bus_messages.bus_id
  content_json TEXT NOT NULL,               -- raw JSON string stored as-is
  content_hash TEXT                         -- optional sha256 hex
);

CREATE INDEX IF NOT EXISTS idx_bus_audit_bus_id ON bus_audit(bus_id);
CREATE INDEX IF NOT EXISTS idx_bus_audit_captured_at ON bus_audit(captured_at);
CREATE INDEX IF NOT EXISTS idx_bus_audit_actor_io ON bus_audit(actor_owner_id, io, captured_at);
