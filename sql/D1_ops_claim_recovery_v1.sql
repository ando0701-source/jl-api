-- D1_ops_claim_recovery_v1.sql
-- Non-destructive peek equivalents (DO NOT use /dequeue for diagnosis)

-- [10] Peek one pending+unclaimed for worker_primary
SELECT bus_id, bus_ts, from_owner_id, to_owner_id, claimed_by, claimed_at, inserted_at
FROM bus_messages
WHERE q_state=0
  AND done_at IS NULL
  AND to_owner_id='worker_primary'
  AND claimed_by IS NULL
ORDER BY inserted_at ASC
LIMIT 1;

-- [11] Peek one pending+unclaimed for manager_primary
SELECT bus_id, bus_ts, from_owner_id, to_owner_id, claimed_by, claimed_at, inserted_at
FROM bus_messages
WHERE q_state=0
  AND done_at IS NULL
  AND to_owner_id='manager_primary'
  AND claimed_by IS NULL
ORDER BY inserted_at ASC
LIMIT 1;

-- [20] Unclaim by bus_id (recovery)
-- Replace <<<BUS_ID>>> manually
UPDATE bus_messages
SET claimed_by=NULL, claimed_at=NULL
WHERE bus_id='<<<BUS_ID>>>'
  AND q_state=0
  AND done_at IS NULL;

-- [30] TTL reclaim (e.g., 10 minutes = 600 sec)
UPDATE bus_messages
SET claimed_by=NULL, claimed_at=NULL
WHERE q_state=0
  AND done_at IS NULL
  AND claimed_by IS NOT NULL
  AND claimed_at IS NOT NULL
  AND claimed_at < (strftime('%s','now') - 600);

-- [40] Roundtrip check: RESPONSE that references REQUEST by payload.echo_request_bus_id
SELECT
  r.bus_id AS request_bus_id,
  r.request_id,
  r.to_owner_id AS req_to,
  r.claimed_by AS req_claimed_by,
  r.done_at AS req_done_at,
  s.bus_id AS response_bus_id,
  s.to_owner_id AS resp_to,
  s.inserted_at AS resp_inserted_at
FROM bus_messages r
LEFT JOIN bus_messages s
  ON json_extract(s.bus_json, '$.message.payload.echo_request_bus_id') = r.bus_id
WHERE r.msg_type='REQUEST'
ORDER BY r.inserted_at DESC
LIMIT 50;
