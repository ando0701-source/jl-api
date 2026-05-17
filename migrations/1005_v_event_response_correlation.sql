-- 1005_v_event_response_correlation.sql
-- Derived events for response/request correlation mismatches.
-- Uses v_response_correlation (1004) and emits one event row per RESPONSE with mismatch.
-- One object per migration file: v_event_response_correlation.
-- Target: Cloudflare D1 (SQLite)

DROP VIEW IF EXISTS v_event_response_correlation;

CREATE VIEW v_event_response_correlation AS
SELECT
  'DERIVED:response_correlation:' || response_bus_id AS event_id, -- stable derived event id
  correlation_status AS event_code,                     -- one of bus_events_catalog event_code values
  response_bus_ts AS event_ts,

  COALESCE(request_flow_owner_id, response_flow_owner_id) AS flow_owner_id,
  COALESCE(request_lane_id, response_lane_id)             AS lane_id,
  COALESCE(request_id, response_request_id)               AS request_id,
  COALESCE(request_op_id, response_op_id)                 AS op_id,

  COALESCE(request_bus_id, response_bus_id)               AS bus_id, -- prefer origin request; fall back to response for orphan diagnostics
  response_from_owner_id AS actor_owner_id,               -- actor (response sender)

  json_object(
    'response_bus_id', response_bus_id,
    'response_from_owner_id', response_from_owner_id,
    'response_to_owner_id', response_to_owner_id,
    'response_op_id', response_op_id,
    'response_flow_owner_id', response_flow_owner_id,
    'response_lane_id', response_lane_id,
    'response_request_id', response_request_id,
    'request_source_bus_id', request_source_bus_id,
    'request_bus_id', request_bus_id,
    'request_bus_ts', request_bus_ts,
    'request_op_id', request_op_id,
    'request_flow_owner_id', request_flow_owner_id,
    'request_lane_id', request_lane_id,
    'request_id', request_id
  ) AS data

FROM v_response_correlation
WHERE correlation_status <> 'OK';
