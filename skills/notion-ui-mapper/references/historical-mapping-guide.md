# Historical Mapping Guide

Use this guide to reuse previous FieldMapping decisions while preserving manual corrections.

## Reuse Priority

1. Manual mapping on current project record in Notion (if present)
2. Historical mapping with same `sourceDatabaseId`
3. Historical mapping from similar source schemas (cross-database)
4. Alias dictionary and keyword inference fallback

## Same-Database Reuse

When `sourceDatabaseId` matches:

1. Reuse `sourceCandidates` for each target field.
2. Keep existing `transform` unless data shape clearly changed.
3. Bump patch version when updating historical mapping snapshot.

## Cross-Database Reuse (Controlled)

Use cross-database history only if:

1. At least 2 canonical targets share the same alias signature, and
2. No negative rule is triggered, and
3. Candidate score remains in `medium` or `high` band after validation.

If any condition fails, fallback to alias/keyword inference and mark `needs_review`.

## Freshness Rules

1. Prefer latest valid mapping by `updated_at`.
2. Ignore stale historical mappings with deprecated target fields.
3. If two mappings are equally recent but disagree, use conflict resolution rules.

## Required Evidence in Output

For each inferred target field, include:

1. `matchedFrom` (`history_same_db|history_cross_db|alias|keyword|fallback`)
2. `historyRecordVersion` (if historical source used)
3. `reason`
4. `needs_review`
