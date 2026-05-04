-- 1006_v_events_all_phase1a_replace.sql
-- Replace v_events_all so appended events, response-correlation events, and
-- Phase1A proposal_ref-resolution derived events are visible through one view.
-- Uses the 1006 events-all view-family prefix.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_events_all;

CREATE VIEW v_events_all AS
SELECT
  event_id,
  event_code,
  event_ts,
  flow_owner_id,
  lane_id,
  request_id,
  op_id,
  bus_id,
  actor_owner_id,
  data
FROM bus_events

UNION ALL

SELECT
  event_id,
  event_code,
  event_ts,
  flow_owner_id,
  lane_id,
  request_id,
  op_id,
  bus_id,
  actor_owner_id,
  data
FROM v_event_response_correlation

UNION ALL

SELECT
  event_id,
  event_code,
  event_ts,
  flow_owner_id,
  lane_id,
  request_id,
  op_id,
  bus_id,
  actor_owner_id,
  data
FROM v_event_proposal_ref_resolution;
