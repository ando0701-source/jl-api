-- 0999_debug_events.sql
-- Optional debug-lite table.
-- Governed in vocab for Phase-0, but intentionally kept outside the core transport path.
-- One object per migration file: debug_events.

CREATE TABLE IF NOT EXISTS debug_events (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  data TEXT
);
