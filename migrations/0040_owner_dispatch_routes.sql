-- 0040_owner_dispatch_routes.sql
-- Phase-0 minimal routing table for /dispatch.
-- One object per migration file: owner_dispatch_routes + dedicated indexes.
-- Target: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS owner_dispatch_routes (
  owner_id TEXT PRIMARY KEY,
  dispatch_url TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1)),
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_owner_dispatch_routes_enabled
  ON owner_dispatch_routes(is_enabled, owner_id);

-- Example manual seed (edit URLs before use):
-- INSERT OR REPLACE INTO owner_dispatch_routes(owner_id, dispatch_url, is_enabled, notes)
-- VALUES
--   ('manager_primary', 'https://manager.example.invalid/dispatch/receive', 1, 'Phase-0 provisional route'),
--   ('worker_primary',  'https://worker.example.invalid/dispatch/receive', 1, 'Phase-0 provisional route');
