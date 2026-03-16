# AI Executable Plan: Notion Data Integration (No UI Changes)

## Global Constraints (Must Follow)
1. Do not modify any existing UI components, layouts, styles, or interaction behavior.
2. Replace only the data source layer (`mockData` to Notion).
3. Keep frontend-consumed data shape compatible with current `src/mockData.ts`.

## Phase 1: Define Data Contracts (Without UI Changes)
1. Read existing types and `src/mockData.ts` to confirm three data contracts:
   - `COURSES`
   - `PROJECTS`
   - `STUDENT_WORKS`
2. Create canonical mapping spec:
   - ID1 `Courses` -> `COURSES`
   - ID2 `Projects` -> `PROJECTS`
   - SourceDatabase records -> `STUDENT_WORKS`
3. Lock enum mapping:
   - `card-spec -> CardSpec`
   - `data-matrix -> DataMatrix`
   - `gallery-slide -> GallerySlide`
   - `gallery-story -> GalleryStory`
   - `generic-card -> GenericCard`

## Phase 2: Backend Data Fetch Flow
1. Implement `fetchCourseBySlug(slug)` from ID1 (`Slug`).
2. Implement `fetchProjectsByCourse(coursePageId)` from ID2 and sort by `Order`.
3. For each project, read `SourceDatabaseId`, then fetch source database schema + records.
4. Return intermediate objects while preserving compatibility with current frontend data consumption.

## Phase 3: Mapping and Normalize Layer
1. Implement `FieldMapping` parser from ID2 `FieldMapping`.
2. Normalize source records using:
   - `sourceCandidates`
   - `transform`
   - `default`
3. Produce normalized output matching `STUDENT_WORKS` fields.
4. If required fields are missing, add warnings but do not crash page generation.

## Phase 4: Website Generation Flow
1. Trigger from ID1 `generate website` action (button/webhook/API).
2. Execute:
   - fetch Course + Projects + SourceDB records
   - normalize records
   - compose payload equivalent to current `mockData` structure
3. Write back to ID1:
   - `CourseLink` (generated URL)
   - `Status` (`generated` or `failed`)

## Phase 5: Fallbacks and Reliability Rules
1. If relation conflicts occur, prioritize Notion relations (ID1 `Projects`, ID2 `Course`).
2. If `UiPattern` is invalid or mapping is incomplete, fallback to `GenericCard`.
3. Log all failures with context: `courseId`, `projectId`, `sourceDatabaseId`.

## Phase 6: Skill Package for Reusable Mapping
1. Create skill: `notion-ui-mapper`.
2. Include:
   - `SKILL.md` (workflow, trigger conditions, hard rule: no UI changes)
   - `references/ui-pattern-contract.md`
   - `references/notion-schema-rules.md`
   - `references/mapping-examples.md`
   - `scripts/infer_mapping.ts`
   - `scripts/normalize_records.ts`
   - `scripts/validate_for_pattern.ts`
3. Goal:
   - Auto-suggest initial mapping for new SourceDatabase schemas
   - Validate data sufficiency per `UiPattern`
   - Keep output shape stable for existing UI templates

## Phase 7: Deployment and Secrets (Railway + Notion API)
1. Deploy backend on Railway and ensure build/start scripts are defined.
2. Configure required Railway environment variables:
   - `NOTION_TOKEN`
   - `NOTION_DB_COURSES_ID`
   - `NOTION_DB_PROJECTS_ID`
   - `BASE_URL`
   - `NOTION_API_VERSION` (pin a fixed version)
   - `REVALIDATE_SECRET` (optional, if ISR/revalidate is used)
3. Verify Notion integration access:
   - Integration is shared to ID1, ID2, and all Source Databases referenced by `SourceDatabaseId`
   - Integration has read access for query and write access for updating `CourseLink` and `Status`
4. Ensure production endpoint availability:
   - Railway URL can receive generate requests
   - API can fetch Notion data and return normalized payload
   - API can write result back to Notion (`CourseLink`, `Status`)
5. Add operational logging requirements:
   - Log every generation with `courseId`, `projectId`, `sourceDatabaseId`
   - Log mapping warnings and fallback usage (`GenericCard`)
   - Log final status (`generated` or `failed`)

## Definition of Done (DoD)
1. Visual design and interactions are identical to current site.
2. Production data no longer depends on static mock data.
3. Any course page can load from Notion by `Slug`.
4. Tabs render correctly by `Order` and `UiPattern`.
5. Schema variance in source databases is handled by `FieldMapping`, with safe fallback to `GenericCard`.
6. Backend is deployed on Railway with valid Notion secrets and live API execution.
7. Generation flow can read from Notion and write `CourseLink`/`Status` back successfully in production.
