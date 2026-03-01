-- DDL_D1_30_seed_vocab.sql
-- Target: Cloudflare D1 (SQLite)

-- q_state (DOC_ID 2PLT_20_QUEUE_STATE_VOCAB)
INSERT OR REPLACE INTO vocab_q_state(name,legacy_code,meaning) VALUES
  ('PENDING',0,'Eligible for claim/processing.'),
  ('DONE',1,'Successfully processed and finalized (not eligible for claim).'),
  ('DEAD',9,'Abnormal termination / dead-letter (not eligible for claim).');

-- 2PLT state machine terminals (DOC_ID 2PLT_10_STATE_MACHINE)
INSERT OR REPLACE INTO vocab_2plt_state(state,meaning) VALUES
  ('NUL','Initial / no-op state (requests only in_state).'),
  ('PROPOSAL','Worker proposed a plan/diff; waiting for commit or reject.'),
  ('COMMIT','Worker executed / finalized successfully.'),
  ('UNRESOLVED','Rejected or not resolved; no execution performed.'),
  ('ABEND','Abnormal end / failure.');

-- msg_type (DOC_ID 2PLT_20_MESSAGE_SCHEMA_VOCAB)
INSERT OR REPLACE INTO vocab_msg_type(msg_type,meaning) VALUES
  ('REQUEST','A request message.'),
  ('RESPONSE','A response message.');
