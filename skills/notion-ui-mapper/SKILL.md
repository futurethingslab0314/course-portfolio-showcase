# notion-ui-mapper

## Trigger
Use this skill when converting Notion DB records into stable UI payloads without changing frontend components.

## Hard Rule
Do not change existing UI components, styles, layout, or interaction behavior. Change data contracts and mapping layer only.

## Workflow
1. Read current UI data contract (`COURSES`, `PROJECTS`, `STUDENT_WORKS`) and SSOT docs.
2. Parse manual `FieldMapping` from project records and treat it as highest-priority source.
3. Load same-DB historical mapping and cross-DB alias rules before fuzzy inference.
4. Resolve conflicts with deterministic rule order, then mark low-confidence fields for review.
5. Normalize source database records with selected candidates, transforms, and defaults.
6. Validate per `UiPattern`. If invalid, fallback to `GenericCard`.
7. Emit warnings (no hard crash) for missing required fields and review-required mappings.

## Outputs
- Stable payload shape compatible with current frontend templates.
- Mapping warnings with context: `courseId`, `projectId`, `sourceDatabaseId`.
- Validation result per project pattern.

## References
- `references/ui-pattern-contract.md`
- `references/notion-schema-rules.md`
- `references/mapping-examples.md`
- `references/field-alias-dictionary.md`
- `references/historical-mapping-guide.md`
- `references/conflict-resolution-rules.md`
- `../../docs/fieldmapping-ssot-policy.md`
- `../../docs/fieldmapping-review-thresholds.md`

## Scripts
- `scripts/infer_mapping.ts`
- `scripts/normalize_records.ts`
- `scripts/validate_for_pattern.ts`
