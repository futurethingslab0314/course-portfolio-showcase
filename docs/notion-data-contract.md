# Notion Data Contract

Canonical mapping:
- ID1 `Courses` -> `COURSES`
- ID2 `Projects` -> `PROJECTS`
- SourceDatabase records -> `STUDENT_WORKS`

Enum lock:
- `card-spec -> CardSpec`
- `data-matrix -> DataMatrix`
- `gallery-slide -> GallerySlide`
- `gallery-story -> GalleryStory`
- `generic-card -> GenericCard`

Reliability rules:
- Relation conflicts prioritize Notion relations (`Courses.Projects`, `Projects.Course`).
- Invalid `UiPattern` falls back to `GenericCard`.
- Missing required fields create warnings and default values; generation does not crash.
