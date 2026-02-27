# Notion Schema Rules

Courses database (ID1):
- `Slug` (lookup key)
- `Projects` (relation to Projects)
- `CourseLink` (writeback URL)
- `Status` (writeback generated/failed)

Projects database (ID2):
- `Course` (relation to Courses)
- `Order` (tab sorting)
- `UiPattern`
- `SourceDatabaseId`
- `FieldMapping`

Source databases:
- Record schema may vary.
- Normalize into `STUDENT_WORKS` using `FieldMapping.sourceCandidates`, `transform`, `default`.
- Missing required fields should generate warning, not crash.
