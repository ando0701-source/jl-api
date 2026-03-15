-- 3011_trg_bus_messages_before_update_phase0_strict.sql
-- Phase-0 transport hardening for bus_messages UPDATE writes.
-- Defense-in-depth: runtime TS validation remains primary; this trigger protects direct DB writes.

CREATE TRIGGER IF NOT EXISTS trg_bus_messages_phase0_update
BEFORE UPDATE OF msg_type, op_id, in_state, state, out_state ON bus_messages
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'invalid_op_id')
  WHERE NEW.op_id NOT IN ('JL_PROPOSAL','JL_COMMIT','JL_REJECT');

  SELECT RAISE(ABORT, 'invalid_request_op_in_state')
  WHERE NEW.msg_type = 'REQUEST'
    AND NOT (
      (NEW.op_id = 'JL_PROPOSAL' AND NEW.in_state = 'NUL')
      OR (NEW.op_id = 'JL_COMMIT' AND NEW.in_state = 'PROPOSAL')
      OR (NEW.op_id = 'JL_REJECT' AND NEW.in_state = 'PROPOSAL')
    );

  SELECT RAISE(ABORT, 'invalid_response_terminal')
  WHERE NEW.msg_type = 'RESPONSE'
    AND NOT (
      (NEW.op_id = 'JL_PROPOSAL' AND NEW.in_state = 'NUL' AND NEW.state IN ('PROPOSAL','ABEND') AND NEW.out_state = NEW.state)
      OR (NEW.op_id = 'JL_COMMIT' AND NEW.in_state = 'PROPOSAL' AND NEW.state IN ('COMMIT','UNRESOLVED','ABEND') AND NEW.out_state = NEW.state)
      OR (NEW.op_id = 'JL_REJECT' AND NEW.in_state = 'PROPOSAL' AND NEW.state IN ('UNRESOLVED','ABEND') AND NEW.out_state = NEW.state)
    );
END;
