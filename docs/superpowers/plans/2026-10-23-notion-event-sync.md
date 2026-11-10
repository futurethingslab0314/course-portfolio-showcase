# Notion event-driven sync implementation plan

Goal: Manual Sync processes delivered Notion changes without scanning unchanged Notion records or downloading unchanged images. Full reconciliation remains explicit.
Architecture: Signed webhook -> durable deduplicated event log -> per-project persistent source snapshot and event checkpoint -> cached reconstruction with targeted live page reads -> changed-work writes and explicitly scoped deletions. Snapshot/checkpoint commit occurs only after successful writes. Delayed notifications are described accurately in UI.
Stack: existing Express, Node crypto/AsyncLocalStorage, Supabase REST/Postgres, React.

Constraints: Keep manual publishing. No external setup or secret activation without available credentials. Read-only previews and existing full course sync continue working. Never use whole-project stale deletion for a partial payload. A failed read/upload/write retains events. Config/schema changes require explicit full reconciliation. Preserve source and related page membership for card-case reconstruction. Compare image file identity without expiring Notion signatures; external URL query parameters remain significant.

Review focus: duplicate/out-of-order events; events arriving during sync; deletion/restore/move; related pages and new relations; no-op sync performs no Notion/image reads; failures preserve checkpoint; schema/config changes block fast sync; webhook raw-body validation and subscription scoping.

- [x] Add failing tests for signature validation, persistent event idempotency/checkpoints, cached Notion reconstruction, incremental create/update/delete/no-op/media reuse/failures.
- [x] Implement event log + project snapshot SQL and REST store. Add webhook verification/signature endpoint before JSON body parser.
- [x] Add source snapshot capture/replay in Notion fetch helpers; rebuild using cached unchanged pages and fetch changed page IDs only.
- [x] Implement serialized incremental sync, selective media reuse/writes/deletes, full baseline wrapper, safe acknowledgement.
- [x] Default admin jobs to changes; add explicit full mode, result counts and waiting/setup guidance.
- [x] Run focused regression tests, type checks/build; document migration, verification and deployment prerequisites.


Verification: 171 backend/frontend tests passed, including source snapshot/replay, changed-work selection, deletion/restore/move, no-op fast path, signature/HTTP retries, media reuse and existing sync regressions tested. `npm run lint` and `npm run build` pass. External activation requires the SQL migration, deployment environment values, Notion subscription verification and one full reconciliation per project; these are documented in `docs/notion-event-sync-setup.md` and have not been applied to production.
