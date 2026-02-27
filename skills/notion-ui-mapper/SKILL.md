# notion-ui-mapper

## Trigger
Use this skill when converting Notion DB records into stable UI payloads without changing frontend components.

## Hard Rule
Do not change existing UI components, styles, layout, or interaction behavior. Change data contracts and mapping layer only.

## Workflow
1. Read current UI data contract (`COURSES`, `PROJECTS`, `STUDENT_WORKS`).
2. Map Notion `Courses` and `Projects` databases to contract fields.
3. Parse `FieldMapping` from project records.
4. Normalize source database records with candidate fields, transforms, and defaults.
5. Validate per `UiPattern`. If invalid, fallback to `GenericCard`.
6. Emit warnings (no hard crash) for missing required fields.

## Outputs
- Stable payload shape compatible with current frontend templates.
- Mapping warnings with context: `courseId`, `projectId`, `sourceDatabaseId`.
- Validation result per project pattern.

## References
- `references/ui-pattern-contract.md`
- `references/notion-schema-rules.md`
- `references/mapping-examples.md`

## Scripts
- `scripts/infer_mapping.ts`
- `scripts/normalize_records.ts`
- `scripts/validate_for_pattern.ts`
