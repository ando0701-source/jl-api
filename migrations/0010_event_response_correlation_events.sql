-- DDL_D1_71_event_response_correlation_events.sql
-- Derived events for response/request correlation mismatches.
-- Uses v_response_correlation (0005) and emits one event row per RESPONSE with mismatch.
-- Target: Cloudflare D1 (SQLite)

CREATE VIEW IF NOT EXISTS v_event_response_correlation AS
SELECT
  response_bus_id AS event_id,                          -- stable id (response bus_id)
  correlation_status AS event_code,                     -- one of event_catalog codes
  response_bus_ts AS event_ts,

  request_flow_owner_id AS flow_owner_id,
  request_lane_id       AS lane_id,
  request_id            AS request_id,
  NULL                  AS op_id,

  request_bus_id        AS bus_id,                      -- primary bus linkage (request)
  response_from_owner_id AS actor_owner_id,             -- actor (response sender)

  json_object(
    'response_bus_id', response_bus_id,
    'response_from_owner_id', response_from_owner_id,
    'response_to_owner_id', response_to_owner_id,
    'response_flow_owner_id', response_flow_owner_id,
    'response_lane_id', response_lane_id,
    'response_request_id', response_request_id,
    'echo_request_bus_id', echo_request_bus_id,
    'request_bus_id', request_bus_id,
    'request_bus_ts', request_bus_ts,
    'request_flow_owner_id', request_flow_owner_id,
    'request_lane_id', request_lane_id,
    'request_id', request_id
  ) AS data

FROM v_response_correlation
WHERE correlation_status <> 'OK';
