# Deploy note (q_state TEXT + Wrangler migrations)

This snapshot switches `bus_messages.q_state` to TEXT with enum:
- PENDING / DONE / DEAD

Wrangler D1 migrations apply requires numeric migration file names (0001_*.sql, ...).
This repo uses that convention.

## Important: existing DB schemas won't auto-upgrade
If your remote D1 already has an old `bus_messages` table (q_state INTEGER),
`CREATE TABLE IF NOT EXISTS` won't change it.

Choose ONE of:
1) Create a new D1 database and update wrangler.json `database_id`.
2) Drop the existing tables in the D1 console (bus_messages, vocab_*, event_* as needed) and rerun deploy.
   (Keep in mind this is destructive; use only during experiments.)

After reset, deploy will apply migrations in order.
