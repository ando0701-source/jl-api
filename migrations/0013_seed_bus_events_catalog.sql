-- DDL_D1_74_seed_bus_events_catalog.sql
-- Seed bus_events_catalog with minimum set of event_code definitions.
-- Target: Cloudflare D1 (SQLite)

INSERT OR IGNORE INTO bus_events_catalog(
  event_code,severity,default_scope_kind,recovery_profile,
  required_data_keys,optional_data_keys,message_template
) VALUES
  -- per-message recovery ACK (append-only event row per finalize mutation)
  ('AUTO_FINALIZE_ACK','INFO','BUS_MESSAGE','AUTO_FINALIZE',
    '["q_state","reason"]',
    '["incident_id","dry_run","criteria.match.claim_age_sec_gt","criteria.match.in_state","criteria.match.lane_id","criteria.match.msg_type","criteria.match.state","criteria.match.to_owner_id","criteria.target_q_state","sample_bus_ids","transition.q_state.from","transition.q_state.to","transition.done_at.from","transition.done_at.to"]',
    'Auto-finalize ACK executed safely for one message (bus_id).'
  ),

  -- TTL reclaim (claim fields may be overwritten later; append-only keeps evidence)
  ('CLAIM_RECLAIMED','WARN','BUS_MESSAGE',NULL,
    '[]',
    '["reason","claim.claimed_by","claim.claimed_at","claim.expired_at","transition.claimed_by.from","transition.claimed_by.to","transition.claimed_at.from","transition.claimed_at.to"]',
    'TTL reclaim cleared an expired claim for bus_id={bus_id} (claim fields may have been overwritten)'
  ),

  ('ENQUEUE_DUPLICATE','WARN','BUS_MESSAGE',NULL,
    '[]',
    '["reason","lane_id","request_id","to_owner_id"]',
    'enqueue ignored because bus_id already exists (idempotent duplicate): bus_id={bus_id}'
  ),

  ('ENQUEUE_CONSTRAINT_FAILED','ERROR','BUS_MESSAGE',NULL,
    '[]',
    '["constraint","reason","lane_id","request_id","to_owner_id"]',
    'enqueue failed by DB constraint (non-duplicate): bus_id={bus_id}'
  ),

  -- stall detect -> act -> outcome (owner-scoped; data requirements are defined in vocab)
  ('BUS_STALL_DETECTED','WARN','OWNER',NULL,
    '["incident_id","detected_by","scope_kind","scope_owner_id","metrics.pending_count","metrics.oldest_age_sec","thresholds.pending_count","thresholds.oldest_age_sec"]',
    '["scope_lane_id","metrics.claim_stuck_count","thresholds.claim_stuck_count","evidence.query_id","evidence.sample_bus_ids"]',
    'Bus stall detected for scope={scope_kind}:{scope_owner_id}{:scope_lane_id}.'
  ),

  ('BUS_RECOVERY_START','INFO','OWNER',NULL,
    '["incident_id","scope_kind","scope_owner_id","recovery_profile","plan.strategy"]',
    '["scope_lane_id","started_by","plan.criteria","plan.dry_run"]',
    'Recovery started for incident_id={incident_id} profile={recovery_profile}.'
  ),

  ('BUS_STALL_CLEARED','INFO','OWNER',NULL,
    '["incident_id","scope_kind","scope_owner_id","recovery_profile","duration_ms","manual_required","metrics_before.pending_count","metrics_before.oldest_age_sec","metrics_after.pending_count","metrics_after.oldest_age_sec"]',
    '["scope_lane_id","done_count","dead_count","finalized_count","notes"]',
    'Stall cleared for incident_id={incident_id}.'
  ),

  ('BUS_STALL_NOT_CLEARED','ERROR','OWNER',NULL,
    '["incident_id","scope_kind","scope_owner_id","recovery_profile","duration_ms","manual_required","metrics_before.pending_count","metrics_before.oldest_age_sec","metrics_after.pending_count","metrics_after.oldest_age_sec"]',
    '["scope_lane_id","error_summary","next_action","notes"]',
    'Stall NOT cleared for incident_id={incident_id}; manual_required={manual_required}.'
  )
;
