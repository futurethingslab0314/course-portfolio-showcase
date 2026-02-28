# Conflict Resolution Rules

Apply these rules when candidate mappings disagree across manual edits, history, alias dictionary, or fuzzy inference.

## Resolution Order

1. Manual Notion mapping on current project
2. Latest same-`sourceDatabaseId` historical mapping
3. Alias dictionary positive match
4. Keyword/fuzzy inference
5. Default fallback

## Deterministic Tie-Breakers

If two candidates are in the same resolution level:

1. Prefer candidate without negative-rule hit.
2. Prefer candidate with higher confidence score.
3. Prefer candidate with explicit transform compatibility:
   - array-like field -> `string[]`
   - yes/no field -> `boolean`
4. Prefer candidate validated by UiPattern required fields.

## Escalate to Review

Force `needs_review = true` when:

1. tie remains after tie-breakers,
2. inferred candidate affects required fields,
3. confidence gap is below `0.05`,
4. selected candidate contradicts recent manual correction.

## Conflict Log Format

For each conflict, capture:

1. `targetField`
2. `candidateA`
3. `candidateB`
4. `winner`
5. `ruleApplied`
6. `needs_review`
7. `timestamp`
