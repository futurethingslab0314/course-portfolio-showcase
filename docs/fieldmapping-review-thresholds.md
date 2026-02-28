# FieldMapping Review Thresholds

Version: v1  
Updated: 2026-02-28

## Purpose

Define confidence thresholds and review actions for inferred FieldMapping to keep auto-mapping useful while protecting manual quality control.

## Confidence Bands

1. High confidence: `score >= 0.90`
   - Action: auto-accept candidate mapping.
   - Review flag: `needs_review = false`.
2. Medium confidence: `0.75 <= score < 0.90`
   - Action: keep suggestion, require human review.
   - Review flag: `needs_review = true`.
3. Low confidence: `score < 0.75`
   - Action: do not auto-apply; route to unresolved queue.
   - Review flag: `needs_review = true`.

## Hard Review Triggers (Always Review)

Set `needs_review = true` even when confidence is high if any condition matches:

1. `assignmentName` candidate contains student/person signals (`student`, `member`, `author`).
2. `members` and `studentIds` map to the same source field.
3. `data-matrix` inferred but `gridLocation` candidate is missing.
4. More than one competing candidate has score gap `< 0.05`.
5. Candidate source field appears in negative rules.

## Output Fields for Review Queue

Each inferred target field should include:

1. `targetField`
2. `sourceCandidates`
3. `score`
4. `reason`
5. `matchedFrom` (`exact|keyword|history|alias|fallback`)
6. `needs_review`
7. `review_reason` (if reviewed)

## Default Operational Threshold

Use `0.85` as pipeline default confidence threshold for `status: auto|review` until project-specific tuning is required.

## Tuning Policy

1. Re-tune thresholds only after at least 3 new source databases are processed.
2. If false positives increase, raise medium/high boundary by `+0.03`.
3. If review load is too high with acceptable quality, lower medium boundary by `-0.03`.
