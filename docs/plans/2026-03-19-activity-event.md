# Activity Event Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new `activity-event` project template with built-in Notion alias mapping for activity records.

**Architecture:** Extend the shared `StudentWork` model and UI-pattern enums with an `activity-event` mode, then normalize common activity Notion fields into that model before rendering them through a dedicated React component. Keep project-level `FieldMapping` as an override so custom databases still work.

**Tech Stack:** TypeScript, React, Node test runner, tsx, Notion API mapping, Supabase row parsing

---

### Task 1: Lock the new data contract with failing tests

**Files:**
- Modify: `server/services/supabase.test.ts`
- Create: `src/components/projects/ActivityEvent.test.tsx`

**Step 1: Write the failing test**

- Add a Supabase parsing test that expects activity metadata fields to survive row-to-`StudentWork` conversion.
- Add a component test that expects the activity card to render title, theme tag, grant, and modal metadata.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test server/services/supabase.test.ts src/components/projects/ActivityEvent.test.tsx`

Expected: FAIL because `activity-event` metadata is not yet represented in types or UI.

**Step 3: Write minimal implementation**

- No production code in this task.

**Step 4: Run test to verify it still fails correctly**

Run: `./node_modules/.bin/tsx --test server/services/supabase.test.ts src/components/projects/ActivityEvent.test.tsx`

Expected: FAIL with missing fields or missing renderer behavior, not syntax errors.

### Task 2: Extend shared types and UI pattern definitions

**Files:**
- Modify: `src/types.ts`
- Modify: `shared/contracts.ts`

**Step 1: Write the failing test**

- Use the tests from Task 1.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test server/services/supabase.test.ts`

Expected: FAIL because `activity-event` is not a valid display style and activity metadata fields are missing.

**Step 3: Write minimal implementation**

- Add `activity-event` to `Project['displayStyle']`.
- Add optional activity metadata fields to `StudentWork`.
- Add `activity-event` to `UiPattern` and `UI_PATTERN_MAP`.

**Step 4: Run test to verify it still fails for the next missing layer**

Run: `./node_modules/.bin/tsx --test server/services/supabase.test.ts`

Expected: FAIL because normalization and component wiring are still incomplete.

### Task 3: Add default activity-event alias normalization

**Files:**
- Modify: `shared/notionMapper.ts`

**Step 1: Write the failing test**

- Add focused normalization tests inside `shared/notionMapper` coverage if needed through the existing Supabase-facing test path, or extend tests to verify alias handling for:
  - `Activity Name`
  - `Files & media`
  - `theme tag`
  - `start date`
  - `end date`
  - `publication name`

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test server/services/supabase.test.ts`

Expected: FAIL because activity aliases are not mapped into normalized fields.

**Step 3: Write minimal implementation**

- Add helper logic for activity alias candidates when `FieldMapping` does not provide a match.
- Normalize `Files & media` into `mainImage` and `moreImages`.
- Preserve `FieldMapping` precedence over built-in aliases.
- Merge `themeTag` into `tags`.

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test server/services/supabase.test.ts`

Expected: PASS

### Task 4: Preserve activity metadata through Supabase rows

**Files:**
- Modify: `server/services/supabase.ts`
- Modify: `server/services/supabase.test.ts`

**Step 1: Write the failing test**

- Extend the row-mapping test to expect `themeTag`, `startDate`, `endDate`, `country`, `city`, `grant`, and `publicationName`.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test server/services/supabase.test.ts`

Expected: FAIL because row parsing does not yet expose the new metadata.

**Step 3: Write minimal implementation**

- Read activity metadata from `student_works.metadata`.
- Include the new fields on the returned `StudentWork`.
- Ensure unknown or missing metadata still yields a valid `StudentWork`.

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test server/services/supabase.test.ts`

Expected: PASS

### Task 5: Render and wire the Activity Event component

**Files:**
- Create: `src/components/projects/ActivityEvent.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/projects/ActivityEvent.test.tsx`

**Step 1: Write the failing test**

- Use the component test from Task 1.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/components/projects/ActivityEvent.test.tsx`

Expected: FAIL because the component does not exist in the production path or is not wired into `StudentWorkItem`.

**Step 3: Write minimal implementation**

- Move the approved activity-event UI into `src/components/projects/ActivityEvent.tsx`.
- Render the card and modal with conditional sections for grant, publication, authors, and external link.
- Route `displayStyle === 'activity-event'` through `StudentWorkItem`.

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/components/projects/ActivityEvent.test.tsx`

Expected: PASS

### Task 6: Run focused regressions

**Files:**
- No code changes required unless regressions appear.

**Step 1: Run focused regression checks**

Run: `./node_modules/.bin/tsx --test src/data/courseData.test.ts server/services/supabase.test.ts server/services/notion.test.ts src/components/projects/ActivityEvent.test.tsx src/components/projects/BlogPost.test.tsx`

Expected: PASS

**Step 2: Run project verification**

Run: `npm run lint`

Expected: PASS, or document any pre-existing or environment-specific failures.
