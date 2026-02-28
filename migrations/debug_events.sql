-- debug_events (optional)
-- This table is created automatically when DEBUG_LITE is enabled.
CREATE TABLE IF NOT EXISTS debug_events (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  data TEXT
);
