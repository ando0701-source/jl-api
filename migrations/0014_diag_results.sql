-- 0014_diag_results.sql
-- Append-only diagnostic result accumulation table for /diag initial implementation.
-- Phase1D-4: /diag key/value accumulation.
-- One object per migration file: diag_results + indexes.
-- Target: Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS diag_results (
  run_id TEXT NOT NULL,
  bus_id TEXT,
  diag_key TEXT NOT NULL,
  diag_value TEXT,
  status TEXT NOT NULL CHECK (status IN ('PASS','FAIL','WARN','INFO')),
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (run_id, diag_key)
);

CREATE INDEX IF NOT EXISTS idx_diag_results_run ON diag_results(run_id, created_at, diag_key);
CREATE INDEX IF NOT EXISTS idx_diag_results_status ON diag_results(status, created_at);
CREATE INDEX IF NOT EXISTS idx_diag_results_bus ON diag_results(bus_id) WHERE bus_id IS NOT NULL;
